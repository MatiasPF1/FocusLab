// This file wires NextAuth into Next.js's API route system.
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers; // Export the GET and POST handlers from NextAuth to handle authentication requests
