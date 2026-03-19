// PrismaClient is the auto-generated database client (created by `prisma generate`)
import { PrismaClient } from "@/generated/prisma/client";
// PrismaPg is a Postgres-specific driver adapter required to connect to Postgres
import { PrismaPg } from "@prisma/adapter-pg";




//0-Create a Postgres connection using the DATABASE_URL from your .env file
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! }); // The "!" tells TypeScript "trust me, this value exists"

//1-Tell TypeScript that globalThis can have a "prisma" property
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

//2-Reuse the existing client if it's already on globalThis, otherwise create a new one
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

//3-Cache client on globalThis in dev so hot-reloads don't exhaust DB connections
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
