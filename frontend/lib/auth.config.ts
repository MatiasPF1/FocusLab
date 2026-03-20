import type { NextAuthConfig } from "next-auth";

// This config is edge-safe: no Prisma, no Node.js-only imports.
// Used exclusively by middleware to check JWT session tokens.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/Authentication_Component", // Redirect to this page for sign-in
  },




  callbacks: {
    // Called on every request matched by the middleware.
    // Returns true (allow) or false/redirect (block).
    authorized({ auth }) {
      return !!auth; // allow if a valid session exists
    },
  },
  providers: [], // providers only needed in lib/auth.ts (Node.js context)
};
