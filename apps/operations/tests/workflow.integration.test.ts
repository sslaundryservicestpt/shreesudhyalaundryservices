import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  type Principal,
  type WorkState,
  type WorkCommand,
  emptyBalances,
  resolveRate,
} from '@shree/domain';
import { createPickup, changeWork, workDetail, executiveDashboardCounts } from '../src/server/work';
import {
  financeCommand,
  invoiceBalance,
  previewBillingCycle,
  verifiedSalesTotals,
} from '../src/server/finance';
import { runJob } from '../src/server/jobs';
import { scopeTag, exportJob } from '../src/server/exports';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw Error('Explicit isolated TEST_DATABASE_URL ending in _test is required.');
process.env.DATABASE_URL = url;
const db = new PrismaClient();
let admin: Principal,
  exec: Principal,
  branchId: string,
  clientId: string,
  unitId: string,
  garmentId: string,
  serviceId: string;
const request = () => randomUUID();
const finance = (data: unknown, key = request()) =>
  financeCommand(admin, data, key, request()) as Promise<{ id: string }>;
beforeAll(async () => {
  const a = await db.userProfile.create({
      data: {
        authUserId: randomUUID(),
        email: `fictional-${randomUUID()}@example.invalid`,
        displayName: 'Fictional Admin',
        memberships: { create: { role: 'ADMIN' } },
      },
    }),
    e = await db.userProfile.create({
      data: {
        authUserId: randomUUID(),
        email: `fictional-${randomUUID()}@example.invalid`,
        displayName: 'Fictional Executive',
        memberships: { create: { role: 'DELIVERY_EXECUTIVE' } },
      },
    });
  admin = { id: a.id, active: true, roles: ['ADMIN'], scopes: [] };
  exec = { id: e.id, active: true, roles: ['DELIVERY_EXECUTIVE'], scopes: [] };
  clientId = (await db.client.create({ data: { name: 'Fictional Workflow Client' } })).id;
  unitId = (await db.laundryUnit.create({ data: { name: 'Fictional Unit' } })).id;
  branchId = (await db.branch.create({ data: { name: 'Fictional Branch', clientId, unitId } })).id;
  garmentId = (await db.garmentType.create({ data: { name: 'Fictional Shirt', unit: 'PIECE' } }))
    .id;
  serviceId = (
    await db.serviceCatalog.create({
      data: { name: 'Fictional Wash Fold', route: 'WASH_DRY_FOLD' },
    })
  ).id;
  await finance({
    action: 'POD_POLICY',
    pod: 'RECIPIENT',
    approved: true,
    reason: 'Explicit development-only delivery policy approval',
  });
  const existing = await db.businessPolicy.findUnique({ where: { id: 'operations' } });
  await finance({
    action: 'POLICY',
    version: existing?.version || 0,
    value: {
      approved: true,
      currency: 'DEV',
      scale: 2,
      timezone: 'UTC',
      taxMode: 'DISABLED',
      taxBps: 0,
      pricingDate: 'COMPLETION',
      pod: 'RECIPIENT',
      legalName: 'DEVELOPMENT TEST ENTITY',
      legalAddress: 'Fictional address for test only',
      registration: 'TEST ONLY',
      prefix: 'DEV-' + randomUUID().slice(0, 6).toUpperCase(),
      fallbackApproved: false,
      rounding: 'HALF_UP',
      creditNoteFormatApproved: true,
      invoiceFormatApproved: true,
    },
  });
});
afterAll(async () => {
  await db.$disconnect();
});
describe('persisted pickup to delivery', () => {
  it('uses the client item price for billing and keeps the previous price at its original date', async () => {
    const client = await db.client.create({ data: { name: 'Client-priced account' } });
    const stain = await db.serviceCatalog.create({
      data: { name: 'Client Heavy Stain', route: 'WASH_DRY_FOLD' },
    });
    const first = {
      action: 'CLIENT_RATES',
      clientId: client.id,
      serviceId,
      rates: [{ garmentId, expectedRateId: null, rate: '12.00' }],
    };
    const matrix = {
      action: first.action,
      clientId: client.id,
      rates: [
        { garmentId, serviceId, expectedRateId: null, rate: '12.00' },
        { garmentId, serviceId: stain.id, expectedRateId: null, rate: '15.00' },
      ],
    };
    await expect(
      finance({ ...matrix, rates: [matrix.rates[0], { ...matrix.rates[1], rate: '1000' }] }),
    ).rejects.toThrow('three digits');
    expect(await db.rateContract.count({ where: { clientId: client.id } })).toBe(0);
    const key = request();
    await finance(matrix, key);
    await finance(matrix, key);
    const site = await db.branch.findFirstOrThrow({ where: { clientId: client.id } });
    expect(site.name).toBe(client.name);
    const old = await db.rateContract.findFirstOrThrow({
      where: { clientId: client.id, serviceId },
    });
    await finance({
      action: 'RATE',
      clientId: null,
      branchId: site.id,
      garmentId,
      serviceId,
      rate: '99.00',
      startsAt: new Date(Date.now() - 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    const edit = { ...first, rates: [{ garmentId, expectedRateId: old.id, rate: '18.00' }] };
    await finance(edit);
    await expect(finance(edit)).rejects.toThrow('Prices changed');
    const rates = await db.rateContract.findMany({
      where: { OR: [{ clientId: client.id }, { branchId: site.id }] },
    });
    const current = rates.find((rate) => rate.rate === 1800n)!;
    const context = {
      clientId: client.id,
      branchId: site.id,
      garmentId,
      serviceId,
      unit: 'PIECE',
      currency: 'DEV',
      fallbackApproved: false,
    };
    expect(resolveRate(rates, { ...context, date: old.startsAt }).rate).toBe(1200n);
    expect(resolveRate(rates, { ...context, date: current.startsAt }).rate).toBe(1800n);
    expect(
      resolveRate(rates, { ...context, serviceId: stain.id, date: current.startsAt }).rate,
    ).toBe(1500n);
    expect(rates.find((rate) => rate.id === old.id)?.endsAt).toEqual(current.startsAt);
  });

  it('saves a branch rate sheet atomically and preserves history on a future change', async () => {
    const branch = await db.branch.create({ data: { clientId, unitId, name: 'Rate sheet site' } });
    const otherBranch = await db.branch.create({
      data: { clientId, unitId, name: 'Other rate sheet site' },
    });
    const stain = await db.serviceCatalog.create({
      data: { name: 'Stain Test', route: 'WASH_DRY_FOLD' },
    });
    const start = new Date(Date.now() - 86_400_000).toISOString();
    const switchAt = new Date(Date.now() + 86_400_000).toISOString();
    const end = new Date(Date.now() + 172_800_000).toISOString();
    const sheet = {
      action: 'BRANCH_RATES',
      branchId: branch.id,
      startsAt: start,
      endsAt: end,
      rates: [
        { garmentId, serviceId, rate: '12.00' },
        { garmentId, serviceId: stain.id, rate: '15.00' },
      ],
    };
    const token = request();
    expect(await finance(sheet, token)).toEqual(await finance(sheet, token));
    await expect(finance(sheet)).rejects.toThrow('overlapping branch rate');
    await expect(financeCommand(exec, sheet, request(), request())).rejects.toThrow();
    await expect(
      finance({ ...sheet, branchId: otherBranch.id, rates: [...sheet.rates, sheet.rates[0]] }),
    ).rejects.toThrow('one rate per garment and service');
    expect(await db.rateContract.count({ where: { branchId: otherBranch.id } })).toBe(0);
    await finance({
      ...sheet,
      branchId: otherBranch.id,
      rates: [{ garmentId, serviceId, rate: '22.00' }],
    });
    await finance({
      ...sheet,
      replace: true,
      startsAt: switchAt,
      rates: [{ garmentId, serviceId, rate: '13.00' }],
    });
    const rates = await db.rateContract.findMany({
      where: { branchId: branch.id, serviceId },
      orderBy: { startsAt: 'asc' },
    });
    expect(rates.map((rate) => rate.rate)).toEqual([1200n, 1300n]);
    expect(rates[0].endsAt.toISOString()).toBe(switchAt);
    await expect(
      db.rateContract.update({ where: { id: rates[0].id }, data: { rate: 1n } }),
    ).rejects.toThrow();
    expect(await db.rateContract.findFirst({ where: { branchId: otherBranch.id } })).toMatchObject({
      rate: 2200n,
    });
  });

  it('preserves discrepancy, prevents concurrent over-allocation, reworks and partially delivers without creating stock', async () => {
    const pickup = {
        branchId,
        unitId,
        executiveId: exec.id,
        scheduledAt: new Date().toISOString(),
        lines: [{ garmentId, serviceId }],
      },
      key = request();
    const result = await Promise.all([
      createPickup(admin, pickup, key, request()),
      createPickup(admin, pickup, key, request()),
    ]);
    expect(result[0]).toEqual(result[1]);
    const id = String((result[0] as { id: string }).id);
    const read = async () => await db.workOrder.findUniqueOrThrow({ where: { id } });
    const act = async (c: WorkCommand, who = admin) => {
      const r = await read();
      return changeWork(who, id, { version: r.version, command: c }, request(), request());
    };
    await act({ action: 'EN_ROUTE' }, exec);
    await act({ action: 'ARRIVE' }, exec);
    let s = (await read()).state as unknown as WorkState;
    const lineId = s.lines[0].id;
    await act({ action: 'COLLECT', counts: [{ lineId, quantity: 24000 }] }, exec);
    const incident = {
      action: 'RECORD_LOSS',
      orderId: id,
      lineId,
      incident: 'DAMAGED',
      quantity: 1000,
      reason: 'Damage observed at receipt',
    };
    await expect(financeCommand(exec, incident, request(), request())).rejects.toMatchObject({
      status: 403,
    });
    await finance(incident);
    expect(await db.auditLog.count({ where: { resourceId: id, action: 'RECORD_LOSS' } })).toBe(1);
    expect(((await read()).state as unknown as WorkState).lines[0].pickup).toBe(24000);

    await act({ action: 'VERIFY_RECEIPT', counts: [{ lineId, quantity: 25000 }] });
    s = (await read()).state as unknown as WorkState;
    expect(s.lines[0].discrepancy).toBe('EXTRA_ITEMS');
    await expect(
      act({
        action: 'ALLOCATE',
        lineId,
        quantity: 1000,
        machine: 'Machine A',
        operator: 'Operator A',
      }),
    ).rejects.toThrow();
    await act({ action: 'RESOLVE', lineId, reason: 'Approved extra item observation' });
    const r = await read();
    const simultaneous = await Promise.allSettled(
      [20000, 10000].map((quantity) =>
        changeWork(
          admin,
          id,
          {
            version: r.version,
            command: {
              action: 'ALLOCATE',
              lineId,
              quantity,
              machine: 'Machine A',
              operator: 'Operator A',
            },
          },
          request(),
          request(),
        ),
      ),
    );
    expect(simultaneous.filter((v) => v.status === 'fulfilled')).toHaveLength(1);
    s = (await read()).state as unknown as WorkState;
    if (s.lines[0].balances.AVAILABLE)
      await act({
        action: 'ALLOCATE',
        lineId,
        quantity: s.lines[0].balances.AVAILABLE,
        machine: 'Machine A',
        operator: 'Operator A',
      });
    s = (await read()).state as unknown as WorkState;
    let reject = 5000;
    for (const b of s.batches) {
      for (let i = 0; i < 3; i++) await act({ action: 'ADVANCE', batchId: b.id });
      const q = Math.min(reject, b.quantity);
      await act({
        action: 'QC',
        batchId: b.id,
        passed: b.quantity - q,
        fabricChecked: true,
        reason: 'QC check recorded',
      });
      reject -= q;
    }
    s = (await read()).state as unknown as WorkState;
    expect(s.lines[0].balances.REWORK).toBe(5000);
    await act({
      action: 'REWORK',
      lineId,
      quantity: 5000,
      machine: 'Rework machine',
      operator: 'Rework operator',
    });
    s = (await read()).state as unknown as WorkState;
    const b = s.batches.at(-1)!;
    for (let i = 0; i < 3; i++) await act({ action: 'ADVANCE', batchId: b.id });
    await act({ action: 'QC', batchId: b.id, passed: 5000, fabricChecked: true });
    await expect(
      act({
        action: 'VERIFY_AND_QUEUE',
        executiveId: exec.id,
        counts: [{ lineId, quantity: 24000 }],
      }),
    ).rejects.toThrow('packed count');
    expect((await read()).queue).toBe('OUTWARD');
    expect(((await read()).state as unknown as WorkState).deliveries).toHaveLength(0);
    await act({
      action: 'VERIFY_AND_QUEUE',
      executiveId: exec.id,
      routeLabel: 'Tirupati East',
      counts: [{ lineId, quantity: 25000 }],
    });
    s = (await read()).state as unknown as WorkState;
    expect((await read()).queue).toBe('DELIVERY');
    expect((await executiveDashboardCounts(exec)).queued).toBeGreaterThan(0);
    expect(await executiveDashboardCounts({ ...exec, id: randomUUID() })).toEqual({
      pending: 0,
      onPickup: 0,
      queued: 0,
      onDelivery: 0,
    });
    expect((await workDetail(exec, id)).row.state).toMatchObject({
      deliveries: [{ routeLabel: 'Tirupati East', status: 'ASSIGNED' }],
    });
    let d = s.deliveries.at(-1)!;
    await act({ action: 'DISPATCH', deliveryId: d.id }, exec);
    await act(
      {
        action: 'ACKNOWLEDGE',
        deliveryId: d.id,
        recipient: 'Fictional recipient',
        reason: 'Twenty accepted, five returning',
        quantities: [{ lineId, quantity: 20000 }],
      },
      exec,
    );
    s = (await read()).state as unknown as WorkState;
    expect(s.completedAt).toBeNull();
    expect((await read()).queue).toBe('DELIVERY_EXCEPTION');
    expect(s.lines[0].balances.TRANSIT).toBe(5000);
    expect(s.lines[0].balances.RELEASED).toBe(0);
    await expect(
      act({ action: 'RECEIVE_RETURN', deliveryId: d.id, reason: 'Attempt by driver' }, exec),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      act({
        action: 'ASSIGN_DELIVERY',
        executiveId: exec.id,
        quantities: [{ lineId, quantity: 5000 }],
      }),
    ).rejects.toThrow();
    await act({
      action: 'RECEIVE_RETURN',
      deliveryId: d.id,
      reason: 'Five items counted at the laundry',
    });
    s = (await read()).state as unknown as WorkState;
    expect(s.lines[0].balances.TRANSIT).toBe(0);
    expect(s.lines[0].balances.RELEASED).toBe(5000);
    await act({
      action: 'ASSIGN_DELIVERY',
      executiveId: exec.id,
      quantities: [{ lineId, quantity: 5000 }],
    });
    s = (await read()).state as unknown as WorkState;
    d = s.deliveries.at(-1)!;
    await act({ action: 'DISPATCH', deliveryId: d.id }, exec);
    await act(
      {
        action: 'ACKNOWLEDGE',
        deliveryId: d.id,
        recipient: 'Fictional recipient',
        reason: 'Remaining stock received',
        quantities: [{ lineId, quantity: 5000 }],
      },
      exec,
    );
    s = (await read()).state as unknown as WorkState;
    expect(s.lines[0]).toMatchObject({ pickup: 24000, inward: 25000, accepted: 25000 });
    expect(s.lines[0].balances.DELIVERED).toBe(25000);
    expect(s.completedAt).not.toBeNull();
    await expect(
      db.quantityMovement.updateMany({ where: { orderId: id }, data: { quantity: 1 } }),
    ).rejects.toThrow();
    const outsider: Principal = {
      id: admin.id,
      active: true,
      roles: ['SUPERVISOR'],
      scopes: [{ branchId: randomUUID() }],
    };
    await expect(workDetail(outsider, id)).rejects.toThrow();
  }, 120000);
});
describe('persisted financial reservations and receipts', () => {
  it('blocks bill generation while the selected cycle is still open', async () => {
    const now = Date.now();
    await expect(
      finance({
        action: 'CLOSE_CYCLE',
        branchId,
        startsAt: new Date(now - 86_400_000).toISOString(),
        endsAt: new Date(now + 86_400_000).toISOString(),
        dueAt: new Date(now + 172_800_000).toISOString(),
      }),
    ).rejects.toThrow('billing cycle is still open');
  });

  it('reserves four eligible sources once, issues immutable snapshots, generates PDF and caps concurrent payments', async () => {
    const branch = (
      await db.branch.create({ data: { name: 'Fictional Billing Branch A', clientId, unitId } })
    ).id;
    const completed = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      const lineId = randomUUID();
      const state: WorkState = {
        pickup: 'COLLECTED',
        custody: 'LAUNDRY',
        received: true,
        collectedAt: completed,
        completedAt: i < 4 ? completed : null,
        batches: [],
        deliveries: [],
        lines: [
          {
            id: lineId,
            garmentId,
            serviceId,
            name: 'Fictional shirts',
            service: 'Wash Fold',
            unit: 'PIECE',
            route: ['WASH', 'DRY', 'FOLD'],
            pickup: 10000,
            inward: 10000,
            accepted: 10000,
            discrepancy: null,
            balances: { ...emptyBalances(), [i < 4 ? 'DELIVERED' : 'AVAILABLE']: 10000 },
          },
        ],
      };
      await db.workOrder.create({
        data: {
          branchId: branch,
          clientId,
          unitId,
          executiveId: exec.id,
          scheduledAt: new Date(),
          queue: i < 4 ? 'COMPLETED' : 'PROCESSING',
          state: JSON.parse(JSON.stringify(state)),
        },
      });
    }
    const start = new Date(Date.now() - 3600000).toISOString(),
      end = new Date(Date.now() + 3600000).toISOString(),
      due = new Date(Date.now() + 86400000).toISOString();
    await finance({
      action: 'RATE',
      branchId: branch,
      clientId: null,
      garmentId,
      serviceId,
      startsAt: start,
      endsAt: due,
      rate: '12.50',
    });
    await expect(
      finance({
        action: 'RATE',
        branchId: branch,
        clientId: null,
        garmentId,
        serviceId,
        startsAt: start,
        endsAt: due,
        rate: '13.00',
      }),
    ).rejects.toThrow();
    const preview = await previewBillingCycle(admin, branch, { startsAt: start, endsAt: end });
    expect(preview.sources).toHaveLength(4);
    expect(preview.subtotal).toBe(50000n);
    const input = {
      action: 'DRAFT',
      branchId: branch,
      startsAt: start,
      endsAt: end,
      dueAt: due,
      previewFingerprint: preview.reviewFingerprint,
    };
    await expect(finance({ ...input, previewFingerprint: '0'.repeat(64) })).rejects.toThrow(
      'The pickup register changed',
    );
    const attempts = await Promise.allSettled([finance(input), finance(input)]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    const invoiceId = (
      attempts.find((a) => a.status === 'fulfilled') as PromiseFulfilledResult<{ id: string }>
    ).value.id;
    let invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.subtotal).toBe(50000n);
    expect(invoice.tax).toBe(0n);
    expect((invoice.snapshot as { excluded: unknown[] }).excluded).toHaveLength(1);
    expect(await db.billingAllocation.count({ where: { invoiceId } })).toBe(4);
    await finance({ action: 'APPROVE', invoiceId });
    const issued = await finance({ action: 'ISSUE', invoiceId });
    expect((await finance({ action: 'ISSUE', invoiceId })).id).toBe(issued.id);
    invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.number).toBeTruthy();
    await expect(
      db.invoice.update({ where: { id: invoiceId }, data: { total: 1n } }),
    ).rejects.toThrow();
    await expect(db.billingAllocation.deleteMany({ where: { invoiceId } })).rejects.toThrow();
    const pdfJob = await db.outboxEvent.findFirstOrThrow({
      where: { topic: 'invoice.pdf', payload: { path: ['invoiceId'], equals: invoiceId } },
      orderBy: { createdAt: 'desc' },
    });
    await db.outboxEvent.update({
      where: { id: pdfJob.id },
      data: { availableAt: new Date(Date.now() - 60000) },
    });
    await runJob(pdfJob.id);
    invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(
      Buffer.from(invoice.pdf || [])
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    const receiptKey = request(),
      paymentInput = {
        action: 'PAYMENT',
        clientId,
        amount: '600.00',
        reference: 'Fictional test receipt',
        receivedAt: completed,
      };
    const receipts = await Promise.all([
      finance(paymentInput, receiptKey),
      finance(paymentInput, receiptKey),
    ]);
    expect(receipts[0]).toEqual(receipts[1]);
    const paymentId = receipts[0].id;
    const allocations = await Promise.allSettled([
      finance({ action: 'ALLOCATE_PAYMENT', paymentId, invoiceId, amount: '300.00' }),
      finance({ action: 'ALLOCATE_PAYMENT', paymentId, invoiceId, amount: '300.00' }),
    ]);
    expect(allocations.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    expect((await invoiceBalance(db, invoiceId)).outstanding).toBe(20000n);
    await finance({
      action: 'CREDIT',
      invoiceId,
      amount: '50.00',
      reason: 'Approved fictional credit',
    });
    expect((await invoiceBalance(db, invoiceId)).outstanding).toBe(15000n);
    const salesBefore = await verifiedSalesTotals(admin);
    await finance({ action: 'ALLOCATE_PAYMENT', paymentId, invoiceId, amount: '150.00' });
    expect(await verifiedSalesTotals(admin)).toEqual(salesBefore);
    await finance({
      action: 'VERIFY_PAYMENT',
      paymentId,
      reason: 'Confirmed in test bank records',
    });
    await finance({ action: 'VERIFY_PAYMENT', paymentId, reason: 'Repeated test confirmation' });
    expect(
      await db.auditLog.count({ where: { resourceId: paymentId, action: 'VERIFY_PAYMENT' } }),
    ).toBe(1);
    const lookup = (totals: { currency: string; amount: bigint }[]) =>
      totals.find((row) => row.currency === invoice.currency)?.amount ?? 0n;
    expect(lookup(await verifiedSalesTotals(admin)) - lookup(salesBefore)).toBe(45000n);
    await finance({ action: 'REVERSE_PAYMENT', paymentId, reason: 'Fictional receipt reversal' });
    expect(await verifiedSalesTotals(admin)).toEqual(salesBefore);
    expect((await invoiceBalance(db, invoiceId)).outstanding).toBe(45000n);
  }, 120000);
  it('prices the same four-order fixture at 600.00 for Branch B; cancelling releases reservations', async () => {
    const branch = (
      await db.branch.create({ data: { name: 'Fictional Billing Branch B', clientId, unitId } })
    ).id;
    const completed = new Date().toISOString();
    for (let i = 0; i < 4; i++) {
      const state: WorkState = {
        pickup: 'COLLECTED',
        custody: 'LAUNDRY',
        received: true,
        collectedAt: completed,
        completedAt: completed,
        batches: [],
        deliveries: [],
        lines: [
          {
            id: randomUUID(),
            garmentId,
            serviceId,
            name: 'Fictional shirts',
            service: 'Wash Fold',
            unit: 'PIECE',
            route: ['WASH', 'DRY', 'FOLD'],
            pickup: 10000,
            inward: 10000,
            accepted: 10000,
            discrepancy: null,
            balances: { ...emptyBalances(), DELIVERED: 10000 },
          },
        ],
      };
      await db.workOrder.create({
        data: {
          branchId: branch,
          clientId,
          unitId,
          executiveId: exec.id,
          scheduledAt: new Date(),
          queue: 'COMPLETED',
          state: JSON.parse(JSON.stringify(state)),
        },
      });
    }
    const start = new Date(Date.now() - 3600000).toISOString(),
      end = new Date(Date.now() + 3600000).toISOString(),
      due = new Date(Date.now() + 86400000).toISOString();
    await finance({
      action: 'RATE',
      branchId: branch,
      clientId: null,
      garmentId,
      serviceId,
      startsAt: start,
      endsAt: due,
      rate: '15.00',
    });
    const draft = await finance({
      action: 'DRAFT',
      branchId: branch,
      startsAt: start,
      endsAt: end,
      dueAt: due,
    });
    expect((await db.invoice.findUniqueOrThrow({ where: { id: draft.id } })).subtotal).toBe(60000n);
    await finance({ action: 'CANCEL', invoiceId: draft.id });
    expect(await db.billingAllocation.count({ where: { invoiceId: draft.id } })).toBe(0);
    const replacement = await finance({
      action: 'DRAFT',
      branchId: branch,
      startsAt: start,
      endsAt: end,
      dueAt: due,
    });
    expect((await db.invoice.findUniqueOrThrow({ where: { id: replacement.id } })).subtotal).toBe(
      60000n,
    );
  }, 60000);
  it('denies cross-client allocations and stale disabled actors', async () => {
    const other = (await db.client.create({ data: { name: 'Fictional unrelated client' } })).id;
    const payment = await finance({
      action: 'PAYMENT',
      clientId: other,
      amount: '10.00',
      reference: 'Unrelated fictional receipt',
      receivedAt: new Date().toISOString(),
    });
    const invoice = await db.invoice.findFirstOrThrow({ where: { clientId, status: 'ISSUED' } });
    await expect(
      finance({
        action: 'ALLOCATE_PAYMENT',
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: '1.00',
      }),
    ).rejects.toThrow();
    await db.userProfile.update({ where: { id: admin.id }, data: { active: false } });
    try {
      await expect(
        finance({
          action: 'PAYMENT',
          clientId,
          amount: '1.00',
          reference: 'Must be refused',
          receivedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow();
    } finally {
      await db.userProfile.update({ where: { id: admin.id }, data: { active: true } });
    }
  });
});

describe('durable jobs and private exports', () => {
  it('only one concurrent worker leases a report; output has an expiry and changed scope loses access', async () => {
    const job = await db.outboxEvent.create({
      data: {
        topic: 'report.export',
        availableAt: new Date(Date.now() - 60000),
        payload: { actorId: admin.id, scopeTag: scopeTag(admin), filter: { kind: 'quantities' } },
      },
    });
    const outcomes = await Promise.all([runJob(job.id), runJob(job.id)]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const row = await db.outboxEvent.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.processedAt).not.toBeNull();
    const data = row.payload as { csv: string; expiresAt: string };
    expect(data.csv).toContain('Garment');
    expect(new Date(data.expiresAt) > new Date()).toBe(true);
    await expect(
      exportJob({ ...admin, roles: ['SUPERVISOR'], scopes: [] }, job.id),
    ).rejects.toThrow();
  }, 30000);
  it('stops retries at five attempts for unsupported jobs', async () => {
    const job = await db.outboxEvent.create({
      data: {
        topic: 'UNSUPPORTED_TEST_JOB',
        payload: {},
        attempts: 4,
        availableAt: new Date(Date.now() - 60000),
      },
    });
    await runJob(job.id);
    const row = await db.outboxEvent.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.attempts).toBe(5);
    expect(row.failedAt).not.toBeNull();
    expect(row.lastError).toBe('UNSUPPORTED_JOB_TOPIC');
    expect(await runJob(job.id)).toBe(false);
  });
  it('does not claim scheduled work before its available time', async () => {
    const job = await db.outboxEvent.create({
      data: { topic: 'work.changed', payload: {}, availableAt: new Date(Date.now() + 60000) },
    });
    expect(await runJob(job.id)).toBe(false);
    expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: job.id } })).attempts).toBe(0);
  });
});
