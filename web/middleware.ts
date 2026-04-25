import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe middleware: instantiates NextAuth from the edge-compatible config only.
// Avoids pulling Prisma (Node-only) into the edge bundle.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/dashboard/:path*", "/api/ai/:path*"],
};
