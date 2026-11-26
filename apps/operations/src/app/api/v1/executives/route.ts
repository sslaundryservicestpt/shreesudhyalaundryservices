import { principal } from '@/server/auth';
import { database } from '@/server/db';
import { DomainError, requireIdentity } from '@shree/domain';
import { failure, json, requestId } from '@/server/http';
export async function GET(request: Request) {
  const id = requestId();
  try {
    const actor = await principal();
    requireIdentity(actor);
    if (!actor.roles.some((r) => r === 'ADMIN' || r === 'SUPERVISOR'))
      throw new DomainError('FORBIDDEN', 'Coordinator access required.', 403);
    const q = (new URL(request.url).searchParams.get('q') || '').slice(0, 100);
    return json(
      (
        await database().userProfile.findMany({
          where: {
            active: true,
            memberships: { some: { role: 'DELIVERY_EXECUTIVE' } },
            displayName: { contains: q, mode: 'insensitive' },
          },
          select: { id: true, displayName: true },
          take: 20,
          orderBy: { displayName: 'asc' },
        })
      ).map((p) => ({ id: p.id, name: p.displayName })),
      id,
    );
  } catch (e) {
    return failure(e, id);
  }
}
