import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { requireIdentity, type Principal, type Role, type WorkState } from '@shree/domain';
import type { User } from '@supabase/supabase-js';
import {
  createPickup,
  changeWork,
  workDetail,
  listWork,
  executiveDashboardCounts,
} from '../src/server/work';
import { staffCommand } from '../src/server/staff';
import { financeCommand } from '../src/server/finance';
import { getMaster } from '../src/server/masters';
import { internalLoginEmail, queueStaffRequest, staffLogin } from '../src/server/registration';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw Error('Isolated _test PostgreSQL required.');
process.env.DATABASE_URL = url;
const db = new PrismaClient();
const req = () => randomUUID();
async function person(role: Role): Promise<Principal> {
  const p = await db.userProfile.create({
    data: {
      authUserId: req(),
      email: `security-${req()}@example.invalid`,
      displayName: 'Fictional Security User',
      memberships: { create: { role } },
    },
  });
  return { id: p.id, active: true, roles: [role], scopes: [] };
}
let admin: Principal,
  exec: Principal,
  supervisor: Principal,
  clientId: string,
  branchId: string,
  unitId: string,
  garmentId: string,
  serviceId: string;
beforeAll(async () => {
  admin = await person('ADMIN');
  exec = await person('DELIVERY_EXECUTIVE');
  supervisor = await person('SUPERVISOR');
  clientId = (await db.client.create({ data: { name: 'Fictional Security Client' } })).id;
  unitId = (await db.laundryUnit.create({ data: { name: 'Fictional Security Unit' } })).id;
  branchId = (
    await db.branch.create({ data: { name: 'Fictional Security Branch', clientId, unitId } })
  ).id;
  garmentId = (await db.garmentType.create({ data: { name: 'Fictional Security Shirt' } })).id;
  serviceId = (await db.serviceCatalog.create({ data: { name: 'Fictional Security Wash' } })).id;
});
afterAll(async () => {
  await db.$disconnect();
});
const input = () => ({
  branchId,
  unitId,
  executiveId: exec.id,
  scheduledAt: new Date().toISOString(),
  lines: [{ garmentId, serviceId }],
});
const create = async () => (await createPickup(admin, input(), req(), req())) as { id: string };
describe('current PostgreSQL authorization and replay', () => {
  it('queues one internal account without email confirmation and requires Admin activation', async () => {
    const login = staffLogin.parse('staff-' + req());
    const identity = { login, displayName: 'Registration Test', contactPhone: '+91 98765 43210' };
    const user: User = {
      id: req(),
      email: internalLoginEmail(login),
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {
        operations_staff: identity,
        role: 'ADMIN',
      },
    };
    expect(await queueStaffRequest(user, req())).toBe(false);
    expect(await db.userProfile.count({ where: { authUserId: user.id } })).toBe(0);
    user.app_metadata.operations_staff = identity;
    expect(
      await Promise.all([queueStaffRequest(user, req()), queueStaffRequest(user, req())]),
    ).toEqual([true, true]);
    const pending = await db.userProfile.findUniqueOrThrow({
      where: { authUserId: user.id },
      include: { memberships: true, scopes: true },
    });
    expect(pending).toMatchObject({ email: login, active: false, memberships: [], scopes: [] });
    expect(() =>
      requireIdentity({ id: pending.id, active: pending.active, roles: [], scopes: [] }),
    ).toThrow('disabled');
    const approve = {
      action: 'UPDATE',
      id: pending.id,
      version: pending.version,
      displayName: pending.displayName,
      roles: ['DELIVERY_EXECUTIVE'],
      scopes: [],
      active: true,
    };
    await expect(staffCommand(supervisor, approve, req(), req())).rejects.toThrow('administrator');
    await staffCommand(admin, approve, req(), req());
    expect(await queueStaffRequest(user, req())).toBe(false);
    const approved = await db.userProfile.findUniqueOrThrow({
      where: { id: pending.id },
      include: { memberships: true },
    });
    expect(approved).toMatchObject({ active: true, memberships: [{ role: 'DELIVERY_EXECUTIVE' }] });
    const history = await db.auditLog.findMany({
      where: { resourceType: 'staff', resourceId: pending.id },
      select: { action: true, after: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(history.map(({ action }) => action)).toEqual([
      'STAFF_ACCESS_REQUESTED',
      'STAFF_ACCESS_APPROVED',
    ]);
    expect(history[0].after).toEqual({ contactPhone: identity.contactPhone });
  });

  it('matches the executive pickup KPI with its scoped drilldown', async () => {
    const order = await create();
    const [counts, pending, travelling] = await Promise.all([
      executiveDashboardCounts(exec),
      listWork(exec, { view: 'pickups', stage: 'pending' }),
      listWork(exec, { view: 'pickups', stage: 'onPickup' }),
    ]);
    expect(pending.total).toBe(counts.pending);
    expect(travelling.total).toBe(counts.onPickup);
    expect(pending.rows.map((row) => row.id)).toContain(order.id);
    expect(travelling.rows.map((row) => row.id)).not.toContain(order.id);
    await expect(listWork(exec, { view: 'unbilled' })).rejects.toMatchObject({ status: 403 });
  });

  it('denies cross-client, cross-branch, cross-unit and unassigned executive reads', async () => {
    const order = await create();
    for (const scope of [{ clientId: req() }, { branchId: req() }, { unitId: req() }])
      await expect(workDetail({ ...supervisor, scopes: [scope] }, order.id)).rejects.toMatchObject({
        status: 404,
      });
    await expect(workDetail(await person('DELIVERY_EXECUTIVE'), order.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      getMaster({ ...supervisor, scopes: [{ clientId: req() }] }, 'clients', clientId),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('redacts processing, broad events, movements and other staff evidence from executive detail AND list', async () => {
    const order = await create(),
      state = (await db.workOrder.findUniqueOrThrow({ where: { id: order.id } }))
        .state as unknown as WorkState;
    state.batches.push({
      id: req(),
      lineId: state.lines[0].id,
      quantity: 1000,
      step: 0,
      status: 'PROCESSING',
      machine: 'PRIVATE MACHINE',
      operator: 'PRIVATE OPERATOR',
    });
    await db.workOrder.update({
      where: { id: order.id },
      data: { state: JSON.parse(JSON.stringify(state)) },
    });
    await db.fileAsset.create({
      data: {
        orderId: order.id,
        actorId: admin.id,
        name: 'private.pdf',
        mime: 'application/pdf',
        content: Buffer.from('fictional'),
      },
    });
    const detail = await workDetail(exec, order.id),
      list = await listWork(exec, {});
    expect(detail.movements).toEqual([]);
    expect(detail.events).toEqual([]);
    expect(detail.files).toEqual([]);
    expect(
      JSON.stringify(detail, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
    ).not.toContain('PRIVATE OPERATOR');
    expect(
      JSON.stringify(list, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
    ).not.toContain('PRIVATE MACHINE');
    expect(detail.row.state).not.toHaveProperty('lines.0.balances');
  });
  it('rechecks persisted scopes before replaying a previously successful pickup creation', async () => {
    const s = await person('SUPERVISOR');
    await db.userScope.create({ data: { userId: s.id, branchId } });
    const actor = { ...s, scopes: [{ branchId }] },
      raw = input(),
      key = req();
    await createPickup(actor, raw, key, req());
    await db.userScope.deleteMany({ where: { userId: s.id } });
    await expect(createPickup(actor, raw, key, req())).rejects.toMatchObject({ status: 404 });
  });
  it('allows an authorized repeat after transition but denies it after assignment removal', async () => {
    const order = await create(),
      key = req(),
      raw = { version: 1, command: { action: 'EN_ROUTE' } };
    const first = await changeWork(exec, order.id, raw, key, req());
    expect(await changeWork(exec, order.id, raw, key, req())).toEqual(first);
    const other = await person('DELIVERY_EXECUTIVE');
    await db.workOrder.update({ where: { id: order.id }, data: { executiveId: other.id } });
    await expect(changeWork(exec, order.id, raw, key, req())).rejects.toMatchObject({
      status: 404,
    });
  });
  it('denies replay after disabling an account or revoking its Admin role', async () => {
    const a = await person('ADMIN'),
      key = req(),
      raw = {
        action: 'POD_POLICY',
        pod: 'BLOCKED',
        approved: false,
        reason: 'Fictional security test',
      };
    await financeCommand(a, raw, key, req());
    await db.userProfile.update({ where: { id: a.id }, data: { active: false } });
    await expect(financeCommand(a, raw, key, req())).rejects.toMatchObject({ status: 403 });
    await db.userProfile.update({ where: { id: a.id }, data: { active: true } });
    await db.roleMembership.updateMany({ where: { userId: a.id }, data: { role: 'SUPERVISOR' } });
    await expect(financeCommand(a, raw, key, req())).rejects.toMatchObject({ status: 403 });
  });
  it('audits access changes, refuses self-change and non-Admin writes, and queues no external invitation', async () => {
    const target = await person('SUPERVISOR'),
      raw = {
        action: 'UPDATE',
        id: target.id,
        version: 1,
        displayName: 'Fictional Reviewed Staff',
        active: false,
        roles: ['DELIVERY_EXECUTIVE'],
        scopes: [{ branchId }],
      };
    await expect(staffCommand(supervisor, raw, req(), req())).rejects.toMatchObject({
      status: 403,
    });
    await expect(staffCommand(admin, { ...raw, id: admin.id }, req(), req())).rejects.toMatchObject(
      { code: 'SELF_ACCESS_CHANGE' },
    );
    await staffCommand(admin, raw, req(), req());
    const p = await db.userProfile.findUniqueOrThrow({
      where: { id: target.id },
      include: { memberships: true, scopes: true },
    });
    expect(p.active).toBe(false);
    expect(p.version).toBe(2);
    expect(p.memberships[0].role).toBe('DELIVERY_EXECUTIVE');
    expect(p.scopes[0].branchId).toBe(branchId);
    expect(
      await db.auditLog.count({ where: { resourceId: target.id, action: 'STAFF_ACCESS_CHANGED' } }),
    ).toBe(1);
    const queued = (await staffCommand(
      admin,
      {
        action: 'INVITE',
        email: `queued-${req()}@example.invalid`,
        displayName: 'Fictional Queued Staff',
        roles: ['SUPERVISOR'],
        scopes: [],
      },
      req(),
      req(),
    )) as { id: string };
    expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: queued.id } })).topic).toBe(
      'staff.invite',
    );
  });
});
