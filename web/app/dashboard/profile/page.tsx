import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { ProfileEditor } from "@/components/profile-editor";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: (session.user as any).id },
    include: { profile: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav user={user} active="profile" />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your profile</h1>
          <p className="mt-3 text-text-muted">
            Visible in the member directory. Better profiles = better matches.
          </p>
        </div>

        <div className="card p-5 sm:p-6">
          <ProfileEditor
            initial={
              user.profile
                ? {
                    niche: user.profile.niche,
                    skills: user.profile.skills,
                    lookingFor: user.profile.lookingFor,
                    canOffer: user.profile.canOffer,
                    socials: user.profile.socials as Record<string, string> | null,
                  }
                : null
            }
          />
        </div>
      </main>
    </div>
  );
}
