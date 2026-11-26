import 'server-only';
import { DomainError, canReadScope, requireIdentity, type Principal } from '@shree/domain';
import type { Branch, LeadStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { audit, command, type Tx } from './commands';
import { database } from './db';

const uuid = z.uuid();
const windowFields = { windowStart: z.iso.datetime(), windowEnd: z.iso.datetime() };
const details = {
  branchId: uuid,
  contactName: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d ().-]{8,24}$/)
    .refine((v) => v.replace(/\D/g, '').length >= 8),
  address: z.string().trim().min(1).max(500),
  approximateItems: z.string().trim().max(500),
  instructions: z.string().trim().max(500),
  notes: z.string().trim().max(500),
  ...windowFields,
};
const leadKey = { id: uuid, version: z.number().int().positive() };
const reason = z.string().trim().min(1).max(500);
const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CREATE'), ...details, source: z.enum(['PHONE', 'WHATSAPP']) }),
  z.object({ action: z.literal('REVIEW'), ...leadKey, ...details }),
  z.object({ action: z.enum(['CONVERT', 'START', 'ARRIVE']), ...leadKey }),
  z.object({ action: z.literal('READ'), id: uuid }),
  z.object({ action: z.enum(['REJECT', 'CLOSE', 'CANCEL']), ...leadKey, reason }),
  z.object({ action: z.literal('ASSIGN'), ...leadKey, executiveId: uuid }),
  z.object({ action: z.literal('RESCHEDULE'), ...leadKey, ...windowFields, reason }),
]);

function deny(): never {
  throw new DomainError('FORBIDDEN', 'You do not have access to this record.', 403);
}

function invalid(message: string): never {
  throw new DomainError('INVALID_STATE', message, 409);
}

export function isCoordinator(actor: Principal) {
  return actor.roles.includes('ADMIN') || actor.roles.includes('SUPERVISOR');
}

function isInboxOwner(actor: Principal) {
  return (
    actor.roles.includes('SUPERVISOR') && actor.id === process.env.WHATSAPP_INBOX_SUPERVISOR_ID
  );
}

function branchAllowed(actor: Principal, branch: Branch) {
  return (
    !branch.archived &&
    canReadScope(actor, {
      branchId: branch.id,
      clientId: branch.clientId,
      unitId: branch.unitId,
    })
  );
}

function branchFilter(actor: Principal): Prisma.BranchWhereInput {
  return {
    archived: false,
    client: { archived: false },
    ...(actor.roles.includes('ADMIN')
      ? {}
      : {
          OR: actor.scopes.flatMap((scope) => [
            ...(scope.branchId ? [{ id: scope.branchId }] : []),
            ...(scope.clientId ? [{ clientId: scope.clientId }] : []),
            ...(scope.unitId ? [{ unitId: scope.unitId }] : []),
          ]),
        }),
  };
}

function leadFilter(actor: Principal): Prisma.CrmLeadWhereInput {
  return {
    OR: [
      { branch: branchFilter(actor) },
      ...(actor.roles.includes('ADMIN') || isInboxOwner(actor) ? [{ branchId: null }] : []),
    ],
  };
}

