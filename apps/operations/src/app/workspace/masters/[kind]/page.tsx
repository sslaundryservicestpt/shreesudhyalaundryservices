import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus, Search, ArrowRight, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { masterKind } from '@shree/domain';
import { pageActor } from '@/server/page-access';
import { listMasters } from '@/server/masters';
import PermissionDenied from '@/components/PermissionDenied';
const labels = {
  clients: 'Clients',
  branches: 'Branches',
  units: 'Laundry units',
  garments: 'Garment types',
  services: 'Service catalog',
};
export default async function Masters({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parsed = masterKind.safeParse((await params).kind);
  if (!parsed.success) notFound();
  const kind = parsed.data,
    actor = await pageActor(),
    admin = actor.roles.includes('ADMIN');
  if (!admin && !actor.roles.includes('SUPERVISOR')) return <PermissionDenied />;
  const filters = await searchParams;
  const result = await listMasters(actor, kind, filters);
  const link = (page: number) => {
    const query = new URLSearchParams(
      Object.entries(filters).filter(
        (pair): pair is [string, string] => typeof pair[1] === 'string',
      ),
    );
    query.set('page', String(page));
    return `?${query}`;
  };
  return (
    <>
      <div className="breadcrumbs">
        <Link href="/workspace">Workspace</Link>
        <span>/</span>
        {labels[kind]}
      </div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MASTER DATA</p>
          <h1>{labels[kind]}</h1>
          <p>
            {admin
              ? 'Keep business records accurate and ready for work.'
              : 'Records within your authorised scope. Changes are managed by your administrator.'}
          </p>
        </div>
        {admin && (
          <Link className="button" href={`/workspace/masters/${kind}/new`}>
            <Plus size={17} />
            Add{' '}
            {kind === 'branches'
              ? 'branch'
              : kind === 'clients'
                ? 'client'
                : kind === 'units'
                  ? 'unit'
                  : kind === 'garments'
                    ? 'garment type'
                    : 'service'}
          </Link>
        )}
      </div>
      <nav className="section-tabs" aria-label="Master data sections">
        {Object.entries(labels).map(([key, label]) => (
          <Link
            key={key}
            href={'/workspace/masters/' + key}
            aria-current={kind === key ? 'page' : undefined}
            className={kind === key ? 'selected' : ''}
          >
            {label}
          </Link>
        ))}
      </nav>
      <section className="surface table-surface">
        <form className="filters" method="get">
          <label className="search">
            <Search size={17} />
            <input
              name="q"
              aria-label={`Search ${labels[kind]}`}
              defaultValue={filters.q}
              placeholder={`Search ${labels[kind].toLowerCase()}…`}
              maxLength={100}
            />
          </label>
          <label className="sr-only" htmlFor="archive-filter">
            Record state
          </label>
          <select id="archive-filter" name="archived" defaultValue={filters.archived ?? 'false'}>
            <option value="false">Active records</option>
            <option value="true">Archived records</option>
          </select>
          <label className="sr-only" htmlFor="sort">
            Sort records
          </label>
          <select id="sort" name="sort" defaultValue={filters.sort ?? 'name'}>
            <option value="name">Name A–Z</option>
            <option value="newest">Newest first</option>
          </select>
          <button className="button secondary" type="submit">
            Apply filters
          </button>
        </form>
        <div className="result-summary">
          <strong>{result.meta.total} records</strong>
          <span>
            Page {result.meta.page} of {result.meta.pages}
          </span>
        </div>
        {result.rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>
                    {kind === 'garments'
                      ? 'Unit'
                      : kind === 'services'
                        ? 'Route'
                        : 'Contact / address'}
                  </th>
                  <th>Updated</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/workspace/masters/${kind}/${row.id}`}>
                        <strong>{row.name}</strong>
                      </Link>
                      <small>
                        v{row.version} · {row.id.slice(0, 8)}
                      </small>
                    </td>
                    <td>
                      <span className={`status ${row.archived ? 'archived' : 'active'}`}>
                        {row.archived ? 'Archived' : 'Active'}
                      </span>
                    </td>
                    <td>
                      {row.unit ??
                        row.route?.replaceAll('_', ' → ') ??
                        row.contactName ??
                        row.address ??
                        '—'}
                    </td>
                    <td>
                      {new Intl.DateTimeFormat('en', {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      }).format(row.updatedAt)}
                      <small>UTC</small>
                    </td>
                    <td>
                      <Link
                        className="row-action"
                        href={`/workspace/masters/${kind}/${row.id}`}
                        aria-label={`View ${row.name}`}
                      >
                        <ArrowRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <FolderOpen size={34} />
            <h2>{filters.q ? 'No matching records.' : 'No records here yet.'}</h2>
            <p>
              {filters.q
                ? 'Try another search or change your filters.'
                : admin
                  ? 'Add your first record to get started. No fictional records have been added.'
                  : 'Ask your administrator to assign records to your scope.'}
            </p>
            {filters.q && (
              <Link className="text-link" href={`/workspace/masters/${kind}`}>
                Clear filters
              </Link>
            )}
          </div>
        )}
        <div className="pagination">
          {result.meta.page > 1 ? (
            <Link href={link(result.meta.page - 1)}>
              <ChevronLeft size={16} />
              Previous
            </Link>
          ) : (
            <span>First page</span>
          )}
          {result.meta.page < result.meta.pages ? (
            <Link href={link(result.meta.page + 1)}>
              Next
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span>Last page</span>
          )}
        </div>
      </section>
    </>
  );
}
