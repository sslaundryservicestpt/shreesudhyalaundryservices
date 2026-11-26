import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma, type WorkOrder } from '@prisma/client';
import { z } from 'zod';
import {
  DomainError,
  requireIdentity,
  canReadScope,
  requireAdmin,
  workCommand,
  transition,
  queue,
  emptyBalances,
  approvedPolicy,
  type Principal,
  type WorkState,
} from '@shree/domain';
import { database } from './db';
import { command, audit, snapshot, type Tx } from './commands';

export const createPickupInput = z
  .object({
    branchId: z.uuid(),
    unitId: z.uuid(),
    executiveId: z.uuid(),
    scheduledAt: z.iso.datetime(),
    source: z.enum(['PHONE', 'WHATSAPP']).optional(),
    note: z.string().trim().max(500).optional(),
    catalogueServiceId: z.union([z.uuid(), z.literal('')]).optional(),
    lines: z
      .array(z.object({ garmentId: z.uuid(), serviceId: z.uuid() }).strict())
      .min(1)
      .max(50)
      .optional(),
  })
  .strict()
  .refine(
    (input) => Boolean(input.catalogueServiceId) !== Boolean(input.lines),
    'Choose the piece catalogue or enter custom lines.',
  );
export function workScope(actor: Principal): Prisma.WorkOrderWhereInput {
  requireIdentity(actor);
  if (actor.roles.includes('ADMIN')) return {};
  if (actor.roles.includes('SUPERVISOR'))
    return {
      OR: actor.scopes
        .map((s) => ({
          ...(s.clientId ? { clientId: s.clientId } : {}),
          ...(s.branchId ? { branchId: s.branchId } : {}),
          ...(s.unitId ? { unitId: s.unitId } : {}),
        }))
        .filter((s) => Object.keys(s).length),
    };
  if (actor.roles.includes('DELIVERY_EXECUTIVE'))
    return {
      OR: [
        { executiveId: actor.id },
        { state: { path: ['deliveries'], array_contains: [{ executiveId: actor.id }] } },
      ],
    };
  throw new DomainError('FORBIDDEN', 'Operational access has not been assigned.', 403);
}
export function canWork(actor: Principal, order: WorkOrder) {
  const state = order.state as unknown as WorkState;
  return (
    canReadScope(actor, order) ||
    (actor.roles.includes('DELIVERY_EXECUTIVE') &&
      (order.executiveId === actor.id || state.deliveries.some((d) => d.executiveId === actor.id)))
  );
}
function coordinator(
  actor: Principal,
  scope: { clientId: string; branchId: string; unitId: string },
) {
  if (!canReadScope(actor, scope))
    throw new DomainError(
      'FORBIDDEN',
      'This action requires a scoped supervisor or administrator.',
      403,
    );
}
export async function executive(tx: Tx, id: string) {
  const p = await tx.userProfile.findUnique({ where: { id }, include: { memberships: true } });
  if (!p?.active || !p.memberships.some((m) => m.role === 'DELIVERY_EXECUTIVE'))
    throw new DomainError('INVALID_EXECUTIVE', 'Choose an active delivery executive.', 422);
}
export async function createPickup(actor: Principal, raw: unknown, key: string, requestId: string) {
  const input = createPickupInput.parse(raw);
  return command(
    actor,
    key,
    requestId,
    'pickup.create',
    input,
    async (tx, fresh) => {
      const branch = await tx.branch.findUnique({
          where: { id: input.branchId },
          include: { client: true },
        }),
        unit = await tx.laundryUnit.findUnique({ where: { id: input.unitId } });
      if (!branch || branch.archived || branch.client.archived || !unit || unit.archived)
        throw new DomainError(
          'INVALID_MASTERS',
          'Choose active branch, client and laundry unit.',
          422,
        );
      coordinator(fresh, { branchId: branch.id, clientId: branch.clientId, unitId: unit.id });
      await executive(tx, input.executiveId);
      let requestedLines = input.lines ?? [];
      if (input.catalogueServiceId) {
        const serviceId = input.catalogueServiceId;
        const garments = await tx.garmentType.findMany({
          where: { archived: false, unit: 'PIECE' },
        });
        requestedLines = garments.map((garment) => ({ garmentId: garment.id, serviceId }));
        if (requestedLines.length < 1 || requestedLines.length > 40)
          throw new DomainError(
            'INVALID_CATALOGUE',
            'Use explicit lines or configure 1–40 active piece types.',
            422,
          );
      }
      if (
        new Set(requestedLines.map((l) => l.garmentId + ':' + l.serviceId)).size !==
        requestedLines.length
      )
        throw new DomainError('DUPLICATE_LINES', 'Combine duplicate garment/service lines.', 422);
      const lines: WorkState['lines'] = [];
      for (const l of requestedLines) {
        const garment = await tx.garmentType.findUnique({ where: { id: l.garmentId } }),
          service = await tx.serviceCatalog.findUnique({ where: { id: l.serviceId } });
        if (!garment || garment.archived || !service || service.archived)
          throw new DomainError('INVALID_CATALOG', 'Choose active catalog entries.', 422);
        lines.push({
          id: randomUUID(),
          garmentId: garment.id,
          serviceId: service.id,
          name: garment.name,
          service: service.name,
          unit: garment.unit,
          route:
            service.route === 'IRON_ONLY'
              ? ['IRON']
              : service.route === 'WASH_DRY_IRON'
                ? ['WASH', 'DRY', 'IRON']
                : ['WASH', 'DRY', 'FOLD'],
          pickup: 0,
          inward: null,
          accepted: null,
          discrepancy: null,
          balances: emptyBalances(),
        });
      }
      const state: WorkState = {
        pickup: 'ASSIGNED',
        custody: 'BRANCH',
        received: false,
        collectedAt: null,
        completedAt: null,
        lines,
        batches: [],
        deliveries: [],
        ...(input.source ? { intake: { source: input.source, note: input.note ?? '' } } : {}),
      };
      const row = await tx.workOrder.create({
        data: {
          branchId: branch.id,
          clientId: branch.clientId,
          unitId: unit.id,
          executiveId: input.executiveId,
          scheduledAt: new Date(input.scheduledAt),
          state: snapshot(state),
        },
      });
      await audit(tx, fresh, 'PICKUP_CREATED', 'work', row.id, requestId, undefined, {
        branchId: row.branchId,
        executiveId: row.executiveId,
        state,
      });
      return { id: row.id, version: row.version };
    },
    async (tx, fresh, previous) => {
      if (previous) {
        const existing = await tx.workOrder.findUnique({
          where: { id: String((previous as { id?: string }).id) },
        });
        if (!existing || !canWork(fresh, existing))
          throw new DomainError('NOT_FOUND', 'Pickup outside current access.', 404);
        coordinator(fresh, existing);
      } else {
        const b = await tx.branch.findUnique({ where: { id: input.branchId } });
        if (!b) throw new DomainError('NOT_FOUND', 'Branch not found.', 404);
        coordinator(fresh, { branchId: b.id, clientId: b.clientId, unitId: input.unitId });
      }
    },
  );
}
/** Explicit executive transport projection; never serialize processing or aggregate ledger data. */
export function executiveOrder(row: WorkOrder, actor: Principal): WorkOrder {
  const state = row.state as unknown as WorkState;
  return {
    ...row,
    state: snapshot({
      pickup: state.pickup,
      custody: state.custody,
      collectedAt: state.collectedAt,
      completedAt: state.completedAt,
      lines: state.lines.map((l) => ({
        id: l.id,
        name: l.name,
        service: l.service,
        unit: l.unit,
        pickup: l.pickup,
      })),
      deliveries: state.deliveries.filter((d) => d.executiveId === actor.id),
      batches: [],
    }) as Prisma.JsonObject,
  };
}
export async function workDetail(actor: Principal, id: string) {
  z.uuid().parse(id);
  requireIdentity(actor);
  const row = await database().workOrder.findFirst({ where: { id, ...workScope(actor) } });
  if (!row || !canWork(actor, row))
    throw new DomainError('NOT_FOUND', 'Order is unavailable or outside your assignment.', 404);
  const executiveOnly = !actor.roles.some((r) => r === 'ADMIN' || r === 'SUPERVISOR');
  const [branch, unit, assignee, events, movements, files] = await Promise.all([
    database().branch.findUnique({
      where: { id: row.branchId },
      select: { name: true, address: true, phone: true, contactName: true },
    }),
    database().laundryUnit.findUnique({ where: { id: row.unitId }, select: { name: true } }),
    database().userProfile.findUnique({
      where: { id: row.executiveId },
      select: { displayName: true },
    }),
    database().auditLog.findMany({
      where: {
        resourceType: 'work',
        resourceId: id,
        ...(executiveOnly ? { actorId: actor.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, action: true, createdAt: true, after: true },
    }),
    executiveOnly
      ? Promise.resolve([])
      : database().quantityMovement.findMany({
          where: { orderId: id },
          orderBy: { createdAt: 'asc' },
          take: 500,
        }),
    database().fileAsset.findMany({
      where: { orderId: id, ...(executiveOnly ? { actorId: actor.id } : {}) },
      select: { id: true, name: true, mime: true, createdAt: true },
    }),
  ]);
  if (executiveOnly)
    return {
      row: executiveOrder(row, actor),
      branch,
      unit,
      assignee: row.executiveId === actor.id ? assignee : null,
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        createdAt: e.createdAt,
        after: null,
      })),
      movements: [],
      files,
    };
  return { row, branch, unit, assignee, events, movements, files };
}
const dayMs = 86_400_000;
const indiaOffsetMs = 330 * 60_000;

