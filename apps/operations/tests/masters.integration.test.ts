import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Principal } from '@shree/domain';
import { saveMaster, listMasters, getMaster } from '../src/server/masters';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw Error(
    'Set TEST_DATABASE_URL to an isolated PostgreSQL database ending in _test. Apply the committed migrations first.',
  );
process.env.DATABASE_URL = url;
const db = new PrismaClient({ datasources: { db: { url } } });
let actor: Principal;
const scopeId = randomUUID();
beforeAll(async () => {
  const user = await db.userProfile.create({
    data: {
      authUserId: randomUUID(),
      email: `test-${randomUUID()}@example.invalid`,
      displayName: 'Fictional Test Admin',
      memberships: { create: { role: 'ADMIN' } },
    },
  });
  actor = { id: user.id, active: true, roles: ['ADMIN'], scopes: [] };
});
afterAll(async () => {
  await db.$disconnect();
});
describe('real PostgreSQL master transactions', () => {
  it('shares the saved client name with pickup selection before any prices are entered', async () => {
    const input = { name: 'SBHS Home Stays - Tiruchanoor' };
    const key = randomUUID();
    const record = (await saveMaster(actor, 'clients', input, null, key, randomUUID(), true)) as {
      id: string;
    };
    await saveMaster(actor, 'clients', input, null, key, randomUUID(), true);
    const sites = await listMasters(actor, 'branches', { client: record.id, q: input.name });
    expect(sites.rows.map(({ name }) => name)).toEqual([input.name]);
    expect(await db.rateContract.count({ where: { clientId: record.id } })).toBe(0);
    await saveMaster(
      actor,
      'clients',
      { name: 'SBHS Home Stays', version: 1 },
      record.id,
      randomUUID(),
      randomUUID(),
    );
    expect(await getMaster(actor, 'branches', sites.rows[0].id)).toMatchObject({
      name: 'SBHS Home Stays',
    });
  });

  it('persists a client and two branches; retries return the same record', async () => {
    const key = randomUUID(),
      input = { name: `Fictional client ${randomUUID()}` };
    const responses = await Promise.all([
      saveMaster(actor, 'clients', input, null, key, randomUUID()),
      saveMaster(actor, 'clients', input, null, key, randomUUID()),
    ]);
    expect(responses[0]).toEqual(responses[1]);
    const clientId = String((responses[0] as { id: string }).id);
    const first = (await saveMaster(
      actor,
      'branches',
      { name: 'Fictional branch A', clientId },
      null,
      randomUUID(),
      randomUUID(),
    )) as { id: string; version: number };
    await saveMaster(
      actor,
      'branches',
      { name: 'Fictional branch B', clientId },
      null,
      randomUUID(),
      randomUUID(),
    );
    const read = await getMaster(actor, 'branches', first.id);
    expect(read.clientId).toBe(clientId);
    const updated = (await saveMaster(
      actor,
      'branches',
      { name: 'Fictional branch A updated', version: first.version },
      first.id,
      randomUUID(),
      randomUUID(),
    )) as { version: number };
    expect(updated.version).toBe(2);
    await expect(
      saveMaster(
        actor,
        'branches',
        { name: 'Stale', version: 1 },
        first.id,
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toThrow('changed');
    await expect(
      saveMaster(
        actor,
        'clients',
        { version: 1, archived: true },
        clientId,
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toThrow('active branches');
    expect(await db.auditLog.count({ where: { resourceId: first.id } })).toBe(2);
  });
  it('denies invalid and archived relationships', async () => {
    await expect(
      saveMaster(
        actor,
        'branches',
        { name: 'Invalid', clientId: randomUUID() },
        null,
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toThrow('active client');
    const client = await db.client.create({ data: { name: 'Fictional archived', archived: true } });
    await expect(
      saveMaster(
        actor,
        'branches',
        { name: 'Blocked', clientId: client.id },
        null,
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toThrow('active client');
  });
  it('denies a supervisor write, disabled actor and cross-branch read', async () => {
    await expect(
      saveMaster(
        { ...actor, roles: ['SUPERVISOR'] },
        'clients',
        { name: 'Denied' },
        null,
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toThrow('administrator');
    await expect(listMasters({ ...actor, active: false }, 'clients', {})).rejects.toThrow(
      'disabled',
    );
    const client = await db.client.create({ data: { name: 'Fictional scoped client' } });
    const branch = await db.branch.create({
      data: { name: 'Fictional isolated', clientId: client.id },
    });
    const restricted = {
      ...actor,
      roles: ['SUPERVISOR'] as const,
      scopes: [{ branchId: scopeId }],
    };
    await expect(
      getMaster({ ...restricted, roles: [...restricted.roles] }, 'branches', branch.id),
    ).rejects.toThrow('unavailable');
    expect(
      (await listMasters({ ...restricted, roles: [...restricted.roles] }, 'branches', {})).meta
        .total,
    ).toBe(0);
  });
  it('enforces immutable audit and exactly one scope target in PostgreSQL', async () => {
    const audit = await db.auditLog.findFirst({ where: { actorId: actor.id } });
    if (!audit) throw Error('Expected earlier fixture audit');
    await expect(
      db.auditLog.update({ where: { id: audit.id }, data: { action: 'FORBIDDEN_REWRITE' } }),
    ).rejects.toThrow();
    await expect(db.userScope.create({ data: { userId: actor.id } })).rejects.toThrow();
  });
  it('retains archived master history and blocks reuse of an idempotency key', async () => {
    const key = randomUUID();
    const record = (await saveMaster(
      actor,
      'garments',
      { name: 'Fictional towel', unit: 'PIECE' },
      null,
      key,
      randomUUID(),
    )) as { id: string; version: number };
    await expect(
      saveMaster(actor, 'garments', { name: 'Different' }, null, key, randomUUID()),
    ).rejects.toThrow('different data');
    await saveMaster(
      actor,
      'garments',
      { version: record.version, archived: true },
      record.id,
      randomUUID(),
      randomUUID(),
    );
    expect((await getMaster(actor, 'garments', record.id)).archived).toBe(true);
  });
});
