import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { Principal, Role } from '@shree/domain';
import { crmCommand, crmQueue, executiveCrm } from '../src/server/crm';
import { captureWhatsApp, purgeExpiredWhatsApp, signedWebhookBody } from '../src/server/whatsapp';
vi.mock('server-only', () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw Error('Isolated _test PostgreSQL required.');
process.env.DATABASE_URL = url;
const db = new PrismaClient();
afterAll(() => db.$disconnect());

async function staff(role: Role, branchId?: string): Promise<Principal> {
  const row = await db.userProfile.create({
    data: {
      authUserId: randomUUID(),
      email: randomUUID() + '@example.invalid',
      displayName: 'Fictional test staff',
      memberships: { create: { role } },
      ...(branchId ? { scopes: { create: { branchId } } } : {}),
    },
  });
  return { id: row.id, active: true, roles: [role], scopes: branchId ? [{ branchId }] : [] };
}

describe('Phase 1 CRM and WhatsApp', () => {
  it('enforces scoped conversion, retries, reassignment, handoff stages and audit', async () => {
    const client = await db.client.create({ data: { name: 'CRM Test client' } });
    const branch = await db.branch.create({
      data: { name: 'CRM Test branch', clientId: client.id },
    });
    const supervisor = await staff('SUPERVISOR', branch.id);
    const outsider = await staff('SUPERVISOR');
    const first = await staff('DELIVERY_EXECUTIVE');
    const second = await staff('DELIVERY_EXECUTIVE');
    const run = (actor: Principal, input: unknown, key = randomUUID()) =>
      crmCommand(actor, input, key, randomUUID());
    const fields = {
      branchId: branch.id,
      contactName: 'Fictional contact',
      phone: '9000000000',
      address: 'Test site',
      approximateItems: 'A bag of towels',
      instructions: 'Side door',
      notes: 'Only CRM team can see this',
      windowStart: '2030-01-01T10:00:00.000Z',
      windowEnd: '2030-01-01T11:00:00.000Z',
    };
    await expect(
      run(outsider, { action: 'CREATE', source: 'PHONE', ...fields }),
    ).rejects.toMatchObject({ status: 403 });
    const { id } = (await run(supervisor, { action: 'CREATE', source: 'PHONE', ...fields })) as {
      id: string;
    };
    expect(await crmQueue(outsider, id)).toEqual([]);
    await expect(run(supervisor, { id, version: 1, action: 'CONVERT' })).rejects.toMatchObject({
      status: 409,
    });
    await run(supervisor, { id, version: 1, action: 'REVIEW', ...fields });
    const conversion = { id, version: 2, action: 'CONVERT' };
    const key = randomUUID();
    const [{ pickupId }, retry] = (await Promise.all([
      run(supervisor, conversion, key),
      run(supervisor, conversion, key),
    ])) as [{ pickupId: string }, { pickupId: string }];
    expect(retry.pickupId).toBe(pickupId);
    expect(await db.pickupRequest.count({ where: { leadId: id } })).toBe(1);
    expect(await db.workOrder.count({ where: { branchId: branch.id } })).toBe(0);
    await run(supervisor, { id: pickupId, version: 1, action: 'ASSIGN', executiveId: first.id });
    const [assigned, notices] = await executiveCrm(first);
    const [pending, , pendingTotal] = await executiveCrm(first, undefined, true);
    expect(pendingTotal).toBe(1);
    expect(pending.map((pickup) => pickup.id)).toEqual([pickupId]);
    expect(assigned[0].id).toBe(pickupId);
    expect(assigned[0].lead).not.toHaveProperty('notes');
    expect(notices[0].pickupId).toBe(pickupId);
    expect(await executiveCrm(second, pickupId)).toEqual([[], [], 0]);
    const start = { id: pickupId, version: 2, action: 'START' };
    const startKey = randomUUID();
    await run(first, start, startKey);
    await run(supervisor, { id: pickupId, version: 3, action: 'ASSIGN', executiveId: second.id });
    await expect(run(first, start, startKey)).rejects.toMatchObject({ status: 403 });
    expect(await executiveCrm(first, pickupId)).toEqual([[], [], 0]);
    await run(second, { id: pickupId, version: 4, action: 'START' });
    await run(second, { id: pickupId, version: 5, action: 'ARRIVE' });
    expect((await executiveCrm(second, pickupId))[0][0].status).toBe('REACHED_BRANCH');
    await run(supervisor, {
      id: pickupId,
      version: 6,
      action: 'CANCEL',
      reason: 'Client cancelled',
    });
    expect(await executiveCrm(second, pickupId)).toEqual([[], [], 0]);
    const audit = await db.auditLog.findFirst({
      where: { resourceId: pickupId, action: 'PICKUP_CANCEL' },
    });
    expect(audit?.after).toMatchObject({ reason: 'Client cancelled' });
  });

  it('verifies raw signatures, deduplicates delivery, matches sites and purges raw bytes', async () => {
    const digits = String(Date.now()).slice(-9);
    const local = '8' + digits;
    const client = await db.client.create({ data: { name: 'WhatsApp Test client' } });
    const branch = await db.branch.create({
      data: { name: 'WhatsApp Test branch', clientId: client.id, phone: '+91 ' + local },
    });
    const known = randomUUID(),
      unknown = randomUUID();
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'test-number' },
                messages: [
                  { id: known, from: '91' + local, text: { body: 'Please arrange a pickup' } },
                  { id: unknown, from: '5544091234567' },
                ],
              },
            },
          ],
        },
      ],
    });
    const secret = 'test-webhook-key';
    const request = (signature: string) =>
      new Request('https://example.invalid', {
        method: 'POST',
        body,
        headers: { 'X-Hub-Signature-256': signature },
      });
    await expect(
      signedWebhookBody(request('sha256=' + '0'.repeat(64)), secret),
    ).rejects.toMatchObject({ status: 403 });
    const raw = await signedWebhookBody(
      request('sha256=' + createHmac('sha256', secret).update(body).digest('hex')),
      secret,
    );
    await Promise.all([captureWhatsApp(raw, 'test-number'), captureWhatsApp(raw, 'test-number')]);
    const events = await db.whatsAppInbound.findMany({
      where: { id: { in: [known, unknown] } },
      include: { lead: { include: { pickup: true } } },
    });
    expect(events).toHaveLength(2);
    expect(events.find((event) => event.id === known)?.lead).toMatchObject({
      branchId: branch.id,
      status: 'NEW',
      pickup: null,
    });
    expect(events.find((event) => event.id === unknown)?.lead).toMatchObject({
      branchId: null,
      status: 'NEW',
      pickup: null,
    });
    await db.whatsAppInbound.updateMany({
      where: { id: { in: [known, unknown] } },
      data: { expiresAt: new Date(0) },
    });
    await purgeExpiredWhatsApp();
    expect(
      await db.whatsAppInbound.count({ where: { id: { in: [known, unknown] }, payload: null } }),
    ).toBe(2);
  });
});
