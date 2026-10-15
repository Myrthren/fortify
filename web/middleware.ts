import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  if (process.env.FORTIFY_ENV !== "staging") return NextResponse.next();
  // Staging tests AI drafts; it cannot receive production jobs or integrations.
  if (/^\/api\/(cron|outbound|stripe|paypal|whop|integrations|shopify|media)(\/|$)/.test(req.nextUrl.pathname)) {
    return new NextResponse("Unavailable in staging", { status: 404 });
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
