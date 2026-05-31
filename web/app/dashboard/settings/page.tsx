import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SettingsClient } from "./client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const [user, metaConn, googleConn, shopifyConn, stripeConn, notionConn] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.metaConnection.findUnique({ where: { userId }, select: { accountName: true } }),
    db.googleConnection.findUnique({ where: { userId }, select: { gaPropertyName: true, scSiteUrl: true } }),
    db.shopifyConnection.findUnique({ where: { userId }, select: { shop: true } }),
    db.stripeConnection.findUnique({ where: { userId }, select: { id: true } }),
    db.notionConnection.findUnique({ where: { userId }, select: { workspaceName: true, rootPageId: true } }),
  ]);
  if (!user) redirect("/login");

  return (
    <SettingsClient
      user={{ email: user.email, tier: user.tier, discordId: user.discordId }}
      meta={{ connected: !!metaConn, accountName: metaConn?.accountName ?? null }}
      google={{
        connected: !!googleConn,
        gaPropertyName: googleConn?.gaPropertyName ?? null,
        scSiteUrl: googleConn?.scSiteUrl ?? null,
      }}
      shopify={{ connected: !!shopifyConn, shop: shopifyConn?.shop ?? null }}
      stripe={{ connected: !!stripeConn }}
      notion={{
        connected: !!notionConn,
        workspaceName: notionConn?.workspaceName ?? null,
        rootPageId: notionConn?.rootPageId ?? null,
      }}
      username={user.username ?? null}
      usernameChangesUsed={user.usernameChangesUsed}
      credits={user.credits}
      leRaiseBatch={user.leRaiseBatch ?? false}
    />
  );
}
