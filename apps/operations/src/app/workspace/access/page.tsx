import Link from 'next/link';
import { pageActor } from '@/server/page-access';
import { database } from '@/server/db';
import { pendingStaffFilter } from '@/server/staff';
import StaffEditor from '@/components/StaffEditor';
import PermissionDenied from '@/components/PermissionDenied';
export default async function Access({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; requestsPage?: string }>;
}) {
  const query = await searchParams;
  const pageNumber = (value?: string) =>
    Math.min(10000, Math.max(1, Math.floor(Number(value) || 1)));
  const page = pageNumber(query.page);
  const requestsPage = pageNumber(query.requestsPage);
  const limit = 50;
  const actor = await pageActor();
  if (!actor.roles.includes('ADMIN')) return <PermissionDenied />;
  const profiles = database().userProfile;
  const pending = pendingStaffFilter;
  const [users, total, requests, requestsTotal] = await Promise.all([
    profiles.findMany({
      where: { NOT: pending },
      take: limit,
      skip: (page - 1) * limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { memberships: true, _count: { select: { scopes: true } } },
    }),
    profiles.count({ where: { NOT: pending } }),
    profiles.findMany({
      where: pending,
      take: limit,
      skip: (requestsPage - 1) * limit,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, displayName: true, email: true },
    }),
    profiles.count({ where: pending }),
  ]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GOVERNANCE</p>
          <h1>Staff &amp; roles</h1>
          <p>Review access requests, assign roles and manage your team’s permissions.</p>
        </div>
      </div>
      <section
        id="requests"
        className="surface panel-pad staff-requests"
        aria-labelledby="staff-requests-title"
      >
        <div className="section-heading">
          <h2 id="staff-requests-title">Access requests</h2>
          <span className="status">{requestsTotal} pending</span>
        </div>
        {requests.length ? (
          <ul className="crm-record-list">
            {requests.map((request) => (
              <li key={request.id}>
                <Link href={`/workspace/access/${request.id}`}>
                  <span>
                    <strong>{request.displayName}</strong>
                    <small>Login · {request.email}</small>
                  </span>
                  <span>Review request →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No access requests on this page. New staff registrations appear here immediately.</p>
        )}
        {(requestsPage > 1 || requestsPage * limit < requestsTotal) && (
          <div className="pagination">
            {requestsPage > 1 && (
              <Link href={`?page=${page}&requestsPage=${requestsPage - 1}`}>Previous requests</Link>
            )}
            {requestsPage * limit < requestsTotal && (
              <Link href={`?page=${page}&requestsPage=${requestsPage + 1}`}>Next requests</Link>
            )}
          </div>
        )}
      </section>
      <p>
        <Link className="text-link" href="/workspace/finance?section=jobs">
          Review invitation and background activity →
        </Link>
      </p>
      <section className="surface table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Assigned scopes</th>
              <th>Account</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <Link href={`/workspace/access/${user.id}`}>
                    <strong>{user.displayName}</strong>
                  </Link>
                  <small>{user.email}</small>
                </td>
                <td>{user.memberships.map((item) => item.role.replaceAll('_', ' ')).join(', ')}</td>
                <td>{user._count.scopes}</td>
                <td>{user.active ? 'Active' : 'Disabled'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted tiny">
          Open a staff member to review access and activity. Your own permissions require another
          administrator.
        </p>
        <div className="pagination">
          <span>
            Page {page} - {total} profiles
          </span>
          {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
          {page * limit < total && <Link href={`?page=${page + 1}`}>Next</Link>}
        </div>
      </section>
      <section className="surface panel-pad">
        <StaffEditor />
      </section>
    </>
  );
}