function todayInTirupati(now = new Date()) {
  const start = Math.floor((now.getTime() + indiaOffsetMs) / dayMs) * dayMs - indiaOffsetMs;
  return { gte: new Date(start), lt: new Date(start + dayMs) };
}

function deliveryFor(actorId: string, status: string): Prisma.WorkOrderWhereInput {
  return { state: { path: ['deliveries'], array_contains: [{ executiveId: actorId, status }] } };
}

const executiveStages = ['pending', 'onPickup', 'queued', 'onDelivery'] as const;
type ExecutiveStage = (typeof executiveStages)[number];

function executiveStageFilter(
  actorId: string,
  stage: ExecutiveStage,
  todayEnd: Date,
): Prisma.WorkOrderWhereInput {
  if (stage === 'queued' || stage === 'onDelivery')
    return deliveryFor(actorId, stage === 'queued' ? 'ASSIGNED' : 'DISPATCHED');
  return {
    executiveId: actorId,
    queue: 'PICKUP',
    scheduledAt: { lt: todayEnd },
    OR: (stage === 'pending' ? ['ASSIGNED'] : ['EN_ROUTE', 'ARRIVED']).map((status) => ({
      state: { path: ['pickup'], equals: status },
    })),
  };
}

export const unbilledWorkFilter = {
  queue: 'COMPLETED',
  billing: null,
} satisfies Prisma.WorkOrderWhereInput;

