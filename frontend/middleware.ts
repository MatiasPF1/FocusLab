import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use the edge-safe config so middleware never imports Prisma or Node.js modules.
// The authorized() callback in authConfig handles the redirect to /auth.
export default NextAuth(authConfig).auth;

// Apply this middleware only to protected routes
export const config = {
  matcher: ["/dashboard/:path*"],
};
