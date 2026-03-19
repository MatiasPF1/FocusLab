// This file wires NextAuth into Next.js's API route system.
// It catches ALL requests to /api/auth/* and hands them to NextAuth.

import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers; // Export the GET and POST handlers from NextAuth to handle authentication requests
