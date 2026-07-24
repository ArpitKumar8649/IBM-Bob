import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma client singleton (Prisma 7 driver-adapter pattern).
 *
 * Prisma 7 no longer reads the connection URL from the schema — instead we
 * pass a driver adapter (PrismaPg) to the client constructor. The singleton
 * avoids exhausting DB connections during dev hot-reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://user:password@localhost:5432/writers_room",
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
