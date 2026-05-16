import { db } from "@/lib/db";
import { AnnouncementBar } from "@/components/announcement-bar";
import { FortifyAI } from "@/components/fortify-ai";

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
      <AnnouncementBar announcements={announcements} />
      {children}
      <FortifyAI />
    </>
  );
}
