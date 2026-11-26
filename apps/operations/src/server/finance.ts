import 'server-only';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  approvedPolicy,
  policyInput,
  resolveRate,
  lineAmount,
  taxAmount,
  money,
  requireAdmin,
  DomainError,
  type Policy,
  type Principal,
  type WorkState,
} from '@shree/domain';
import { database } from './db';
import { command, audit, snapshot, type Tx } from './commands';
import { ensureClientPickupSite } from './masters';

const date = z.iso.datetime(),
  id = z.uuid(),
  amount = z.string().max(40),
  reason = z.string().trim().min(3).max(500);
export const financeInput = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('POD_POLICY'),
      pod: z.enum(['BLOCKED', 'RECIPIENT', 'EVIDENCE']),
      approved: z.boolean(),
      reason,
    })
    .strict(),
  z.object({ action: z.literal('RETRY_JOB'), jobId: id }).strict(),
  z
    .object({ action: z.literal('POLICY'), version: z.number().int().min(0), value: policyInput })
    .strict(),
  z
    .object({
      action: z.literal('RATE'),
      branchId: id.nullable(),
      clientId: id.nullable(),
      garmentId: id,
      serviceId: id,
      startsAt: date,
      endsAt: date,
      rate: amount,
    })
    .strict(),
  z
    .object({
      action: z.literal('BRANCH_RATES'),
      branchId: id,
      startsAt: date,
      endsAt: date,
      replace: z.boolean().optional(),
      rates: z
        .array(z.object({ garmentId: id, serviceId: id, rate: amount }).strict())
        .min(1)
        .max(200),
    })
    .strict(),
  z
    .object({
      action: z.literal('CLIENT_RATES'),
      clientId: id,
      serviceId: id.optional(),
      rates: z
        .array(
          z
            .object({
              garmentId: id,
              serviceId: id.optional(),
              rate: amount,
              expectedRateId: id.nullable(),
            })
            .strict(),
        )
        .min(1)
        .max(200),
    })
    .strict(),
  z
    .object({
      action: z.enum(['DRAFT', 'CLOSE_CYCLE']),
      branchId: id,
      startsAt: date,
      endsAt: date,
      dueAt: date,
      previewFingerprint: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('SCHEDULE_DRAFT'),
      branchId: id,
      startsAt: date,
      endsAt: date,
      dueAt: date,
      runAt: date,
    })
    .strict(),
  z.object({ action: z.enum(['APPROVE', 'ISSUE', 'CANCEL', 'RETRY_PDF']), invoiceId: id }).strict(),
  z
    .object({
      action: z.literal('PAYMENT'),
      clientId: id,
      amount,
      reference: reason,
      receivedAt: date,
    })
    .strict(),
  z
    .object({ action: z.literal('ALLOCATE_PAYMENT'), paymentId: id, invoiceId: id, amount })
    .strict(),
  z.object({ action: z.literal('VERIFY_PAYMENT'), paymentId: id, reason }).strict(),
  z
    .object({
      action: z.literal('RECORD_LOSS'),
      orderId: id,
      lineId: id,
      incident: z.enum(['MISSING', 'DAMAGED']),
      quantity: z.number().int().positive().max(1_000_000_000),
      reason,
    })
    .strict(),
  z.object({ action: z.literal('REVERSE_PAYMENT'), paymentId: id, reason }).strict(),
  z.object({ action: z.literal('CREDIT'), invoiceId: id, amount, reason }).strict(),
  z
    .object({
      action: z.literal('EXPENSE'),
      category: reason,
      description: reason,
      amount,
      incurredAt: date,
    })
    .strict(),
  z
    .object({ action: z.enum(['APPROVE_EXPENSE', 'PAY_EXPENSE', 'REJECT_EXPENSE']), expenseId: id })
    .strict(),
]);
export async function policy(tx: Tx) {
  return approvedPolicy(
    (await tx.businessPolicy.findUnique({ where: { id: 'operations' } }))?.value,
  );
}
export async function branchRateCatalog(actor: Principal) {
  requireAdmin(actor);
  const [settings, garments, services] = await Promise.all([
    database().businessPolicy.findUnique({ where: { id: 'operations' } }),
    database().garmentType.findMany({
      where: { archived: false, unit: 'PIECE' },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    database().serviceCatalog.findMany({
      where: { archived: false },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const p = policyInput.safeParse(settings?.value);
  if (p.success && p.data.approved)
    return { garments, services, currency: p.data.currency, scale: p.data.scale };
}
export async function invoiceBalance(tx: Tx, id: string) {
  const row = await tx.invoice.findUnique({
    where: { id },
    include: { credits: true, receipts: { include: { payment: true } } },
  });
  if (!row) throw new DomainError('NOT_FOUND', 'Invoice not found.', 404);
  const credits = row.credits.reduce((n, c) => n + c.amount, 0n),
    paid = row.receipts.filter((a) => !a.payment.reversedAt).reduce((n, a) => n + a.amount, 0n);
  return { row, credits, paid, outstanding: row.total - credits - paid };
}
function conflict(message: string): never {
  throw new DomainError('FINANCE_BLOCKED', message, 409);
}
const fingerprint = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
type BillingPeriod = { startsAt: string; endsAt: string };
type RegisterLine = {
  orderId: string;
  orderNumber: string;
  collectedAt?: string | null;
  lineId: string;
  garment: string;
  service: string;
  quantity: number;
  unit: string;
  amount: string | null;
  rateId?: string;
  rate?: string;
  rateScope?: string;
  effectiveAt?: string;
  pricingDate?: string;
};

async function prepareBillingCycle(
  db: Tx,
  branch: { id: string; clientId: string },
  period: BillingPeriod,
  policy?: Policy,
  allowUnpriced = false,
) {
  const orders = await db.workOrder.findMany({
    where: { branchId: branch.id, billing: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 501,
    select: { id: true, number: true, state: true },
  });
  if (orders.length > 500)
    conflict('More than 500 unbilled orders require an operator-reviewed billing run.');
  const rates = policy
    ? await db.rateContract.findMany({
        where: {
          currency: policy.currency,
          OR: [
            { branchId: branch.id },
            { branchId: null, clientId: branch.clientId },
            ...(policy.fallbackApproved ? [{ branchId: null, clientId: null }] : []),
          ],
        },
      })
    : [];
  const lines: RegisterLine[] = [];
  const excluded: { id: string; number: string; reason: string }[] = [];
  const sources: string[] = [];
  const unpriced = new Set<string>();
  const start = new Date(period.startsAt);
  const end = new Date(period.endsAt);
  let subtotal = 0n;
  for (const order of orders) {
    const state = order.state as unknown as WorkState;
    const completion = new Date(state.completedAt ?? '');
    let why = '';
    if (
      !Number.isFinite(completion.valueOf()) ||
      !state.lines.every(
        (line) =>
          line.accepted !== null && !line.discrepancy && line.accepted === line.balances.DELIVERED,
      )
    )
      why = 'Order is not fully reconciled and acknowledged';
    else if (completion < start || completion >= end)
      why = 'Completion falls outside this half-open cycle';
    if (why) {
      excluded.push({ id: order.id, number: String(order.number), reason: why });
      continue;
    }
    const pricingDate =
      policy?.pricingDate === 'COLLECTION' ? new Date(state.collectedAt ?? '') : completion;
    for (const line of state.lines) {
      if (!line.accepted) continue;
      const source: RegisterLine = {
        orderId: order.id,
        orderNumber: String(order.number),
        collectedAt: state.collectedAt,
        lineId: line.id,
        garment: line.name,
        service: line.service,
        quantity: line.accepted,
        unit: line.unit,
        amount: null,
      };
      if (policy) {
        try {
          if (!Number.isFinite(pricingDate.valueOf()))
            throw new DomainError(
              'MISSING_PICKUP_DATE',
              'Collection date is required by the pricing policy.',
              409,
            );
          const rate = resolveRate(rates, {
            branchId: branch.id,
            clientId: branch.clientId,
            garmentId: line.garmentId,
            serviceId: line.serviceId,
            unit: line.unit,
            currency: policy.currency,
            date: pricingDate,
            fallbackApproved: policy.fallbackApproved,
          });
          const amount = lineAmount(line.accepted, rate.rate);
          subtotal += amount;
          Object.assign(source, {
            rateId: rate.id,
            rate: String(rate.rate),
            rateScope: rate.branchId ? 'BRANCH' : rate.clientId ? 'CLIENT' : 'FALLBACK',
            effectiveAt: rate.startsAt.toISOString(),
            pricingDate: pricingDate.toISOString(),
            amount: String(amount),
          });
        } catch (error) {
          if (!allowUnpriced || !(error instanceof DomainError)) throw error;
          unpriced.add(line.name + ' · ' + line.service + ' — ' + error.message);
        }
      }
      lines.push(source);
    }
    sources.push(order.id);
  }
  const reviewFingerprint = fingerprint({
    branch: branch.id,
    start: period.startsAt,
    end: period.endsAt,
    policy,
    sources,
    lines,
  });
  return { lines, excluded, sources, subtotal, unpriced: [...unpriced], reviewFingerprint };
}

export async function previewBillingCycle(
  actor: Principal,
  branchId: string,
  period: BillingPeriod,
) {
  requireAdmin(actor);
  const db = database();
  const [branch, settings] = await Promise.all([
    db.branch.findUnique({ where: { id: id.parse(branchId) }, include: { client: true } }),
    db.businessPolicy.findUnique({ where: { id: 'operations' } }),
  ]);
  if (!branch || branch.archived || branch.client.archived)
    throw new DomainError('NOT_FOUND', 'Choose an active client branch.', 404);
  const parsed = policyInput.safeParse(settings?.value);
  const policy = parsed.success && parsed.data.approved ? parsed.data : undefined;
  return { branch, policy, ...(await prepareBillingCycle(db, branch, period, policy, true)) };
}

export async function financeCommand(
  actor: Principal,
  raw: unknown,
  key: string,
  requestId: string,
) {
  requireAdmin(actor);
  const c = financeInput.parse(raw);
  return command(
    actor,
    key,
    requestId,
    'finance',
    c,
    async (tx, fresh) => {
      requireAdmin(fresh);
      let resourceId: string = randomUUID(),
        resourceType = 'finance';
      // The shared finance lock keeps source reservations, receipts and balances atomic.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('finance.commands',0))`;
      if (c.action === 'POD_POLICY') {
        await tx.businessPolicy.upsert({
          where: { id: 'delivery' },
          create: {
            id: 'delivery',
            value: snapshot({ pod: c.pod, approved: c.approved, reason: c.reason }),
          },
          update: {
            value: snapshot({ pod: c.pod, approved: c.approved, reason: c.reason }),
            version: { increment: 1 },
          },
        });
        await audit(
          tx,
          fresh,
          'POD_POLICY_REVIEWED',
          'policy',
          resourceId,
          requestId,
          undefined,
          c,
        );
        return { id: 'delivery' };
      }
      if (c.action === 'POLICY') {
        const old = await tx.businessPolicy.findUnique({ where: { id: 'operations' } });
        if ((old?.version || 0) !== c.version) conflict('Policy changed. Refresh before saving.');
        if (old) {
          const previous = old.value as Record<string, unknown>;
          if (previous.currency !== c.value.currency || previous.scale !== c.value.scale) {
            const count =
              (await tx.rateContract.count()) +
              (await tx.invoice.count()) +
              (await tx.payment.count()) +
              (await tx.expense.count());
            if (count)
              conflict(
                'Currency and decimal precision cannot change after financial records exist.',
              );
          }
        }
        await tx.businessPolicy.upsert({
          where: { id: 'operations' },
          create: { id: 'operations', value: snapshot(c.value) },
          update: { value: snapshot(c.value), version: { increment: 1 } },
        });
        await audit(
          tx,
          fresh,
          'POLICY_APPROVED',
          'policy',
          resourceId,
          requestId,
          old?.value,
          c.value,
        );
        return { id: 'operations' };
      }
      if (c.action === 'RETRY_JOB') {
        const job = await tx.outboxEvent.findUnique({ where: { id: c.jobId } });
        if (!job?.failedAt || job.processedAt) conflict('Only failed jobs can be retried.');
        await tx.outboxEvent.update({
          where: { id: job.id },
          data: {
            attempts: 0,
            failedAt: null,
            lastError: null,
            lockedUntil: null,
            leaseToken: null,
            availableAt: new Date(),
          },
        });
        await audit(tx, fresh, 'JOB_RETRY', 'job', job.id, requestId);
        return { id: job.id };
      }
      if (c.action === 'VERIFY_PAYMENT') {
        const receipt = await tx.payment.findUnique({ where: { id: c.paymentId } });
        if (!receipt || receipt.reversedAt)
          conflict('Only an active recorded receipt can be verified.');
        const existing = await tx.auditLog.findFirst({
          where: { resourceType: 'payment', resourceId: receipt.id, action: 'VERIFY_PAYMENT' },
        });
        if (!existing)
          await audit(tx, fresh, 'VERIFY_PAYMENT', 'payment', receipt.id, requestId, undefined, {
            reason: c.reason,
            amount: receipt.amount.toString(),
            currency: receipt.currency,
          });
        return { id: receipt.id };
      }
      if (c.action === 'RECORD_LOSS') {
        const order = await tx.workOrder.findUnique({ where: { id: c.orderId } });
        const line = (order?.state as unknown as WorkState | undefined)?.lines.find(
          (item) => item.id === c.lineId,
        );
        if (
          !order ||
          !line ||
          !line.pickup ||
          c.quantity > Math.max(line.pickup, line.inward ?? 0) ||
          (line.unit === 'PIECE' && c.quantity % 1000 !== 0)
        )
          conflict('Choose a collected item and a valid incident quantity.');
        await audit(tx, fresh, 'RECORD_LOSS', 'loss', order.id, requestId, undefined, {
          lineId: line.id,
          garment: line.name,
          unit: line.unit,
          incident: c.incident,
          quantity: c.quantity,
          reason: c.reason,
        });
        return { id: order.id };
      }
      const p = await policy(tx);
      if (c.action === 'SCHEDULE_DRAFT') {
        if (
          new Date(c.endsAt) <= new Date(c.startsAt) ||
          new Date(c.dueAt) < new Date(c.endsAt) ||
          new Date(c.runAt) <= new Date()
        )
          conflict('Schedule a future run with a valid half-open period and due date.');
        const branch = await tx.branch.findUnique({ where: { id: c.branchId } });
        if (!branch || branch.archived) conflict('Choose an active branch.');
        await tx.outboxEvent.create({
          data: {
            id: resourceId,
            topic: 'billing.draft',
            availableAt: new Date(c.runAt),
            payload: {
              actorId: fresh.id,
              key: randomUUID(),
              branchId: c.branchId,
              startsAt: c.startsAt,
              endsAt: c.endsAt,
              dueAt: c.dueAt,
            },
          },
        });
        resourceType = 'billingSchedule';
      } else if (c.action === 'CLIENT_RATES') {
        const rows = c.rates.map((rate) => {
          const serviceId = rate.serviceId ?? c.serviceId;
          if (!serviceId || (c.serviceId && rate.serviceId && c.serviceId !== rate.serviceId))
            conflict('Choose a service for each price.');
          return { ...rate, serviceId };
        });
        const keyFor = (rate: { garmentId: string; serviceId: string }) =>
          rate.garmentId + ':' + rate.serviceId;
        if (new Set(rows.map(keyFor)).size !== rows.length)
          conflict('Enter one price per item and service.');
        const ids = [...new Set(rows.map((rate) => rate.garmentId))];
        const serviceIds = [...new Set(rows.map((rate) => rate.serviceId))];
        const [client, services, garments, clock] = await Promise.all([
          tx.client.findUnique({ where: { id: c.clientId } }),
          tx.serviceCatalog.count({ where: { id: { in: serviceIds }, archived: false } }),
          tx.garmentType.count({ where: { id: { in: ids }, archived: false, unit: 'PIECE' } }),
          tx.$queryRaw<
            { now: Date }[]
          >`SELECT date_trunc('milliseconds', clock_timestamp() + interval '1 millisecond') AS now`,
        ]);
        if (!client || client.archived) conflict('Choose an active client.');
        if (services !== serviceIds.length || garments !== ids.length)
          conflict('Choose an active service and active per-piece items.');
        const startsAt = clock[0].now;
        const scope = {
          clientId: client.id,
          clientManaged: true,
          currency: p.currency,
          unit: 'PIECE',
        };
        const previous = await tx.rateContract.findMany({
          where: {
            ...scope,
            OR: rows.map(({ garmentId, serviceId }) => ({ garmentId, serviceId })),
            endsAt: { gt: startsAt },
          },
        });
        const previousRates = new Map(previous.map((rate) => [keyFor(rate), rate]));
        if (
          previousRates.size !== previous.length ||
          rows.some((rate) => {
            const prior = previousRates.get(keyFor(rate));
            return (
              (prior?.id ?? null) !== rate.expectedRateId || (prior && prior.startsAt >= startsAt)
            );
          })
        )
          conflict('Prices changed while you were editing. Reload the client and try again.');
        const changes = rows
          .map((row) => {
            if (!/^\d{1,3}(\.\d{1,3})?$/.test(row.rate))
              conflict('Enter prices with up to three digits before the decimal.');
            return { ...row, price: money(row.rate, p.scale) };
          })
          .filter((row) => previousRates.get(keyFor(row))?.rate !== row.price);
        for (const row of changes) {
          const prior = previousRates.get(keyFor(row));
          if (!prior) continue;
          await tx.rateContract.update({ where: { id: prior.id }, data: { endsAt: startsAt } });
          await audit(
            tx,
            fresh,
            'END_CLIENT_RATE',
            'rate',
            prior.id,
            requestId,
            { endsAt: prior.endsAt },
            { endsAt: startsAt },
          );
        }
        await tx.rateContract.createMany({
          data: changes.map((row) => ({
            ...scope,
            garmentId: row.garmentId,
            serviceId: row.serviceId,
            rate: row.price,
            startsAt,
            endsAt: new Date('9999-12-31T00:00:00.000Z'),
          })),
        });
        await ensureClientPickupSite(tx, client, fresh, requestId);
        resourceId = client.id;
        resourceType = 'client';
      } else if (c.action === 'BRANCH_RATES') {
        const startsAt = new Date(c.startsAt);
        const endsAt = new Date(c.endsAt);
        if (endsAt <= startsAt) conflict('Effective end must follow start.');
        if (c.replace && startsAt <= new Date())
          conflict('Choose a future start date to replace an existing rate.');
        const branch = await tx.branch.findUnique({
          where: { id: c.branchId },
          include: { client: true },
        });
        if (!branch || branch.archived || branch.client.archived)
          conflict('Choose an active branch and client.');
        const pairs = c.rates.map(({ garmentId, serviceId }) => ({ garmentId, serviceId }));
        if (
          new Set(pairs.map(({ garmentId, serviceId }) => garmentId + ':' + serviceId)).size !==
          pairs.length
        )
          conflict('Enter only one rate per garment and service.');
        const garmentIds = [...new Set(pairs.map((row) => row.garmentId))];
        const serviceIds = [...new Set(pairs.map((row) => row.serviceId))];
        const [garments, services, overlap] = await Promise.all([
          tx.garmentType.findMany({
            where: { id: { in: garmentIds }, archived: false, unit: 'PIECE' },
          }),
          tx.serviceCatalog.findMany({ where: { id: { in: serviceIds }, archived: false } }),
          tx.rateContract.findMany({
            where: {
              branchId: branch.id,
              clientId: null,
              unit: 'PIECE',
              currency: p.currency,
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
              OR: pairs,
            },
          }),
        ]);
        if (garments.length !== garmentIds.length || services.length !== serviceIds.length)
          conflict('Choose active per-piece garments and active services.');
        const blocked = overlap.find(
          (row) => !c.replace || row.startsAt >= startsAt || row.endsAt > endsAt,
        );
        if (blocked) {
          const garment = garments.find((row) => row.id === blocked.garmentId)?.name;
          const service = services.find((row) => row.id === blocked.serviceId)?.name;
          conflict(`An overlapping branch rate already exists for ${garment} / ${service}.`);
        }
        for (const prior of overlap) {
          await tx.rateContract.update({ where: { id: prior.id }, data: { endsAt: startsAt } });
          await audit(
            tx,
            fresh,
            'END_BRANCH_RATE',
            'rate',
            prior.id,
            requestId,
            { endsAt: prior.endsAt },
            { endsAt: startsAt },
          );
        }
        await tx.rateContract.createMany({
          data: c.rates.map(({ garmentId, serviceId, rate }) => ({
            branchId: branch.id,
            garmentId,
            serviceId,
            startsAt,
            endsAt,
            unit: 'PIECE',
            currency: p.currency,
            rate: money(rate, p.scale),
          })),
        });
        resourceId = branch.id;
        resourceType = 'branch';
      } else if (c.action === 'RATE') {
        if (c.branchId && c.clientId)
          conflict('Choose branch-specific or client-default pricing, not both.');
        if (!c.branchId && !c.clientId && !p.fallbackApproved)
          conflict('Fallback pricing has not been approved.');
        if (new Date(c.endsAt) <= new Date(c.startsAt))
          conflict('Effective end must follow start.');
        const g = await tx.garmentType.findUnique({ where: { id: c.garmentId } }),
          s = await tx.serviceCatalog.findUnique({ where: { id: c.serviceId } });
        if (!g || g.archived || !s || s.archived)
          conflict('Choose active garment and service records.');
        if (c.branchId) {
          const b = await tx.branch.findUnique({
            where: { id: c.branchId },
            include: { client: true },
          });
          if (!b || b.archived || b.client.archived)
            conflict('Choose an active branch and client.');
        }
        if (c.clientId) {
          const client = await tx.client.findUnique({ where: { id: c.clientId } });
          if (!client || client.archived) conflict('Choose an active client.');
        }
        const overlap = await tx.rateContract.count({
          where: {
            branchId: c.branchId,
            clientId: c.clientId,
            garmentId: g.id,
            serviceId: s.id,
            unit: g.unit,
            currency: p.currency,
            startsAt: { lt: new Date(c.endsAt) },
            endsAt: { gt: new Date(c.startsAt) },
          },
        });
        if (overlap) conflict('An overlapping rate already exists for this scope and item.');
        await tx.rateContract.create({
          data: {
            id: resourceId,
            branchId: c.branchId,
            clientId: c.clientId,
            garmentId: g.id,
            serviceId: s.id,
            unit: g.unit,
            currency: p.currency,
            rate: money(c.rate, p.scale),
            startsAt: new Date(c.startsAt),
            endsAt: new Date(c.endsAt),
          },
        });
        resourceType = 'rate';
      } else if (c.action === 'DRAFT' || c.action === 'CLOSE_CYCLE') {
        if (c.action === 'CLOSE_CYCLE' && new Date(c.endsAt) > new Date())
          conflict('The billing cycle is still open. Generate its bill after the cycle end.');
        if (new Date(c.endsAt) <= new Date(c.startsAt) || new Date(c.dueAt) < new Date(c.endsAt))
          conflict('Use a positive half-open period and a due date on or after its end.');
        const branch = await tx.branch.findUnique({
          where: { id: c.branchId },
          include: { client: true },
        });
        if (!branch) conflict('Branch not found.');
        const { lines, excluded, sources, subtotal, reviewFingerprint } = await prepareBillingCycle(
          tx,
          branch,
          c,
          p,
        );
        if (c.previewFingerprint && c.previewFingerprint !== reviewFingerprint)
          conflict(
            'The pickup register changed. Reload the billing cycle and review it before generating a draft.',
          );
        if (!sources.length) conflict('No eligible unbilled orders fall within this cycle.');
        if (subtotal > 9_000_000_000_000_000_000n)
          conflict('Draft exceeds the supported database amount limit. Split the billing cycle.');
        const tax = taxAmount(subtotal, p),
          frozen = snapshot({
            policy: p,
            policyFingerprint: fingerprint(p),
            branch: { name: branch.name, address: branch.address, client: branch.client.name },
            lines,
            excluded,
            sources,
            period: { start: c.startsAt, end: c.endsAt },
            rounding: 'HALF_UP: line amounts then invoice tax',
            subtotal: String(subtotal),
            tax: String(tax),
            total: String(subtotal + tax),
          });
        if (subtotal + tax > 9_000_000_000_000_000_000n)
          conflict('Invoice including tax exceeds the supported amount limit.');
        await tx.invoice.create({
          data: {
            id: resourceId,
            branchId: branch.id,
            clientId: branch.clientId,
            currency: p.currency,
            subtotal,
            tax,
            total: subtotal + tax,
            snapshot: frozen,
            startsAt: new Date(c.startsAt),
            endsAt: new Date(c.endsAt),
            dueAt: new Date(c.dueAt),
            allocations: { create: sources.map((orderId) => ({ orderId })) },
          },
        });
        resourceType = 'invoice';
      } else if (
        'invoiceId' in c &&
        ['APPROVE', 'ISSUE', 'CANCEL', 'RETRY_PDF'].includes(c.action)
      ) {
        const inv = await tx.invoice.findUnique({ where: { id: c.invoiceId } });
        if (!inv) conflict('Invoice not found.');
        resourceId = inv.id;
        resourceType = 'invoice';
        const frozen = inv.snapshot as Record<string, unknown>;
        if (c.action === 'CANCEL') {
          if (!['DRAFT', 'APPROVED'].includes(inv.status))
            conflict('Issued invoices cannot be cancelled or edited.');
          await tx.billingAllocation.deleteMany({ where: { invoiceId: inv.id } });
          await tx.invoice.update({ where: { id: inv.id }, data: { status: 'CANCELLED' } });
        }
        if (c.action === 'APPROVE') {
          if (inv.status !== 'DRAFT') conflict('Only drafts can be approved.');
          if (frozen.policyFingerprint !== fingerprint(p))
            conflict('Policy changed. Cancel and regenerate the draft.');
          await tx.invoice.update({ where: { id: inv.id }, data: { status: 'APPROVED' } });
        }
        if (c.action === 'ISSUE') {
          if (inv.status === 'ISSUED') return { id: inv.id, number: inv.number };
          if (inv.status !== 'APPROVED' || !p.invoiceFormatApproved)
            conflict('Approve the draft and legal invoice format before issuance.');
          if (frozen.policyFingerprint !== fingerprint(p))
            conflict('Policy changed. Regenerate the draft.');
          const sequence = await tx.documentSequence.upsert({
            where: { id: 'invoice:' + p.prefix },
            create: { id: 'invoice:' + p.prefix, next: 2n },
            update: { next: { increment: 1 } },
          });
          const number = `${p.prefix}-${String(sequence.next - 1n).padStart(6, '0')}`;
          await tx.invoice.update({
            where: { id: inv.id },
            data: { status: 'ISSUED', number, issuedAt: new Date() },
          });
          await tx.outboxEvent.create({
            data: { topic: 'invoice.pdf', payload: { invoiceId: inv.id } },
          });
        }
        if (c.action === 'RETRY_PDF') {
          if (inv.status !== 'ISSUED') conflict('Only issued invoices have final PDFs.');
          await tx.outboxEvent.create({
            data: { topic: 'invoice.pdf', payload: { invoiceId: inv.id } },
          });
        }
      } else if (c.action === 'PAYMENT') {
        const client = await tx.client.findUnique({ where: { id: c.clientId } });
        if (!client || client.archived) conflict('Choose an active client.');
        await tx.payment.create({
          data: {
            id: resourceId,
            clientId: c.clientId,
            currency: p.currency,
            amount: money(c.amount, p.scale),
            reference: c.reference,
            receivedAt: new Date(c.receivedAt),
          },
        });
        resourceType = 'payment';
      } else if (c.action === 'ALLOCATE_PAYMENT') {
        const payment = await tx.payment.findUnique({
          where: { id: c.paymentId },
          include: { allocations: true },
        });
        if (!payment || payment.reversedAt) conflict('Receipt is missing or reversed.');
        const { row: inv, outstanding } = await invoiceBalance(tx, c.invoiceId),
          n = money(c.amount, p.scale);
        if (
          inv.status !== 'ISSUED' ||
          inv.clientId !== payment.clientId ||
          inv.currency !== payment.currency ||
          inv.currency !== p.currency
        )
          conflict(
            'Only issued invoices for the same client and currency can receive this payment.',
          );
        if (
          n > outstanding ||
          n > payment.amount - payment.allocations.reduce((n, a) => n + a.amount, 0n)
        )
          conflict('Allocation exceeds receipt credit or invoice balance.');
        await tx.paymentAllocation.create({
          data: { id: resourceId, paymentId: payment.id, invoiceId: inv.id, amount: n },
        });
        resourceType = 'paymentAllocation';
      } else if (c.action === 'REVERSE_PAYMENT') {
        const payment = await tx.payment.findUnique({ where: { id: c.paymentId } });
        if (!payment || payment.reversedAt) conflict('Receipt already reversed or missing.');
        await tx.payment.update({
          where: { id: payment.id },
          data: { reversedAt: new Date(), reversalReason: c.reason },
        });
        resourceId = payment.id;
        resourceType = 'payment';
      } else if (c.action === 'CREDIT') {
        if (!p.creditNoteFormatApproved)
          conflict('Approve the credit note legal format before posting adjustments.');
        const { row, outstanding } = await invoiceBalance(tx, c.invoiceId);
        if (row.status !== 'ISSUED' || row.currency !== p.currency)
          conflict('Select an issued invoice in the current currency.');
        const n = money(c.amount, p.scale);
        if (n > outstanding)
          conflict(
            'Credit exceeds the unpaid balance. Refunds require a separately approved workflow.',
          );
        await tx.creditNote.create({
          data: { id: resourceId, invoiceId: row.id, amount: n, reason: c.reason },
        });
        resourceType = 'credit';
      } else if (c.action === 'EXPENSE') {
        await tx.expense.create({
          data: {
            id: resourceId,
            category: c.category,
            description: c.description,
            amount: money(c.amount, p.scale),
            currency: p.currency,
            incurredAt: new Date(c.incurredAt),
          },
        });
        resourceType = 'expense';
      } else if ('expenseId' in c) {
        const e = await tx.expense.findUnique({ where: { id: c.expenseId } });
        if (!e) conflict('Expense not found.');
        const next =
          c.action === 'APPROVE_EXPENSE'
            ? 'APPROVED'
            : c.action === 'PAY_EXPENSE'
              ? 'PAID'
              : 'REJECTED';
        if (c.action === 'PAY_EXPENSE' ? e.status !== 'APPROVED' : e.status !== 'SUBMITTED')
          conflict('Expense transition is not allowed.');
        await tx.expense.update({ where: { id: e.id }, data: { status: next } });
        resourceId = e.id;
        resourceType = 'expense';
      } else conflict('Unsupported financial command.');
      await audit(tx, fresh, c.action, resourceType, resourceId, requestId, undefined, c);
      return { id: resourceId };
    },
    async (_tx, fresh) => {
      requireAdmin(fresh);
    },
  );
}
export async function verifiedSalesTotals(actor: Principal) {
  requireAdmin(actor);
  return database().$queryRaw<{ currency: string; amount: bigint }[]>`
    WITH balances AS (
      SELECT i.currency, i.total
        - COALESCE((SELECT SUM(c.amount) FROM "CreditNote" c WHERE c."invoiceId"=i.id),0) AS net,
        COALESCE((SELECT SUM(a.amount) FROM "PaymentAllocation" a JOIN "Payment" p ON p.id=a."paymentId"
          WHERE a."invoiceId"=i.id AND p."reversedAt" IS NULL AND p."clientId"=i."clientId" AND p.currency=i.currency
            AND EXISTS (SELECT 1 FROM "AuditLog" l WHERE l."resourceType"='payment' AND l."resourceId"=p.id AND l.action='VERIFY_PAYMENT')),0) AS verified
      FROM "Invoice" i WHERE i.status='ISSUED'
    ) SELECT currency, SUM(net)::bigint AS amount FROM balances WHERE net>0 AND verified>=net GROUP BY currency
  `;
}

export async function financeView(actor: Principal, search: Record<string, string | undefined>) {
  requireAdmin(actor);
  const page = z.coerce.number().int().min(1).max(10000).default(1).parse(search.page),
    status = z
      .enum(['ALL', 'DRAFT', 'APPROVED', 'ISSUED', 'CANCELLED'])
      .default('ALL')
      .parse(search.status);
  const q = (search.q || '').trim().slice(0, 100),
    section = search.section || 'invoices';
  const orderBy = [
    { createdAt: search.sort === 'oldest' ? ('asc' as const) : ('desc' as const) },
    { id: 'asc' as const },
  ];
  const skip = (page - 1) * 20;
  const ids = q
    ? (
        await Promise.all([
          database().client.findMany({
            where: { name: { contains: q, mode: 'insensitive' } },
            select: { id: true },
            take: 100,
          }),
          database().branch.findMany({
            where: { name: { contains: q, mode: 'insensitive' } },
            select: { id: true },
            take: 100,
          }),
          database().garmentType.findMany({
            where: { name: { contains: q, mode: 'insensitive' } },
            select: { id: true },
            take: 100,
          }),
          database().serviceCatalog.findMany({
            where: { name: { contains: q, mode: 'insensitive' } },
            select: { id: true },
            take: 100,
          }),
        ])
      )
        .flat()
        .map((r) => r.id)
    : [];
  const rateFilter: Prisma.RateContractWhereInput = {
    ...(id.safeParse(search.branch).success ? { branchId: search.branch } : {}),
    ...(q
      ? {
          OR: [
            { branchId: { in: ids } },
            { clientId: { in: ids } },
            { garmentId: { in: ids } },
            { serviceId: { in: ids } },
          ],
        }
      : {}),
  };
  const paymentFilter: Prisma.PaymentWhereInput = q
    ? { OR: [{ reference: { contains: q, mode: 'insensitive' } }, { clientId: { in: ids } }] }
    : {};
  const expenseFilter: Prisma.ExpenseWhereInput = q
    ? {
        OR: [
          { category: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};
  const creditFilter: Prisma.CreditNoteWhereInput = q
    ? {
        OR: [
          { reason: { contains: q, mode: 'insensitive' } },
          { invoice: { number: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {};
  const jobFilter: Prisma.OutboxEventWhereInput = {
    topic: { in: ['invoice.pdf', 'billing.draft', 'report.export', 'staff.invite'] },
    ...(q ? { AND: [{ topic: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  const invoiceFilter: Prisma.InvoiceWhereInput = {
    ...(status === 'ALL' ? {} : { status }),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: 'insensitive' } },
            { clientId: { in: ids } },
            { branchId: { in: ids } },
          ],
        }
      : {}),
    ...(search.client ? { clientId: id.parse(search.client) } : {}),
  };
  const [settings, invoices, total, rates, payments, expenses, jobs, credits] = await Promise.all([
    database().businessPolicy.findUnique({ where: { id: 'operations' } }),
    database().invoice.findMany({
      where: invoiceFilter,
      omit: { pdf: true },
      orderBy,
      skip: (page - 1) * 20,
      take: 20,
      include: {
        credits: true,
        receipts: { include: { payment: { select: { reversedAt: true } } } },
      },
    }),
    database().invoice.count({ where: invoiceFilter }),
    database().rateContract.findMany({ where: rateFilter, orderBy, take: 20, skip }),
    database().payment.findMany({
      where: paymentFilter,
      orderBy,
      take: 20,
      skip,
      include: { allocations: true },
    }),
    database().expense.findMany({ where: expenseFilter, orderBy, take: 20, skip }),
    database().outboxEvent.findMany({
      where: jobFilter,
      select: {
        id: true,
        topic: true,
        attempts: true,
        createdAt: true,
        processedAt: true,
        failedAt: true,
        lockedUntil: true,
        lastError: true,
        availableAt: true,
      },
      orderBy,
      take: 20,
      skip,
    }),
    database().creditNote.findMany({
      where: creditFilter,
      orderBy,
      take: 20,
      skip,
      include: { invoice: { select: { number: true, currency: true } } },
    }),
  ]);
  const nameIds = [
    ...rates.flatMap((r) => [r.branchId, r.clientId, r.garmentId, r.serviceId]),
    ...payments.map((p) => p.clientId),
  ].filter((x): x is string => Boolean(x));
  const names: Record<string, string> = {};
  for (const rows of await Promise.all([
    database().branch.findMany({
      where: { id: { in: nameIds } },
      select: { id: true, name: true },
    }),
    database().client.findMany({
      where: { id: { in: nameIds } },
      select: { id: true, name: true },
    }),
    database().garmentType.findMany({
      where: { id: { in: nameIds } },
      select: { id: true, name: true },
    }),
    database().serviceCatalog.findMany({
      where: { id: { in: nameIds } },
      select: { id: true, name: true },
    }),
  ]))
    for (const row of rows) names[row.id] = row.name;
  const sectionTotal =
    section === 'pricing'
      ? await database().rateContract.count({ where: rateFilter })
      : section === 'receivables'
        ? await database().payment.count({ where: paymentFilter })
        : section === 'expenses'
          ? await database().expense.count({ where: expenseFilter })
          : section === 'credits'
            ? await database().creditNote.count({ where: creditFilter })
            : section === 'jobs'
              ? await database().outboxEvent.count({ where: jobFilter })
              : total;
  return {
    sectionTotal,
    settings,
    invoices,
    total,
    page,
    rates,
    payments,
    expenses,
    jobs,
    credits,
    names,
  };
}
