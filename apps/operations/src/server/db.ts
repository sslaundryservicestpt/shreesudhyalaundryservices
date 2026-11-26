import 'server-only';
import { PrismaClient } from '@prisma/client';
import { DomainError } from '@shree/domain';
const globalDb = globalThis as typeof globalThis & { operationsDb?: PrismaClient };
export function database() {
  if (!process.env.DATABASE_URL)
    throw new DomainError(
      'SETUP_REQUIRED',
      'Database connection is not configured. Follow the local setup guide.',
      503,
    );
  if (!globalDb.operationsDb) globalDb.operationsDb = new PrismaClient();
  return globalDb.operationsDb;
}
