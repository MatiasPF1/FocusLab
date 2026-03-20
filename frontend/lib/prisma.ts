// PrismaClient is the auto-generated database client (created by `prisma generate`)
import { PrismaClient } from "@/generated/prisma/client";
// withAccelerate connects to Prisma Postgres via the prisma+postgres:// Accelerate URL
import { withAccelerate } from "@prisma/extension-accelerate";

//0-Tell TypeScript that globalThis can have a "prisma" property
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set. Check your .env file.");
}

//1-Reuse the existing client if it's already on globalThis, otherwise create a new one
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ accelerateUrl: process.env.DATABASE_URL }).$extends(withAccelerate());

//2-Cache client on globalThis in dev so hot-reloads don't exhaust DB connections
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma as unknown as PrismaClient;
}
