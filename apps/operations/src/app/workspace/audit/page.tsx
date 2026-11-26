import Link from 'next/link';
import { pageActor } from '@/server/page-access';
import { database } from '@/server/db';
import PermissionDenied from '@/components/PermissionDenied';
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.min(10000, Math.max(1, Number((await searchParams).page) || 1));
  const limit = 50;
  const actor = await pageActor();
  if (!actor.roles.includes('ADMIN')) return <PermissionDenied />;
  const rows = await database().auditLog.findMany({
    take: limit,
    skip: (page - 1) * limit,
    orderBy: { createdAt: 'desc' },
  });
  const total = await database().auditLog.count();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GOVERNANCE</p>
          <h1>Audit history</h1>
          <p>Server-recorded master-data and access events.</p>
        </div>
      </div>
      <section className="surface table-scroll">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Resource</th>
              <th>Actor</th>
              <th>Time (UTC)</th>
              <th>Request reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.action}</td>
                <td>
                  {row.resourceType}
                  <small>{row.resourceId}</small>
                </td>
                <td>{row.actorId}</td>
                <td>{row.createdAt.toISOString()}</td>
                <td>{row.requestId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="empty-state">No audit events yet.</p>}
        <div className="pagination">
          <span>
            Page {page} - {total} events
          </span>
          {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
          {page * limit < total && <Link href={`?page=${page + 1}`}>Next</Link>}
        </div>
      </section>
    </>
  );
}
