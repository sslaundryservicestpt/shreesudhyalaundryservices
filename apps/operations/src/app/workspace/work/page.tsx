import Link from 'next/link';
import { pageActor } from '@/server/page-access';
import { listWork } from '@/server/work';
import QueueRefresh from '@/components/QueueRefresh';
import { coordinatorQueues, pendingAssignments, workQueueLabels } from '@/lib/work-queues';
import { displayQuantity, type WorkState } from '@shree/domain';
export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await pageActor(),
    search = await searchParams,
    result = await listWork(actor, search),
    coordinator = actor.roles.some((r) => r === 'ADMIN' || r === 'SUPERVISOR');
  const href = (page: number) =>
    '/workspace/work?' +
    new URLSearchParams({
      ...(Object.fromEntries(Object.entries(search).filter(([, v]) => v !== undefined)) as Record<
        string,
        string
      >),
      page: String(page),
    });
  const stageLabels: Record<string, string> = {
    pending: 'Pending pickups due by today',
    onPickup: 'Pickups in progress due by today',
    queued: 'Queued deliveries',
    onDelivery: 'Deliveries in transit',
  };
  const queueHeadings: Record<string, string> = {
    processing: 'Orders in processing',
    deliveries: 'Open deliveries',
    exceptions: 'Exceptions to review',
    unbilled: 'Delivered orders awaiting billing',
  };
  const heading = search.stage
    ? stageLabels[search.stage]
    : coordinator
      ? (queueHeadings[search.view ?? ''] ?? 'Work queue')
      : 'Your assigned work';
  const counts = new Map(result.groups.map((group) => [group.queue, group._count]));
  const queues =
    search.stage || search.view === 'unbilled'
      ? []
      : coordinator
        ? coordinatorQueues
        : (['PICKUP', 'DELIVERY', 'IN_TRANSIT', 'COMPLETED'] as const);

  const routes = new Map<string, { label: string; stops: { id: string; branch: string }[] }>();
  if (!coordinator && (search.view === 'today' || search.view === 'deliveries' || !search.view)) {
    for (const row of result.rows) {
      const state = row.state as unknown as WorkState;
      const label = state.deliveries
        .find((delivery) => delivery.status === 'ASSIGNED')
        ?.routeLabel?.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const group = routes.get(key) ?? { label, stops: [] };
      group.stops.push({ id: row.id, branch: row.branchName });
      routes.set(key, group);
    }
  }
  const matchingRoutes = [...routes.values()].filter((route) => route.stops.length > 1);
  return (
    <>
      <QueueRefresh
        assignments={coordinator ? undefined : pendingAssignments(actor.id, result.rows)}
      />
      <div className="page-heading">
        <div>
          <p className="eyebrow">OPERATIONS / WORK QUEUE</p>
          <h1>{heading}</h1>
          <p>
            {search.view === 'today'
              ? 'Pickups due today or earlier in Tirupati, plus open delivery assignments. '
              : ''}
            New assignments appear here automatically while this tab is open.
          </p>
        </div>
        {coordinator && (
          <Link className="button" href="/workspace/work/new">
            Arrange a pickup
          </Link>
        )}
      </div>
      <div className="queue-grid">
        {queues.map((queue) => (
          <Link
            className="metric-card"
            key={queue}
            href={
              '/workspace/work?' +
              new URLSearchParams({ view: search.view || 'all', status: queue })
            }
          >
            <strong>{counts.get(queue) ?? 0}</strong>
            <p>{workQueueLabels[queue]}</p>
          </Link>
        ))}
      </div>
      {matchingRoutes.length > 0 && (
        <section className="surface panel-pad">
          <h2>Stops on the same dispatch route</h2>
          <p>
            These queued stops on this page share a route label set by your supervisor. Confirm each
            delivery separately.
          </p>
          {matchingRoutes.map((route) => (
            <div key={route.label} className="timeline-item">
              <strong>
                {route.label} · {route.stops.length} stops
              </strong>
              {route.stops.map((stop) => (
                <Link key={stop.id} href={'/workspace/work/' + stop.id}>
                  {stop.branch}
                </Link>
              ))}
            </div>
          ))}
        </section>
      )}
      <section className="surface">
        <form className="filters">
          {search.stage && <input type="hidden" name="stage" value={search.stage} />}
          <input type="hidden" name="view" value={search.view || 'all'} />
          <label>
            Search branch or order
            <input name="q" defaultValue={search.q} placeholder="Branch name or order number" />
          </label>
          <label>
            Status
            <select name="status" defaultValue={search.status || 'ALL'}>
              {[
                'ALL',
                'PICKUP',
                'RECEIVING',
                'VERIFICATION',
                'DISCREPANCY',
                'PROCESSING',
                'QC',
                'REWORK',
                'OUTWARD',
                'DELIVERY',
                'IN_TRANSIT',
                'COMPLETED',
                'CANCELLED',
                'DELIVERY_EXCEPTION',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button className="button">Filter</button>
          <Link className="text-link" href={'/workspace/work?view=' + (search.view || 'all')}>
            Clear
          </Link>
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order / branch</th>
                <th>Next queue</th>
                <th>Scheduled</th>
                <th>Quantities</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => {
                const s = r.state as unknown as WorkState;
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>SS-{String(r.number).padStart(6, '0')}</strong>
                      <br />
                      {r.branchName}
                    </td>
                    <td>
                      <span className="pill">
                        {r.queue === 'PICKUP'
                          ? (
                              {
                                ASSIGNED: 'Pending pickup',
                                EN_ROUTE: 'On the way',
                                ARRIVED: 'At client site',
                                COLLECTED: 'Collected',
                                CANCELLED: 'Cancelled',
                              } as const
                            )[s.pickup]
                          : workQueueLabels[r.queue as keyof typeof workQueueLabels] || r.queue}
                      </span>
                    </td>
                    <td>{r.scheduledAt.toISOString().slice(0, 16).replace('T', ' ')} UTC</td>
                    <td>
                      {s.pickup !== 'COLLECTED' && s.lines.length >= 5 && 'Count on collection'}
                      {s.lines
                        .filter(
                          (l) =>
                            l.pickup > 0 ||
                            (!l.inward && s.pickup !== 'COLLECTED' && s.lines.length < 5),
                        )
                        .map((l) => (
                          <div key={l.id}>
                            {l.name}:{' '}
                            {!coordinator
                              ? displayQuantity(l.pickup, l.unit)
                              : l.accepted === null
                                ? 'Awaiting inward approval'
                                : displayQuantity(l.accepted, l.unit)}
                          </div>
                        ))}
                    </td>
                    <td>
                      <Link className="text-link" href={`/workspace/work/${r.id}`}>
                        View journey →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!result.rows.length && (
          <div className="empty-state">
            <h2>No matching work.</h2>
            <p>Create a pickup or adjust the filters. Executives see assigned work only.</p>
          </div>
        )}
        <div className="pagination">
          <span>
            {result.total} matching orders · Page {result.page}
          </span>
          {result.page > 1 && <Link href={href(result.page - 1)}>Previous</Link>}
          {result.page * 20 < result.total && <Link href={href(result.page + 1)}>Next</Link>}
        </div>
      </section>
    </>
  );
}