export async function crmHistory(actor: Principal, id: string, pickupId?: string) {
  const lead = (await crmQueue(actor, id))[0];
  if (!lead || (pickupId && lead.pickup?.id !== pickupId)) deny();
  return database().auditLog.findMany({
    where: {
      OR: [
        { resourceType: 'crm-lead', resourceId: id },
        ...(pickupId ? [{ resourceType: 'pickup-request', resourceId: pickupId }] : []),
      ],
    },
    select: { id: true, action: true, after: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function crmQueue(actor: Principal, leadId?: string, status: LeadStatus = 'NEW') {
  requireIdentity(actor);
  if (!isCoordinator(actor)) deny();
  const db = database();
  const leads = await db.crmLead.findMany({
    where: { AND: [leadFilter(actor), leadId ? { id: leadId } : { status }] },
    include: {
      branch: { include: { client: true } },
      pickup: { include: { executive: { select: { displayName: true } } } },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 100,
  });
  return leads;
}

export async function countCrmQueue(actor: Principal, status: LeadStatus) {
  requireIdentity(actor);
  if (!isCoordinator(actor)) deny();
  return database().crmLead.count({ where: { AND: [leadFilter(actor), { status }] } });
}

function assignedPickup(actor: Principal): Prisma.PickupRequestWhereInput {
  return {
    executiveId: actor.id,
    status: { in: ['IN_QUEUE', 'GOING_FOR_PICKUP', 'REACHED_BRANCH'] },
    lead: { branch: { archived: false, client: { archived: false } } },
  };
}

export async function pickupNotices(actor: Principal) {
  requireIdentity(actor);
  if (!actor.roles.includes('DELIVERY_EXECUTIVE')) deny();
  const where = assignedPickup(actor);
  return database().pickupNotification.findMany({
    where: { recipientId: actor.id, revokedAt: null, readAt: null, pickup: where },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      pickupId: true,
      pickup: {
        select: {
          windowStart: true,
          windowEnd: true,
          lead: {
            select: { branch: { select: { name: true, client: { select: { name: true } } } } },
          },
        },
      },
    },
  });
}

export async function executiveCrm(actor: Principal, pickupId?: string, pendingOnly = false) {
  requireIdentity(actor);
  if (!actor.roles.includes('DELIVERY_EXECUTIVE')) deny();
  const where = assignedPickup(actor);
  const pending = { ...where, status: 'IN_QUEUE' as const };
  const db = database();
  return Promise.all([
    db.pickupRequest.findMany({
      where: { ...(pendingOnly ? pending : where), ...(pickupId ? { id: pickupId } : {}) },
      orderBy: { windowStart: 'asc' },
      take: 100,
      select: {
        id: true,
        status: true,
        version: true,
        windowStart: true,
        windowEnd: true,
        lead: {
          select: {
            contactName: true,
            phone: true,
            address: true,
            instructions: true,
            branch: { select: { name: true, client: { select: { name: true } } } },
          },
        },
      },
    }),
    pickupNotices(actor),
    db.pickupRequest.count({ where: pending }),
  ]);
}

function schedule(input: { windowStart: string; windowEnd: string }) {
  const windowStart = new Date(input.windowStart);
  const windowEnd = new Date(input.windowEnd);
  if (windowEnd <= windowStart)
    throw new DomainError('INVALID_WINDOW', 'Pickup end must follow the start.', 422);
  return { windowStart, windowEnd };
}

function leadDetails(input: {
  [Field in keyof typeof details]: z.output<(typeof details)[Field]>;
}) {
  const { branchId, contactName, phone, address, approximateItems, instructions, notes } = input;
  return {
    branchId,
    contactName,
    phone,
    address,
    approximateItems,
    instructions,
    notes,
    ...schedule(input),
  };
}

async function eligibleBranch(tx: Tx, actor: Principal, id: string) {
  const branch = await tx.branch.findUnique({ where: { id }, include: { client: true } });
  if (!branch || branch.client.archived || !branchAllowed(actor, branch)) deny();
  return branch;
}

export async function crmCommand(actor: Principal, raw: unknown, key: string, requestId: string) {
  const input = inputSchema.parse(raw);
  async function authorize(tx: Tx, fresh: Principal, previous: Prisma.JsonValue | null) {
    if (input.action === 'START' || input.action === 'ARRIVE' || input.action === 'READ') {
      if (!fresh.roles.includes('DELIVERY_EXECUTIVE')) deny();
      const id =
        input.action === 'READ'
          ? (
              await tx.pickupNotification.findFirst({
                where: { id: input.id, recipientId: fresh.id, revokedAt: null },
              })
            )?.pickupId
          : input.id;
      if (!id || !(await tx.pickupRequest.findFirst({ where: { id, ...assignedPickup(fresh) } })))
        deny();
      return;
    }
    if (!isCoordinator(fresh)) deny();
    if (input.action === 'CREATE' || input.action === 'REVIEW')
      await eligibleBranch(tx, fresh, input.branchId);
    if (input.action === 'CREATE') {
      if (
        previous &&
        (typeof previous !== 'object' ||
          !('id' in previous) ||
          typeof previous.id !== 'string' ||
          !(await tx.crmLead.findFirst({ where: { id: previous.id, ...leadFilter(fresh) } })))
      )
        deny();
      return;
    }
    if (['ASSIGN', 'RESCHEDULE', 'CANCEL'].includes(input.action)) {
      if (!(await tx.pickupRequest.findFirst({ where: { id: input.id, lead: leadFilter(fresh) } })))
        deny();
    } else if (!(await tx.crmLead.findFirst({ where: { id: input.id, ...leadFilter(fresh) } })))
      deny();
  }
  return command(
    actor,
    key,
    requestId,
    'crm.command',
    input,
    async (tx, fresh) => {
      if (input.action === 'CREATE') {
        const lead = await tx.crmLead.create({
          data: { ...leadDetails(input), source: input.source, supervisorId: fresh.id },
        });
        await audit(tx, fresh, 'LEAD_CREATE', 'crm-lead', lead.id, requestId);
        return { id: lead.id };
      }
      if (input.action === 'READ') {
        await tx.pickupNotification.updateMany({
          where: { id: input.id, readAt: null },
          data: { readAt: new Date() },
        });
        await audit(
          tx,
          fresh,
          'PICKUP_NOTIFICATION_READ',
          'pickup-notification',
          input.id,
          requestId,
        );
        return { id: input.id };
      }
      if (
        input.action === 'REVIEW' ||
        input.action === 'CONVERT' ||
        input.action === 'REJECT' ||
        input.action === 'CLOSE'
      ) {
        const lead = await tx.crmLead.findUniqueOrThrow({ where: { id: input.id } });
        if (lead.version !== input.version || !['NEW', 'UNDER_REVIEW'].includes(lead.status))
          invalid('This lead has changed. Refresh the queue and try again.');
        if (input.action === 'REVIEW') {
          const { id, version } = input;
          await tx.crmLead.update({
            where: { id, version },
            data: {
              ...leadDetails(input),
              supervisorId: fresh.id,
              status: 'UNDER_REVIEW',
              version: { increment: 1 },
            },
          });
        } else if (input.action === 'CONVERT') {
          if (
            lead.status !== 'UNDER_REVIEW' ||
            !lead.branchId ||
            !lead.windowStart ||
            !lead.windowEnd
          )
            invalid('Complete the site and pickup details and save the review first.');
          await eligibleBranch(tx, fresh, lead.branchId);
          await tx.crmLead.update({
            where: { id: lead.id, version: lead.version },
            data: { status: 'CONVERTED_TO_PICKUP', version: { increment: 1 } },
          });
          const pickup = await tx.pickupRequest.create({
            data: { leadId: lead.id, windowStart: lead.windowStart, windowEnd: lead.windowEnd },
          });
          await audit(
            tx,
            fresh,
            'LEAD_CONVERT',
            'crm-lead',
            lead.id,
            requestId,
            { status: lead.status },
            { pickupId: pickup.id },
          );
          await audit(tx, fresh, 'PICKUP_CREATE', 'pickup-request', pickup.id, requestId);
          return { id: lead.id, pickupId: pickup.id };
        } else {
          await tx.crmLead.update({
            where: { id: lead.id, version: lead.version },
            data: {
              status: input.action === 'REJECT' ? 'REJECTED' : 'CLOSED',
              reason: 'reason' in input ? input.reason : '',
              version: { increment: 1 },
            },
          });
        }
        await audit(
          tx,
          fresh,
          'LEAD_' + input.action,
          'crm-lead',
          lead.id,
          requestId,
          { version: lead.version },
          { version: lead.version + 1, ...('reason' in input ? { reason: input.reason } : {}) },
        );
        return { id: lead.id };
      }
      const pickup = await tx.pickupRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (pickup.version !== input.version || pickup.status === 'CANCELLED')
        invalid('This pickup has changed. Refresh the queue and try again.');
      const data: Prisma.PickupRequestUncheckedUpdateInput = { version: { increment: 1 } };
      if (input.action === 'ASSIGN') {
        await tx.$queryRaw`SELECT id FROM "UserProfile" WHERE id=${input.executiveId}::uuid FOR SHARE`;
        const executive = await tx.userProfile.findUnique({
          where: { id: input.executiveId },
          include: { memberships: true },
        });
        if (
          !executive?.active ||
          !executive.memberships.some((role) => role.role === 'DELIVERY_EXECUTIVE')
        )
          throw new DomainError('INVALID_EXECUTIVE', 'Choose an active delivery executive.', 422);
        if (pickup.executiveId === input.executiveId)
          invalid('This executive already has the pickup.');
        data.executiveId = executive.id;
        data.status = 'IN_QUEUE';
      } else if (input.action === 'RESCHEDULE') {
        Object.assign(data, schedule(input));
        data.status = pickup.executiveId ? 'IN_QUEUE' : 'PENDING';
      } else if (input.action === 'CANCEL') {
        data.status = 'CANCELLED';
      } else if (input.action === 'START' && pickup.status === 'IN_QUEUE') {
        data.status = 'GOING_FOR_PICKUP';
      } else if (input.action === 'ARRIVE' && pickup.status === 'GOING_FOR_PICKUP') {
        data.status = 'REACHED_BRANCH';
      } else invalid('That action is unavailable at this pickup stage.');
      const updated = await tx.pickupRequest.update({
        where: { id: pickup.id, version: pickup.version },
        data,
      });
      if (input.action === 'ASSIGN' || input.action === 'CANCEL') {
        await tx.pickupNotification.updateMany({
          where: { pickupId: pickup.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (input.action === 'ASSIGN')
          await tx.pickupNotification.create({
            data: {
              pickupId: pickup.id,
              recipientId: input.executiveId,
              assignmentVersion: updated.version,
            },
          });
      }
      await audit(
        tx,
        fresh,
        'PICKUP_' + input.action,
        'pickup-request',
        pickup.id,
        requestId,
        {
          status: pickup.status,
          executiveId: pickup.executiveId,
          windowStart: pickup.windowStart,
          windowEnd: pickup.windowEnd,
        },
        {
          status: updated.status,
          executiveId: updated.executiveId,
          windowStart: updated.windowStart,
          windowEnd: updated.windowEnd,
          ...('reason' in input ? { reason: input.reason } : {}),
        },
      );
      return { id: pickup.id };
    },
    authorize,
  );
}
