import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ComingSoonPage } from "@/components/coming-soon";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as any).id;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");

  return (
    <ComingSoonPage
      user={user}
      active="analytics"
      title="Analytics"
      description="Google Analytics 4, Search Console, and YouTube insights — all in one place. This integration is being finalised and will be available soon."
    />
  );
}
