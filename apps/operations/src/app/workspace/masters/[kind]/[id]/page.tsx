import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { masterKind, DomainError, formatMoney } from '@shree/domain';
import { pageActor } from '@/server/page-access';
import { getMaster } from '@/server/masters';
import MasterForm from '@/components/MasterForm';
import ArchiveButton from '@/components/ArchiveButton';
import PermissionDenied from '@/components/PermissionDenied';
import ClientSetup from '@/components/ClientSetup';
import { branchRateCatalog } from '@/server/finance';
import { database } from '@/server/db';
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ edit?: string; saved?: string; client?: string }>;
}) {
  const route = await params,
    parsed = masterKind.safeParse(route.kind);
  if (!parsed.success) notFound();
  const kind = parsed.data,
    actor = await pageActor(),
    admin = actor.roles.includes('ADMIN');
  const query = await searchParams;
  if (route.id === 'new') {
    if (!admin) return <PermissionDenied />;
    return (
      <>
        <div className="breadcrumbs">
          <Link href={`/workspace/masters/${kind}`}>{kind}</Link>
          <span>/</span>New record
        </div>
        <div className="page-heading">
          <div>
            <p className="eyebrow">BUILD YOUR WORKSPACE</p>
            <h1>{kind === 'clients' ? 'Add a client' : 'Add a record.'}</h1>
            <p>Identifiers and audit history are managed securely on the server.</p>
          </div>
        </div>
        <MasterForm
          kind={kind}
          initial={
            kind === 'branches' && z.uuid().safeParse(query.client).success
              ? { clientId: query.client }
              : undefined
          }
        />
      </>
    );
  }
  if (!z.uuid().safeParse(route.id).success) notFound();
  let record;
  try {
    record = await getMaster(actor, kind, route.id);
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) notFound();
    throw error;
  }
  if (query.edit === '1') {
    if (!admin) return <PermissionDenied />;
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">MASTER DATA</p>
            <h1>Edit {record.name}</h1>
            <p>Version {record.version}. Concurrent changes are checked before saving.</p>
          </div>
        </div>
        <MasterForm kind={kind} initial={record} />
      </>
    );
  }
  const canSetPrices = admin && kind === 'clients' && !record.archived;
  const catalog = canSetPrices ? await branchRateCatalog(actor) : undefined;
  const currentRates = catalog
    ? await database().rateContract.findMany({
        where: {
          clientId: record.id,
          clientManaged: true,
          currency: catalog.currency,
          endsAt: { gt: new Date() },
        },
        orderBy: [{ garmentId: 'asc' }, { serviceId: 'asc' }],
      })
    : [];
  return (
    <>
      <div className="breadcrumbs">
        <Link href={`/workspace/masters/${kind}`}>{kind}</Link>
        <span>/</span>
        {record.name}
      </div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">RECORD DETAILS</p>
          <h1>{record.name}</h1>
          <p>
            <span className={`status ${record.archived ? 'archived' : 'active'}`}>
              {record.archived ? 'Archived' : 'Active'}
            </span>{' '}
            Version {record.version}
          </p>
        </div>
        {admin && (
          <Link className="button" href={`?edit=1`}>
            Edit record
          </Link>
        )}
      </div>
      {canSetPrices && (
        <ClientSetup
          client={{ id: record.id, name: record.name }}
          catalog={catalog}
          prices={currentRates.map((rate) => ({
            id: rate.id,
            garmentId: rate.garmentId,
            serviceId: rate.serviceId,
            price: formatMoney(rate.rate, catalog?.scale ?? 2, rate.currency).slice(
              rate.currency.length + 1,
            ),
          }))}
        />
      )}
      {canSetPrices && (
        <section className="surface panel-pad">
          <h2>Client billing</h2>
          <div className="form-actions">
            <Link
              className="button secondary"
              href={`/workspace/finance?section=cycles&client=${record.id}`}
            >
              Review billing cycle
            </Link>
            <Link
              className="text-link"
              href={`/workspace/finance?section=invoices&client=${record.id}`}
            >
              View client invoices
            </Link>
          </div>
        </section>
      )}
      {admin && kind === 'branches' && !record.archived && (
        <div className="form-actions">
          <Link
            className="button"
            href={'/workspace/finance?section=pricing&branch=' + record.id + '#branch-rate-sheet'}
          >
            Set branch item rates
          </Link>
          <Link
            className="button secondary"
            href={'/workspace/finance?section=cycles&branch=' + record.id}
          >
            Prepare branch bill
          </Link>
        </div>
      )}
      {query.saved === '1' && (
        <p className="notice success">Showing the persisted server record.</p>
      )}
      <section className="surface">
        <dl className="record-details">
          {Object.entries(record).map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/([A-Z])/g, ' $1')}</dt>
              <dd>
                {value instanceof Date
                  ? value.toISOString()
                  : typeof value === 'boolean'
                    ? value
                      ? 'Yes'
                      : 'No'
                    : String(value ?? '—') || '—'}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {admin && (
        <ArchiveButton
          kind={kind}
          id={record.id}
          version={record.version}
          archived={record.archived}
        />
      )}
      <Link className="text-link" href={`/workspace/masters/${kind}`}>
        Back to records
      </Link>
    </>
  );
}
