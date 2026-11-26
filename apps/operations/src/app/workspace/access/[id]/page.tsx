import Link from 'next/link';
import { z } from 'zod';
import { requireAdmin, DomainError } from '@shree/domain';
import { pageActor } from '@/server/page-access';
import { database } from '@/server/db';
import StaffEditor from '@/components/StaffEditor';
export default async function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor();
  requireAdmin(actor);
  const id = z.uuid().parse((await params).id),
    person = await database().userProfile.findUnique({
      where: { id },
      include: { memberships: true, scopes: true },
    });
  if (!person) throw new DomainError('NOT_FOUND', 'Staff member not found.', 404);
  const pending = !person.active && !person.memberships.length;
  const request = await database().auditLog.findFirst({
    where: { resourceType: 'staff', resourceId: id, action: 'STAFF_ACCESS_REQUESTED' },
    select: { after: true },
  });
  const contact = z.object({ contactPhone: z.string() }).safeParse(request?.after);
  const history = await database().auditLog.findMany({
    where: { OR: [{ actorId: id }, { resourceType: 'staff', resourceId: id }] },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, action: true, createdAt: true, requestId: true },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">STAFF &amp; ROLES</p>
          <h1>{person.displayName}</h1>
          <p>
            {person.email} ·{' '}
            <span className="status">
              {pending ? 'Pending approval' : person.active ? 'Active' : 'Disabled'}
            </span>
          </p>
          {contact.success && (
            <p>
              Contact phone ·{' '}
              <a href={'tel:' + contact.data.contactPhone.replace(/[^+\d]/g, '')}>
                {contact.data.contactPhone}
              </a>
            </p>
          )}
        </div>
        <Link href="/workspace/access" className="text-link">
          Back to staff
        </Link>
      </div>
      <section className="surface panel-pad">
        <StaffEditor key={person.version} person={person} self={id === actor.id} />
      </section>
      <section className="surface panel-pad">
        <h2>Recent authorized activity</h2>
        <p>
          Latest 50 actions performed by this identity or recorded as changes to its staff access.
        </p>
        {history.map((e) => (
          <div className="timeline-item" key={e.id}>
            <strong>{e.action.replaceAll('_', ' ')}</strong>
            <small>
              {e.createdAt.toISOString()} · {e.requestId}
            </small>
          </div>
        ))}
      </section>
    </>
  );
}
