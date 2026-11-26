import {
  BadgeIndianRupee,
  ClipboardList,
  FileCheck2,
  PackageCheck,
  Shirt,
  TriangleAlert,
  Truck,
  UserRoundCheck,
} from 'lucide-react';
import AdminKpiCard from '@/components/AdminKpiCard';
import { pendingStaffFilter } from '@/server/staff';
import { verifiedSalesTotals } from '@/server/finance';
import DashboardWorkflow from '@/components/DashboardWorkflow';
import { dashboardRole } from '@/lib/dashboard-roles';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import Link from 'next/link';
import { pageActor } from '@/server/page-access';
import { countCrmQueue, executiveCrm } from '@/server/crm';
import { database } from '@/server/db';
import QueueRefresh from '@/components/QueueRefresh';
import { pendingAssignments, workQueueLabels } from '@/lib/work-queues';
import { executiveDashboardCounts, listWork, unbilledWorkFilter } from '@/server/work';
import { formatMoney, type Policy, type WorkState } from '@shree/domain';
export default async function Overview() {
  const actor = await pageActor();
  const role = dashboardRole(actor.roles);
  const admin = role === 'admin';
  const executive = role === 'executive';
  const [work, assignments, crm, adminData] = await Promise.all([
    listWork(actor, executive ? { view: 'today' } : {}),
    executive ? executiveDashboardCounts(actor) : null,
    executive ? executiveCrm(actor) : null,
    admin
      ? Promise.all([
          countCrmQueue(actor, 'NEW'),
          database().workOrder.count({ where: unbilledWorkFilter }),
          database().invoice.count({ where: { status: 'DRAFT' } }),
          database().userProfile.count({ where: pendingStaffFilter }),
          database().businessPolicy.findUnique({ where: { id: 'operations' } }),
          verifiedSalesTotals(actor),
        ])
      : null,
  ]);
  const counts = new Map(work.groups.map((group) => [group.queue, group._count]));
  const total = (...queues: string[]) =>
    queues.reduce((n, queue) => n + (counts.get(queue) ?? 0), 0);
  const workHref = (view: string) => '/workspace/work?view=' + view;
  const headers = {
    admin: {
      title: 'Operations & billing overview',
      description: 'Manage client accounts, monitor exceptions and close billing cycles.',
      action: 'Log an enquiry',
      href: '/workspace/crm?new=1',
    },
    supervisor: {
      title: 'Laundry floor & dispatch',
      description:
        'See what needs receiving, processing, quality checks or delivery release at your assigned sites.',
      action: 'Log an enquiry',
      href: '/workspace/crm?new=1',
    },
    executive: {
      title: 'My pickups & deliveries',
      description: 'Pickups due today or earlier in Tirupati, plus your open delivery assignments.',
      action: 'Open assigned pickups',
      href: '/workspace/pickups',
    },
  };
  const heading = headers[role];
  const metrics =
    role === 'supervisor'
      ? [
          {
            label: 'Receiving & verification',
            value: total('RECEIVING', 'VERIFICATION'),
            href: workHref('receiving'),
          },
          { label: 'Processing', value: total('PROCESSING'), href: workHref('processing') },
          { label: 'Quality & rework', value: total('QC', 'REWORK'), href: workHref('quality') },
          {
            label: 'Final recount & release',
            value: total('OUTWARD'),
            href: workHref('outward'),
          },
          {
            label: 'Exceptions',
            value: total('DISCREPANCY', 'DELIVERY_EXCEPTION'),
            href: workHref('exceptions'),
          },
          {
            label: 'Delivery & transit',
            value: total('DELIVERY', 'IN_TRANSIT'),
            href: workHref('deliveries'),
          },
        ]
      : [
          {
            label: 'Pending pickups',
            value: crm?.[2] ?? 0,
            href: '/workspace/pickups?stage=pending',
          },
          {
            label: 'Pending work orders',
            value: assignments?.pending ?? 0,
            href: workHref('pickups&stage=pending'),
          },
          {
            label: 'On pickup / at site',
            value: assignments?.onPickup ?? 0,
            href: workHref('pickups&stage=onPickup'),
          },
          {
            label: 'Queued deliveries',
            value: assignments?.queued ?? 0,
            href: workHref('deliveries&stage=queued'),
          },
          {
            label: 'On delivery',
            value: assignments?.onDelivery ?? 0,
            href: workHref('deliveries&stage=onDelivery'),
          },
        ];

  const [newEnquiries, unbilled, draftBills, staffRequests, settings, verifiedSales] =
    adminData ?? [0, 0, 0, 0, null, []];
  const policy = settings?.value as Policy | undefined;
  const sales = verifiedSales.length
    ? verifiedSales.map(({ amount, currency }) => formatMoney(amount, policy?.scale ?? 2, currency))
    : formatMoney(0n, policy?.scale ?? 2, policy?.currency ?? 'INR');
  const adminGroups = [
    {
      title: 'Daily operations',
      cards: [
        {
          label: 'New enquiries',
          value: newEnquiries,
          href: '/workspace/crm?status=NEW',
          action: 'Review enquiries',
          icon: ClipboardList,
        },
        {
          label: 'In processing',
          value: total('PROCESSING'),
          href: workHref('processing'),
          action: 'Open processing',
          icon: Shirt,
        },
        {
          label: 'Open deliveries',
          value: total('DELIVERY', 'IN_TRANSIT'),
          href: workHref('deliveries'),
          action: 'Track deliveries',
          icon: Truck,
          tone: 'green',
        },
        {
          label: 'Exceptions',
          value: total('DISCREPANCY', 'DELIVERY_EXCEPTION'),
          href: workHref('exceptions'),
          action: 'Review exceptions',
          icon: TriangleAlert,
          tone: 'gold',
        },
      ],
    },
    {
      title: 'Billing and staff',
      cards: [
        {
          label: 'Recognized sales',
          value: sales,
          href: '/workspace/finance?section=receivables#payments',
          action: 'Review payment receipts',
          icon: BadgeIndianRupee,
          tone: 'green',
          detail: 'Fully settled with verified payments · All time, incl. tax',
        },
        {
          label: 'Delivered, unbilled',
          value: unbilled,
          href: workHref('unbilled'),
          action: 'Review unbilled orders',
          icon: PackageCheck,
        },
        {
          label: 'Draft invoices',
          value: draftBills,
          href: '/workspace/finance?section=invoices&status=DRAFT',
          action: 'Review drafts',
          icon: FileCheck2,
        },
        {
          label: 'Staff approvals',
          value: staffRequests,
          href: '/workspace/access#requests',
          action: 'Open Staff & roles',
          icon: UserRoundCheck,
          tone: 'gold',
          detail: 'New accounts awaiting role assignment',
        },
      ],
    },
  ] as const;

  const nextAction = (raw: unknown, queue: string) => {
    if (!executive) return workQueueLabels[queue as keyof typeof workQueueLabels] ?? queue;
    const state = raw as WorkState;
    const delivery = state.deliveries.find(
      (item) => item.status === 'ASSIGNED' || item.status === 'DISPATCHED',
    );
    if (delivery) return delivery.status === 'ASSIGNED' ? 'Confirm dispatch' : 'Record handover';
    switch (state.pickup) {
      case 'ASSIGNED':
        return 'Start pickup';
      case 'EN_ROUTE':
        return 'Confirm arrival';
      case 'ARRIVED':
        return 'Count collected pieces';
      default:
        return 'Open assignment';
    }
  };

  return (
    <>
      <QueueRefresh assignments={executive ? pendingAssignments(actor.id, work.rows) : undefined} />
      <div className="dashboard-intro crm-heading">
        <PageHeader
          eyebrow={role.toUpperCase() + ' WORKSPACE'}
          title={heading.title}
          description={heading.description}
        >
          {admin && (
            <Link className="button secondary" href="/workspace/masters/clients/new">
              Add client
            </Link>
          )}
          <Link className="button" href={heading.href}>
            {heading.action}
          </Link>
        </PageHeader>
        <p className="muted">
          Signed in as <strong>{actor.displayName}</strong>
        </p>
      </div>
      {crm && (
        <section className="surface panel-pad">
          <h2>Assigned pickup requests</h2>
          <p>
            {crm[0].length
              ? 'Open a task for the pickup window and site contact.'
              : 'No active CRM pickup requests assigned.'}
          </p>
          <Link href="/workspace/pickups">View assigned pickups</Link>
          {crm[0].length > 0 && (
            <ul className="crm-record-list">
              {crm[0].slice(0, 4).map((pickup) => (
                <li key={pickup.id}>
                  <Link href={'/workspace/pickups?task=' + pickup.id}>
                    <strong>{pickup.lead.branch?.name}</strong>
                    <span>{pickup.status.toLowerCase().replaceAll('_', ' ')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {crm[1].length > 0 && (
            <ul className="crm-record-list">
              {crm[1].map((notice) => (
                <li key={notice.id}>
                  <Link href={'/workspace/pickups?task=' + notice.pickupId}>
                    New pickup assigned.
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {admin ? (
        <>
          {adminGroups.map(({ title, cards }) => (
            <section className="admin-kpi-section" key={title} aria-label={title}>
              <h2>{title}</h2>
              <div className="admin-kpi-grid">
                {cards.map((card) => (
                  <AdminKpiCard key={card.label} {...card} />
                ))}
              </div>
            </section>
          ))}
          {!policy?.approved && (
            <p className="setup-banner">
              <Link className="text-link" href="/workspace/finance?section=policy">
                Approve finance policies
              </Link>{' '}
              to post invoices and confirm delivery acknowledgements.
            </p>
          )}
        </>
      ) : (
        <div className="crm-kpis" aria-label="Current workload">
          {metrics.map((metric) => (
            <Link className="metric-card crm-kpi" key={metric.label} href={metric.href}>
              <strong>{metric.value}</strong>
              <p>{metric.label}</p>
              <small>Open queue →</small>
            </Link>
          ))}
        </div>
      )}
      <div className={admin ? 'admin-recent-work' : 'dashboard-priority'}>
        {!admin && <DashboardWorkflow role={role} />}
        <section className="surface panel-pad dashboard-orders">
          <div className="section-heading">
            <h2>{executive ? 'Next stops' : 'Recent orders'}</h2>
            <Link href={executive ? workHref('today') : '/workspace/work'} className="text-link">
              View queue
            </Link>
          </div>
          {work.rows.length ? (
            work.rows.slice(0, 5).map((r) => (
              <Link key={r.id} className="queue-row" href={`/workspace/work/${r.id}`}>
                <span>
                  <strong>SS-{String(r.number).padStart(6, '0')}</strong>
                  <small>{r.branchName}</small>
                </span>
                <StatusBadge>{nextAction(r.state, r.queue)}</StatusBadge>
              </Link>
            ))
          ) : (
            <EmptyState title={executive ? 'No stops due yet' : 'No orders in this workspace'}>
              <p>
                {executive
                  ? 'Assigned pickups and deliveries appear here. Check All pickups for future visits.'
                  : role === 'supervisor' && actor.scopes.length === 0
                    ? 'Ask an admin to assign your client, site or processing unit before logging pickups.'
                    : 'Orders appear here after your team creates them.'}
              </p>
              {executive && (
                <Link className="text-link" href={workHref('pickups')}>
                  All pickups →
                </Link>
              )}
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
