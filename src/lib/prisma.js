/**
 * Prisma Client singleton — server-only.
 * Never import this in client components or NEXT_PUBLIC_ contexts.
 *
 * Uses @prisma/adapter-pg with pg.Pool to connect to Supabase PostgreSQL.
 * Uses global singleton pattern to avoid connection exhaustion during Next.js hot-reload.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });
}

function getPrismaInstance() {
  // If no instance exists, or if an older instance was cached before new models (e.g. loanScheme) were generated
  if (!globalForPrisma.prisma || !globalForPrisma.prisma.loanScheme) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

const prisma = new Proxy({}, {
  get(target, prop) {
    const instance = getPrismaInstance();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export default prisma;
