import { PrismaClient } from '@prisma/client';

// Singleton Prisma client — avoids connection pool exhaustion during hot reload.
// DATABASE_URL must use the Neon pooler endpoint with:
//   ?sslmode=require&pgbouncer=true&connection_limit=5&pool_timeout=0
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
