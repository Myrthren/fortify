import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SettingsClient } from "./client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const [user, metaConn] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.metaConnection.findUnique({ where: { userId }, select: { accountName: true } }),
  ]);
  if (!user) redirect("/login");

  return (
    <SettingsClient
      user={{ email: user.email, tier: user.tier, discordId: user.discordId }}
      meta={{ connected: !!metaConn, accountName: metaConn?.accountName ?? null }}
    />
  );
}
