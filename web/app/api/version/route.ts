import { NextResponse } from "next/server";

// Built once per deploy, so it reports the commit Netlify built (COMMIT_REF is
// a build-time variable). The post-deploy click test polls this to know when
// its commit is live.
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({ commit: process.env.COMMIT_REF ?? null });
}
