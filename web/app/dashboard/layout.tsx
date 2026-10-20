import { db } from "@/lib/db";
import { AnnouncementBar } from "@/components/announcement-bar";
import { FortifyAI } from "@/components/fortify-ai";

// The dashboard reads live announcements and member data. Do not attempt
// these queries during static generation, when database access may be absent.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const now = new Date();
  const announcements = await db.announcement.findMany({
    where: {
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, message: true },
  });

  return (
    <>
      <div className="dash-ambient" aria-hidden />
      <AnnouncementBar announcements={announcements} />
      {children}
      <FortifyAI />
    </>
  );
}
