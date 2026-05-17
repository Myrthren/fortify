import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/tiers";
import type { Tier } from "@prisma/client";

// ── Lazy ban expiry ────────────────────────────────────────────────────────────
// Only runs when the user is currently flagged as banned.
// Checks if any timed bans have expired and lifts them in the background.
async function liftExpiredBans(userId: string) {
  const now = new Date();
  const expired = await db.banRecord.findMany({
    where: { userId, unbannedAt: null, permanent: false, expiresAt: { lte: now } },
    select: { id: true },
  });
  if (!expired.length) return;

  await db.banRecord.updateMany({
    where: { id: { in: expired.map((b) => b.id) } },
    data: { unbannedAt: now },
  });

  const remaining = await db.banRecord.findMany({
    where: { userId, unbannedAt: null },
  });
  await db.user.update({
    where: { id: userId },
    data: {
      softwareBanned: remaining.some((b) => b.type === "SOFTWARE"),
      platformBanned: remaining.some((b) => b.type === "PLATFORM" || b.type === "SOFTWARE"),
    },
  });
}

// ── Lazy monthly credit top-up ─────────────────────────────────────────────────
// Only runs when the calendar month differs from creditsResetAt.
// DB-level re-check prevents double-crediting from concurrent requests.
async function topUpCreditsIfDue(userId: string, tier: Tier, now: Date) {
  const monthly = TIER_LIMITS[tier]?.monthlyCredits;
  if (!monthly) return;

  const fresh = await db.user.findUnique({
    where: { id: userId },
    select: { creditsResetAt: true, subscription: { select: { status: true } } },
  });
  if (!fresh || fresh.subscription?.status !== "ACTIVE") return;

  const lastReset = fresh.creditsResetAt;
  const isDifferentMonth =
    !lastReset ||
    lastReset.getUTCMonth() !== now.getUTCMonth() ||
    lastReset.getUTCFullYear() !== now.getUTCFullYear();

  if (!isDifferentMonth) return;

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { credits: { increment: monthly }, creditsResetAt: now },
    }),
    db.creditTransaction.create({
      data: { userId, amount: monthly, source: `monthly_${tier.toLowerCase()}` },
    }),
  ]);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify email" } },
    }),
  ],
  pages: { signIn: "/login", error: "/auth/error" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
        (session.user as any).tier = (user as any).tier;
        (session.user as any).discordId = (user as any).discordId;
      }

      const u = user as any;
      const now = new Date();

      // Lazy ban expiry — only hits DB if user is currently marked as banned
      if (u.softwareBanned || u.platformBanned) {
        liftExpiredBans(user.id).catch(() => {});
      }

      // Lazy monthly credits — only hits DB if month has rolled over
      const tier = u.tier as Tier;
      if (tier && tier !== "FREE") {
        const resetAt = u.creditsResetAt as Date | null;
        const isDifferentMonth =
          !resetAt ||
          resetAt.getUTCMonth() !== now.getUTCMonth() ||
          resetAt.getUTCFullYear() !== now.getUTCFullYear();

        if (isDifferentMonth) {
          topUpCreditsIfDue(user.id, tier, now).catch(() => {});
        }
      }

      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "discord" && account.providerAccountId) {
        const avatarHash = (profile as any)?.avatar;
        const avatarUrl = avatarHash
          ? `https://cdn.discordapp.com/avatars/${account.providerAccountId}/${avatarHash}.${avatarHash.startsWith("a_") ? "gif" : "png"}?size=128`
          : null;

        await db.user.update({
          where: { id: user.id },
          data: {
            discordId: account.providerAccountId,
            ...(avatarUrl ? { avatarUrl, image: avatarUrl } : {}),
          },
        });
      }
    },
  },
});
