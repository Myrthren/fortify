import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { BanManagerClient } from "@/components/admin-ban-manager";

export default async function AdminBansPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  if (!isOwner(user?.discordId ?? null)) redirect("/dashboard");

  const [bans, users] = await Promise.all([
    db.banRecord.findMany({
      where: { unbannedAt: null },
      include: { user: { select: { id: true, username: true, name: true, discordId: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      select: { id: true, username: true, name: true, discordId: true, email: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <BanManagerClient
      initialBans={bans.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
        expiresAt: b.expiresAt?.toISOString() ?? null,
        unbannedAt: null as null,
        user: b.user,
      }))}
      allUsers={users}
    />
  );
}