export async function executiveDashboardCounts(actor: Principal) {
  requireIdentity(actor);
  if (!actor.roles.includes('DELIVERY_EXECUTIVE'))
    throw new DomainError('FORBIDDEN', 'Executive access is required.', 403);
  const todayEnd = todayInTirupati().lt;
  const [pending, onPickup, queued, onDelivery] = await Promise.all(
    executiveStages.map((stage) =>
      database().workOrder.count({
        where: { AND: [workScope(actor), executiveStageFilter(actor.id, stage, todayEnd)] },
      }),
    ),
  );
  return { pending, onPickup, queued, onDelivery };
}

export async function listWork(actor: Principal, search: Record<string, string | undefined>) {
  const f = z
    .object({
      view: z
        .enum([
          'all',
          'today',
          'pickups',
          'receiving',
          'processing',
          'quality',
          'outward',
          'deliveries',
          'exceptions',
          'history',
          'unbilled',
        ])
        .default('all'),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      status: z
        .enum([
          'ALL',
          'PICKUP',
          'RECEIVING',
          'VERIFICATION',
          'DISCREPANCY',
          'PROCESSING',
          'QC',
          'REWORK',
          'OUTWARD',
          'DELIVERY',
          'IN_TRANSIT',
          'COMPLETED',
          'CANCELLED',
          'DELIVERY_EXCEPTION',
        ])
        .default('ALL'),
      branch: z.union([z.uuid(), z.literal('')]).default(''),
      stage: z.enum(executiveStages).optional(),
      q: z.string().trim().max(100).default(''),
      from: z.iso.datetime().optional(),
      to: z.iso.datetime().optional(),
    })
    .parse(search);
  const viewQueues: Record<string, string[]> = {
    pickups: ['PICKUP'],
    receiving: ['RECEIVING', 'VERIFICATION'],
    processing: ['PROCESSING'],
    quality: ['QC', 'REWORK'],
    outward: ['OUTWARD'],
    deliveries: ['DELIVERY', 'IN_TRANSIT'],
    exceptions: ['DISCREPANCY', 'DELIVERY_EXCEPTION'],
    history: ['COMPLETED', 'CANCELLED'],
  };
  const today = todayInTirupati();
  const executiveOnly = !actor.roles.some((role) => role === 'ADMIN' || role === 'SUPERVISOR');
  const deliveries = (statuses: string[]): Prisma.WorkOrderWhereInput => ({
    OR: statuses.map((status) => deliveryFor(actor.id, status)),
  });
  const pickup = { executiveId: actor.id, queue: 'PICKUP' };
  const scheduled = { scheduledAt: today };
  const executiveViews: Partial<Record<typeof f.view, Prisma.WorkOrderWhereInput>> = {
    pickups: pickup,
    deliveries: deliveries(['ASSIGNED', 'DISPATCHED']),
    history: {
      OR: [
        { executiveId: actor.id, queue: 'CANCELLED' },
        { executiveId: actor.id, state: { path: ['pickup'], equals: 'COLLECTED' } },
        deliveries(['ACKNOWLEDGED', 'FAILED']),
      ],
    },
    today: {
      OR: [{ ...pickup, scheduledAt: { lt: today.lt } }, deliveries(['ASSIGNED', 'DISPATCHED'])],
    },
  };
  if (f.view === 'unbilled') requireAdmin(actor);
  if (f.stage && (!executiveOnly || !actor.roles.includes('DELIVERY_EXECUTIVE')))
    throw new DomainError('FORBIDDEN', 'Executive access is required.', 403);
  const viewFilter =
    (f.view === 'unbilled' ? unbilledWorkFilter : undefined) ??
    (executiveOnly ? executiveViews[f.view] : undefined) ??
    (viewQueues[f.view]
      ? { queue: { in: viewQueues[f.view] } }
      : f.view === 'today'
        ? scheduled
        : {});
  const authorizedView = {
    AND: [
      workScope(actor),
      viewFilter,
      ...(f.stage ? [executiveStageFilter(actor.id, f.stage, today.lt)] : []),
    ],
  };
  const filter: Prisma.WorkOrderWhereInput = {
    AND: [
      authorizedView,
      ...(f.status === 'ALL' ? [] : [{ queue: f.status }]),
      ...(f.branch ? [{ branchId: f.branch }] : []),
      ...(f.from || f.to
        ? [
            {
              createdAt: {
                ...(f.from ? { gte: new Date(f.from) } : {}),
                ...(f.to ? { lt: new Date(f.to) } : {}),
              },
            },
          ]
        : []),
    ],
  };
  if (f.q) {
    const branches = await database().branch.findMany({
      where: { name: { contains: f.q, mode: 'insensitive' } },
      select: { id: true },
      take: 100,
    });
    filter.OR = [
      { branchId: { in: branches.map((b) => b.id) } },
      ...(/^\d{1,19}$/.test(f.q) && BigInt(f.q) <= 9223372036854775807n
        ? [{ number: BigInt(f.q) }]
        : []),
    ];
  }
  const [rows, total, groups] = await Promise.all([
    database().workOrder.findMany({
      where: filter,
      orderBy:
        executiveOnly && f.view === 'today'
          ? [{ scheduledAt: 'asc' }, { createdAt: 'asc' }]
          : { createdAt: 'desc' },
      take: 20,
      skip: (f.page - 1) * 20,
    }),
    database().workOrder.count({ where: filter }),
    database().workOrder.groupBy({ by: ['queue'], where: authorizedView, _count: true }),
  ]);
  const branches = await database().branch.findMany({
    where: { id: { in: rows.map((r) => r.branchId) } },
    select: { id: true, name: true },
  });
  return {
    rows: rows.map((r) => ({
      ...(actor.roles.some((role) => role === 'ADMIN' || role === 'SUPERVISOR')
        ? r
        : executiveOrder(r, actor)),
      branchName: branches.find((b) => b.id === r.branchId)?.name || 'Historical branch',
    })),
    total,
    page: f.page,
    groups,
  };
}
export async function changeWork(
  actor: Principal,
  id: string,
  raw: unknown,
  key: string,
  requestId: string,
) {
  z.uuid().parse(id);
  const envelope = z
      .object({ version: z.number().int().positive(), command: z.unknown() })
      .strict()
      .parse(raw),
    input = workCommand.parse(envelope.command);
  return command(
    actor,
    key,
    requestId,
    'work:' + id,
    { version: envelope.version, command: input },
    async (tx, fresh) => {
      await tx.$queryRaw`SELECT id FROM "WorkOrder" WHERE id=${id}::uuid FOR UPDATE`;
      const row = await tx.workOrder.findUnique({ where: { id } });
      if (!row || !canWork(fresh, row))
        throw new DomainError('NOT_FOUND', 'Order is unavailable or outside your assignment.', 404);
      if (row.version !== envelope.version)
        throw new DomainError(
          'VERSION_CONFLICT',
          'Order changed. Refresh and review before retrying.',
          409,
        );
      const state = row.state as unknown as WorkState;
      const pickupActions = ['EN_ROUTE', 'ARRIVE', 'COLLECT'];
      const deliveryActions = ['DISPATCH', 'ACKNOWLEDGE', 'FAIL_DELIVERY'];
      if (fresh.roles.includes('ADMIN') || fresh.roles.includes('SUPERVISOR'))
        coordinator(fresh, row);
      else if (pickupActions.includes(input.action)) {
        if (row.executiveId !== fresh.id)
          throw new DomainError('FORBIDDEN', 'Pickup is assigned to another executive.', 403);
      } else if (deliveryActions.includes(input.action) && 'deliveryId' in input) {
        if (state.deliveries.find((d) => d.id === input.deliveryId)?.executiveId !== fresh.id)
          throw new DomainError('FORBIDDEN', 'Delivery is assigned to another executive.', 403);
      } else throw new DomainError('FORBIDDEN', 'A coordinator must perform this action.', 403);
      if (input.action === 'RESOLVE') requireAdmin(fresh);
      if (
        input.action === 'ASSIGN_DELIVERY' ||
        input.action === 'REASSIGN_PICKUP' ||
        input.action === 'VERIFY_AND_QUEUE'
      )
        await executive(tx, input.executiveId);
      let pod: 'BLOCKED' | 'RECIPIENT' | 'EVIDENCE' = 'BLOCKED';
      if (input.action === 'ACKNOWLEDGE') {
        const deliveryPolicy = await tx.businessPolicy.findUnique({ where: { id: 'delivery' } });
        if (deliveryPolicy) {
          const v = z
            .object({ pod: z.enum(['BLOCKED', 'RECIPIENT', 'EVIDENCE']), approved: z.boolean() })
            .parse(deliveryPolicy.value);
          pod = v.approved ? v.pod : 'BLOCKED';
        } else
          pod = approvedPolicy(
            (await tx.businessPolicy.findUnique({ where: { id: 'operations' } }))?.value,
          ).pod;
        if (input.evidenceId) {
          const f = await tx.fileAsset.findFirst({
            where: {
              id: input.evidenceId,
              orderId: id,
              ...(!fresh.roles.some((r) => r === 'ADMIN' || r === 'SUPERVISOR')
                ? { actorId: fresh.id }
                : {}),
            },
          });
          if (!f)
            throw new DomainError(
              'INVALID_EVIDENCE',
              'Choose evidence attached to this order.',
              422,
            );
        }
      }
      const result = transition(state, input, {
        id: randomUUID(),
        now: new Date().toISOString(),
        pod,
      });
      await tx.workOrder.update({
        where: { id },
        data: {
          state: snapshot(result.state),
          queue: queue(result.state),
          version: { increment: 1 },
          ...(input.action === 'REASSIGN_PICKUP' ? { executiveId: input.executiveId } : {}),
        },
      });
      for (const m of result.movements)
        await tx.quantityMovement.create({
          data: {
            orderId: id,
            ...m,
            unit: state.lines.find((l) => l.id === m.lineId)!.unit,
            actorId: fresh.id,
          },
        });
      await audit(tx, fresh, input.action, 'work', id, requestId, undefined, {
        command: input,
        version: row.version + 1,
        queue: queue(result.state),
      });
      await tx.outboxEvent.create({
        data: {
          topic: 'work.changed',
          payload: { id, version: row.version + 1, action: input.action },
        },
      });
      return { id, version: row.version + 1 };
    },
    async (tx, fresh) => {
      const row = await tx.workOrder.findUnique({ where: { id } });
      if (!row || !canWork(fresh, row))
        throw new DomainError('NOT_FOUND', 'Order outside current access.', 404);
      if (fresh.roles.some((r) => r === 'ADMIN' || r === 'SUPERVISOR')) {
        coordinator(fresh, row);
        if (input.action === 'RESOLVE') requireAdmin(fresh);
        return;
      }
      if (['EN_ROUTE', 'ARRIVE', 'COLLECT'].includes(input.action) && row.executiveId === fresh.id)
        return;
      if (
        ['DISPATCH', 'ACKNOWLEDGE', 'FAIL_DELIVERY'].includes(input.action) &&
        'deliveryId' in input &&
        (row.state as unknown as WorkState).deliveries.some(
          (d) => d.id === input.deliveryId && d.executiveId === fresh.id,
        )
      )
        return;
      throw new DomainError(
        'FORBIDDEN',
        'Current assignment does not authorize this command.',
        403,
      );
    },
  );
}
