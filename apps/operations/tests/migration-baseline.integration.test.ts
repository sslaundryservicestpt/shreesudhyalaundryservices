import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'node:fs';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw Error('Isolated _test PostgreSQL required.');
const db = new PrismaClient({ datasources: { db: { url } } });
const manifest = JSON.parse(
  readFileSync(new URL('../prisma/release-manifest.json', import.meta.url), 'utf8'),
);
afterAll(async () => {
  await db.$disconnect();
});
describe('applied PostgreSQL baseline', () => {
  it('has every reviewed migration applied without rolled-back or incomplete entries', async () => {
    const rows = await db.$queryRaw<
      { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
    >`SELECT migration_name,finished_at,rolled_back_at FROM _prisma_migrations`;
    for (const name of Object.keys(manifest.migrations))
      expect(
        rows.some((r) => r.migration_name === name && r.finished_at && !r.rolled_back_at),
        name,
      ).toBe(true);
    expect(rows.some((r) => !r.finished_at && !r.rolled_back_at)).toBe(false);
  });
  it('retains required indexes, constraints, triggers, RLS, and every scalar Prisma column', async () => {
    const constraints = await db.$queryRaw<
      { name: string }[]
    >`SELECT conname AS name FROM pg_constraint WHERE connamespace='public'::regnamespace`;
    const indexes = await db.$queryRaw<
      { name: string }[]
    >`SELECT indexname AS name FROM pg_indexes WHERE schemaname='public'`;
    const triggers = await db.$queryRaw<
      { name: string }[]
    >`SELECT tgname AS name FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'D'`;
    for (const [required, rows] of [
      [manifest.requiredConstraints, constraints],
      [manifest.requiredIndexes, indexes],
      [manifest.requiredTriggers, triggers],
    ] as [string[], { name: string }[]][])
      for (const name of required)
        expect(
          rows.map((r) => r.name),
          name,
        ).toContain(name);
    const columns = await db.$queryRaw<
      { table_name: string; column_name: string }[]
    >`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'`;
    const tables = await db.$queryRaw<
      { name: string; protected: boolean }[]
    >`SELECT relname AS name,relrowsecurity AS protected FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'`;
    for (const model of Prisma.dmmf.datamodel.models) {
      expect(tables.find((t) => t.name === model.name)?.protected, model.name).toBe(true);
      for (const field of model.fields.filter((f) => f.kind !== 'object'))
        expect(
          columns.some((c) => c.table_name === model.name && c.column_name === field.name),
          model.name + '.' + field.name,
        ).toBe(true);
    }
  });
});
