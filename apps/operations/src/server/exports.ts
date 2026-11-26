import 'server-only';
import { createHash } from 'node:crypto';
import { DomainError, requireIdentity, type Principal } from '@shree/domain';
import { database } from './db';
export function scopeTag(actor: Principal) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        roles: [...actor.roles].sort(),
        scopes: actor.scopes
          .map((s) =>
            JSON.stringify({
              branchId: s.branchId || null,
              clientId: s.clientId || null,
              unitId: s.unitId || null,
            }),
          )
          .sort(),
      }),
    )
    .digest('hex');
}
export async function exportJob(actor: Principal, id: string) {
  requireIdentity(actor);
  if (!actor.roles.some((r) => r === 'ADMIN' || r === 'SUPERVISOR'))
    throw new DomainError('FORBIDDEN', 'Coordinator report access required.', 403);
  const job = await database().outboxEvent.findUnique({ where: { id } }),
    p = job?.payload as Record<string, unknown> | undefined;
  if (
    !job ||
    job.topic !== 'report.export' ||
    p?.actorId !== actor.id ||
    p.scopeTag !== scopeTag(actor)
  )
    throw new DomainError('NOT_FOUND', 'Export unavailable or access assignment changed.', 404);
  return { job, p };
}
