import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session-user";
import { isOwner } from "@/lib/owner";
import { getAnnouncements } from "@/lib/announcements";
import { AnnouncementBar } from "@/components/announcement-bar";
import { DashboardNav } from "@/components/dashboard-nav";
import { WorkspaceLoading } from "@/components/workspace-loading";
import { WorkspaceTutorial } from "@/components/workspace-tutorial";
import "../workspace-navigation.css";
import "../workspace-operations.css";
import "../dashboard-shell.css";
import "../workspace-feedback.css";
import "../navigation-performance.css";
import "../workspace-refinement.css";
import "../workspace-tutorial.css";

// The dashboard reads live announcements and member data. Do not attempt
// these queries during static generation, when database access may be absent.
export const revalidate = 0;

async function Announcements() {
  return <AnnouncementBar announcements={await getAnnouncements()} />;
}

async function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <div className="workspace-shell">
    <DashboardNav user={{ email: user.email, username: user.username, tier: user.tier, discordId: user.discordId, credits: user.credits }} owner={isOwner(user.discordId)} />
    {children}
    <WorkspaceTutorial tier={user.tier}/>
  </div>;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="dash-ambient" aria-hidden />
      <Suspense fallback={null}><Announcements /></Suspense>
      <Suspense fallback={<WorkspaceLoading shell />}><WorkspaceShell>{children}</WorkspaceShell></Suspense>
    </>
  );
}
