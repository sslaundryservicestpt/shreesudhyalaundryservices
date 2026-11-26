import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../prisma/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('release-manifest.json', root), 'utf8'));
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
// Normalize line endings so a Windows checkout does not masquerade as a migration edit.
const hash = (p: string) =>
  createHash('sha256').update(read(p).replaceAll('\r\n', '\n')).digest('hex');
describe('reviewed Prisma and SQL release baseline', () => {
  it('retains the ordered migration chain and immutable historical SQL', () => {
    expect(
      readdirSync(new URL('migrations/', root))
        .filter((x) => /^\d/.test(x))
        .sort(),
    ).toEqual(Object.keys(manifest.migrations));
    for (const [name, digest] of Object.entries(manifest.migrations))
      expect(hash('migrations/' + name + '/migration.sql'), name).toBe(digest);
    expect(hash('schema.prisma')).toBe(manifest.schemaSha256);
  });
  it('covers all Prisma models and protects SQL-only invariants', () => {
    const sql = Object.keys(manifest.migrations)
      .map((n) => read('migrations/' + n + '/migration.sql'))
      .join('\n');
    const models = [...read('schema.prisma').matchAll(/^model (\w+)\s*\{/gm)]
      .map((m) => m[1])
      .sort();
    expect([...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]).sort()).toEqual(models);
    for (const name of [
      ...manifest.requiredConstraints,
      ...manifest.requiredIndexes,
      ...manifest.requiredTriggers,
    ])
      expect(sql).toContain(name);
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL');
  });
});
