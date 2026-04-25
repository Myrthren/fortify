import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";

// Full auth setup with Prisma adapter — used by API routes and server components (Node runtime).
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  debug: true,
  logger: {
    error(error) {
      console.error("[AUTH][ERROR]", error.name, error.message, error.stack);
    },
    warn(code) {
      console.warn("[AUTH][WARN]", code);
    },
    debug(code, metadata) {
      console.log("[AUTH][DEBUG]", code, JSON.stringify(metadata));
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
        (session.user as any).tier = (user as any).tier;
        (session.user as any).discordId = (user as any).discordId;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (account?.provider === "discord" && account.providerAccountId) {
        await db.user.update({
          where: { id: user.id },
          data: { discordId: account.providerAccountId },
        });
      }
    },
  },
});
