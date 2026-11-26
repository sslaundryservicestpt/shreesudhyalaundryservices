import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DomainError, requireIdentity, type Principal } from '@shree/domain';
import { database } from './db';
export type Tx = Prisma.TransactionClient;
export const snapshot = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as Prisma.InputJsonObject;
export async function command(
  actor: Principal,
  key: string,
  correlation: string,
  resource: string,
  input: unknown,
  run: (tx: Tx, fresh: Principal) => Promise<Prisma.InputJsonObject>,
  authorize: (tx: Tx, fresh: Principal, previous: Prisma.JsonValue | null) => Promise<void>,
) {
  requireIdentity(actor);
  if (!/^[\w-]{16,100}$/.test(key))
    throw new DomainError('IDEMPOTENCY_REQUIRED', 'A valid request key is required.', 400);
  const hash = createHash('sha256').update(JSON.stringify({ resource, input })).digest('hex');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await database().$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "UserProfile" WHERE id=${actor.id}::uuid FOR SHARE`;
          const p = await tx.userProfile.findUnique({
            where: { id: actor.id },
            include: { memberships: true, scopes: true },
          });
          if (!p) throw new DomainError('UNAUTHENTICATED', 'Account not found.', 401);
          const fresh: Principal = {
            id: p.id,
            active: p.active,
            roles: p.memberships.map((m) => m.role),
            scopes: p.scopes,
          };
          requireIdentity(fresh);
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${actor.id + ':' + key},0))`;
          const prior = await tx.idempotencyRecord.findUnique({
            where: { actorId_key: { actorId: actor.id, key } },
          });
          // A cached response is not an authorization grant. Check current access
          // on both first execution and replay, without repeating business effects.
          await authorize(tx, fresh, prior?.response ?? null);
          if (prior) {
            if (prior.requestHash !== hash)
              throw new DomainError(
                'IDEMPOTENCY_CONFLICT',
                'Request key already used with different data.',
                409,
              );
            return prior.response;
          }
          const result = await run(tx, fresh);
          await tx.idempotencyRecord.create({
            data: { actorId: actor.id, key, requestHash: hash, response: result },
          });
          return result;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 20000,
          maxWait: 10000,
        },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034' && attempt < 3)
        continue;
      throw e;
    }
  }
  throw new DomainError('CONCURRENT_UPDATE', 'Please retry this request.', 409);
}
export async function audit(
  tx: Tx,
  actor: Principal,
  action: string,
  type: string,
  id: string,
  requestId: string,
  before?: unknown,
  after?: unknown,
) {
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      action,
      resourceType: type,
      resourceId: id,
      requestId,
      ...(before ? { before: snapshot(before) } : {}),
      ...(after ? { after: snapshot(after) } : {}),
    },
  });
}
