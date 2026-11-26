import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { DomainError, requireAdmin, type Principal } from '@shree/domain';
import { database } from './db';
import { registrationSecret } from './config';
import { command, audit, type Tx } from './commands';
const supported = z.enum(['ADMIN', 'SUPERVISOR', 'DELIVERY_EXECUTIVE']);
export const pendingStaffFilter = { active: false, memberships: { none: {} } };
export const scopesInput = z
  .array(
    z
      .object({
        clientId: z.uuid().optional(),
        branchId: z.uuid().optional(),
        unitId: z.uuid().optional(),
      })
      .strict()
      .refine(
        (s) => Object.values(s).filter(Boolean).length === 1,
        'Choose exactly one target per scope.',
      ),
  )
  .max(100)
  .refine(
    (s) => new Set(s.map((x) => JSON.stringify(x))).size === s.length,
    'Remove duplicate scopes.',
  );
export const staffInput = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('INVITE'),
      email: z
        .email()
        .max(254)
        .transform((s) => s.toLowerCase()),
      displayName: z.string().trim().min(1).max(160),
      roles: z.array(supported).min(1).max(3),
      scopes: scopesInput,
    })
    .strict(),
  z
    .object({
      action: z.literal('UPDATE'),
      id: z.uuid(),
      version: z.number().int().positive(),
      displayName: z.string().trim().min(1).max(160),
      active: z.boolean(),
      roles: z.array(supported).min(1).max(3),
      scopes: scopesInput,
    })
    .strict(),
]);
async function validateScopes(tx: Tx, scopes: z.infer<typeof scopesInput>) {
  for (const scope of scopes) {
    const found = scope.clientId
      ? await tx.client.findFirst({ where: { id: scope.clientId, archived: false } })
      : scope.branchId
        ? await tx.branch.findFirst({ where: { id: scope.branchId, archived: false } })
        : await tx.laundryUnit.findFirst({ where: { id: scope.unitId, archived: false } });
    if (!found)
      throw new DomainError('INVALID_SCOPE', 'Choose active client, branch or unit records.', 422);
  }
}
export async function staffCommand(actor: Principal, raw: unknown, key: string, requestId: string) {
  requireAdmin(actor);
  const c = staffInput.parse(raw);
  return command(
    actor,
    key,
    requestId,
    'staff',
    c,
    async (tx, fresh) => {
      requireAdmin(fresh);
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('staff.access',0))`;
      if (new Set(c.roles).size !== c.roles.length)
        throw new DomainError('INVALID_ROLES', 'Remove duplicate roles.', 422);
      await validateScopes(tx, c.scopes);
      if (c.action === 'INVITE') {
        if (
          await tx.userProfile.findFirst({
            where: { email: { equals: c.email, mode: 'insensitive' } },
          })
        )
          throw new DomainError(
            'STAFF_EXISTS',
            'This identity already has an application profile.',
            409,
          );
        const pending = await tx.outboxEvent.findFirst({
          where: {
            topic: 'staff.invite',
            processedAt: null,
            failedAt: null,
            payload: { path: ['email'], equals: c.email },
          },
          select: { id: true },
        });
        if (pending)
          throw new DomainError(
            'INVITE_PENDING',
            'An invitation is already queued for this work email.',
            409,
          );
        const id = randomUUID();
        await tx.outboxEvent.create({
          data: { id, topic: 'staff.invite', payload: { ...c, actorId: fresh.id } },
        });
        await audit(tx, fresh, 'STAFF_INVITE_QUEUED', 'staff', id, requestId, undefined, c);
        return { id };
      }
      if (c.id === fresh.id)
        throw new DomainError(
          'SELF_ACCESS_CHANGE',
          'Use another administrator to change your own access.',
          409,
        );
      const target = await tx.userProfile.findUnique({
        where: { id: c.id },
        include: { memberships: true, scopes: true },
      });
      if (!target) throw new DomainError('NOT_FOUND', 'Staff member not found.', 404);
      if (target.version !== c.version)
        throw new DomainError(
          'VERSION_CONFLICT',
          'Staff access changed. Refresh before saving.',
          409,
        );
      if (
        target.active &&
        target.memberships.some((m) => m.role === 'ADMIN') &&
        (!c.active || !c.roles.includes('ADMIN'))
      ) {
        const others = await tx.userProfile.count({
          where: { id: { not: c.id }, active: true, memberships: { some: { role: 'ADMIN' } } },
        });
        if (!others)
          throw new DomainError('LAST_ADMIN', 'Keep at least one active administrator.', 409);
      }
      await tx.userProfile.update({
        where: { id: c.id },
        data: { displayName: c.displayName, active: c.active, version: { increment: 1 } },
      });
      await tx.roleMembership.deleteMany({ where: { userId: c.id } });
      await tx.roleMembership.createMany({ data: c.roles.map((role) => ({ userId: c.id, role })) });
      await tx.userScope.deleteMany({ where: { userId: c.id } });
      if (c.scopes.length)
        await tx.userScope.createMany({
          data: c.scopes.map((scope) => ({ userId: c.id, ...scope })),
        });
      await audit(
        tx,
        fresh,
        !target.active && !target.memberships.length && c.active
          ? 'STAFF_ACCESS_APPROVED'
          : 'STAFF_ACCESS_CHANGED',
        'staff',
        c.id,
        requestId,
        {
          active: target.active,
          roles: target.memberships.map((m) => m.role),
          scopes: target.scopes,
        },
        { active: c.active, roles: c.roles, scopes: c.scopes },
      );
      return { id: c.id, version: target.version + 1 };
    },
    async (_tx, fresh) => {
      requireAdmin(fresh);
    },
  );
}

/** Durable provider adapter. Disabled unless the owner explicitly enables email delivery. */
export async function processStaffInvite(jobId: string) {
  const secret = registrationSecret();
  if (
    process.env.STAFF_INVITES_ENABLED !== 'true' ||
    !secret ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.APP_URL
  )
    throw new DomainError(
      'INVITES_NOT_CONFIGURED',
      'Owner-approved invitation delivery is not configured.',
      503,
    );
  const job = await database().outboxEvent.findUniqueOrThrow({ where: { id: jobId } }),
    payload = job.payload as Record<string, unknown>,
    input = staffInput.parse(
      payload.action
        ? Object.fromEntries(Object.entries(payload).filter(([k]) => k !== 'actorId'))
        : payload,
    );
  if (input.action !== 'INVITE') throw Error('INVALID_INVITE_JOB');
  const p = await database().userProfile.findUniqueOrThrow({
    where: { id: String(payload.actorId) },
    include: { memberships: true, scopes: true },
  });
  const actor: Principal = {
    id: p.id,
    active: p.active,
    roles: p.memberships.map((m) => m.role),
    scopes: p.scopes,
  };
  requireAdmin(actor);
  // An existing local identity means a prior provider/profile attempt completed.
  if (
    await database().userProfile.findFirst({
      where: { email: { equals: input.email, mode: 'insensitive' } },
    })
  )
    return;
  await validateScopes(database(), input.scopes);
  const provider = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    secret,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const response = await provider.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: new URL('/auth/callback', process.env.APP_URL).toString(),
    data: { display_name: input.displayName },
  });
  if (response.error || !response.data.user)
    throw new DomainError(
      'INVITE_PROVIDER_FAILED',
      'Provider invitation requires review; reconcile an existing identity before retry.',
      502,
    );
  const authUserId = response.data.user.id;
  await database().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('staff.access',0))`;
      const current = await tx.userProfile.findUniqueOrThrow({
        where: { id: actor.id },
        include: { memberships: true },
      });
      requireAdmin({
        ...actor,
        active: current.active,
        roles: current.memberships.map((m) => m.role),
      });
      await validateScopes(tx, input.scopes);
      const existing = await tx.userProfile.findUnique({ where: { authUserId } });
      if (existing) return;
      const user = await tx.userProfile.create({
        data: {
          authUserId,
          email: input.email,
          displayName: input.displayName,
          memberships: { create: input.roles.map((role) => ({ role })) },
          scopes: { create: input.scopes },
        },
      });
      await audit(tx, actor, 'STAFF_INVITED', 'staff', user.id, jobId, undefined, {
        roles: input.roles,
        scopes: input.scopes,
      });
    },
    { isolationLevel: 'Serializable' },
  );
}
