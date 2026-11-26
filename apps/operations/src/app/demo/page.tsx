import Link from 'next/link';
import {
  Building2,
  Receipt,
  Settings,
  Shirt,
  ShieldCheck,
  Users,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Truck,
} from 'lucide-react';
import PracticeHandoff, {
  PendingPickupMetric,
  PracticeRoleNotifications,
} from '@/components/PracticeHandoff';
import PracticeFulfillment, { PracticeFulfillmentMetric } from '@/components/PracticeFulfillment';
import PracticeAdmin, {
  PracticeAdminMetrics,
  PracticeAdminNotifications,
  PracticeAssignmentSites,
} from '@/components/PracticeAdmin';
import BrandLogo from '@/components/BrandLogo';
import { PageHeader, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

const previews = {
  admin: {
    label: 'Admin',
    title: 'Operations & billing overview',
    description: 'Review client setup, count exceptions, pricing and completed billing cycles.',
    entries: [
      [
        'Clients & branches',
        'Client setup',
        'Active',
        'The client record links to its sites, approved piece rates and billing cycles.',
      ],
      [
        'Client pricing',
        'Bath towel · Wash & fold',
        'Effective rate',
        'A client rate of ₹10 per piece applies to this service. Another client can have a different rate.',
      ],
      [
        'Count exception',
        'SS-1042 · Bath towels',
        'Review required',
        'The executive recorded 24 pieces. The supervisor counted 23. The two observations remain separate.',
      ],
      [
        'Billing',
        'Monthly billing cycle',
        'Draft',
        'The draft includes only fully delivered and reconciled orders. Review quantities and rates before approval, issue and PDF generation.',
      ],
      [
        'Staff & access',
        'Supervisor · Main branch',
        'Scoped access',
        'The supervisor can work on the assigned branch. An executive sees only their own assignments.',
      ],
    ],
  },
  supervisor: {
    label: 'Supervisor',
    title: 'Laundry floor & dispatch',
    description:
      'Follow a pickup through receiving, processing, quality control and the delivery queue.',
    entries: [
      [
        'Log a pickup',
        'Pickup assignment',
        'Assigned',
        'Record the phone or WhatsApp request, client site, service, pickup window and assigned executive.',
      ],
      [
        'Receiving',
        'Count verification',
        'Count mismatch',
        'Compare 24 pieces collected with 23 received. The mismatch goes to the exception queue.',
      ],
      [
        'Processing',
        'Laundry processing',
        'Washing',
        'Track the batch, its machine and operator, the number of pieces, and the next service step.',
      ],
      [
        'Quality & rework',
        'SS-1044 · Double bed sheets',
        'QC',
        'Record passed pieces and send the rejected balance to rework.',
      ],
      [
        'Final recount & release',
        'SS-1045 · Table linen',
        'Ready',
        'Verify packed quantities and assign an executive. The app queues delivery only when all required counts match.',
      ],
    ],
  },
  executive: {
    label: 'Executive',
    title: 'My pickups & deliveries',
    description: 'See the stops assigned to you and the checks required at each stop.',
    entries: [],
  },
} as const;

type PreviewRole = keyof typeof previews;
const coordinatorViews = {
  admin: [
    {
      id: 'clients',
      label: 'Clients & pricing',
      icon: Building2,
      entry: 0,
      steps: [
        'Confirm the client and branch details',
        'Review the site’s service requirements',
        'Open pricing for the agreed rates',
      ],
    },
    {
      id: 'pricing',
      label: 'Client rates',
      icon: Settings,
      entry: 1,
      steps: [
        'Confirm the garment and service',
        'Check the client and effective date',
        'Review the rate before billing',
      ],
    },
    { id: 'handoffs', label: 'Review handoffs', icon: ClipboardList, entry: 2, steps: [] },
    {
      id: 'billing',
      label: 'Invoice review',
      icon: Receipt,
      entry: 3,
      steps: [
        'Confirm delivered orders and verified quantities',
        'Review the draft and rate snapshot',
        'Approve and issue through the live finance workspace',
      ],
    },
    {
      id: 'staff',
      label: 'Team access',
      icon: Users,
      entry: 4,
      steps: [
        'Check the staff role',
        'Review assigned branches',
        'Confirm that only the required workspace is available',
      ],
    },
    { id: 'payments', label: 'Verify payments', icon: Receipt, entry: 3, steps: [] },
    { id: 'expenses', label: 'Expenses', icon: ClipboardList, entry: 3, steps: [] },
    { id: 'losses', label: 'Loss & damage', icon: ShieldCheck, entry: 3, steps: [] },
  ],
  supervisor: [
    { id: 'assign', label: 'Assign a pickup', icon: ClipboardList, entry: 0, steps: [] },
    {
      id: 'verification',
      label: 'Verify received pickups',
      icon: ShieldCheck,
      entry: 1,
      steps: [],
    },
    {
      id: 'processing',
      label: 'Processing stages',
      icon: Shirt,
      entry: 2,
      steps: ['Wash', 'Dry', 'Fold and send to quality check'],
    },
    {
      id: 'quality',
      label: 'Quality checks',
      icon: PackageCheck,
      entry: 3,
      steps: [
        'Inspect the finish',
        'Record passed and rejected pieces',
        'Send rejected pieces to rework',
      ],
    },
    {
      id: 'dispatch',
      label: 'Prepare dispatch',
      icon: Truck,
      entry: 4,
      steps: [
        'Compare packed quantities with the accepted counts',
        'Resolve any differences',
        'Assign an executive for the handover',
      ],
    },
  ],
} as const;

const executiveViews = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    description: 'See pending collections and delivery work at a glance.',
  },
  {
    id: 'pickups',
    label: 'Pickup queue',
    icon: ClipboardList,
    description: 'Open an assigned branch and record its collected pieces.',
  },
  {
    id: 'pickup-history',
    label: 'Pickup history',
    icon: History,
    description: 'Review collected quantities and the status of each handoff.',
  },
  {
    id: 'deliveries',
    label: 'Deliveries to complete',
    icon: Truck,
    description: 'Review the stops and their handover requirements.',
  },
  {
    id: 'delivery-history',
    label: 'Completed deliveries',
    icon: PackageCheck,
    description: 'Review the recipient and quantities recorded at handover.',
  },
] as const;
const executiveAliases: Record<string, string> = {
  'task-0': 'pickups',
  'task-1': 'pickups',
  'metric-0': 'pickups',
  'metric-1': 'pickups',
  queue: 'pickups',
  'task-2': 'deliveries',
  'task-3': 'deliveries',
  'metric-2': 'deliveries',
  'task-4': 'delivery-history',
  'metric-3': 'delivery-history',
};

export default async function RolePreview({
  searchParams,
}: {
  searchParams: Promise<{ example?: string; role?: string; view?: string }>;
}) {
  const { role = 'admin', example, view } = await searchParams;
  const key = Object.hasOwn(previews, role) ? (role as PreviewRole) : 'admin';
  const preview = previews[key];
  const href = (destination?: string) =>
    '/demo?' + new URLSearchParams({ role: key, ...(destination ? { view: destination } : {}) });
  const target = view ?? (example ? 'task-' + example : 'overview');
  const executiveView =
    executiveViews.find((item) => item.id === (executiveAliases[target] ?? target)) ??
    executiveViews[0];
  const coordinatorMenu = key === 'executive' ? [] : coordinatorViews[key];
  const legacy = /^task-(\d+)$/.exec(target);
  const oldMetric = /^metric-(\d+)$/.exec(target);
  const oldMetricViews =
    key === 'admin'
      ? ['clients', 'handoffs', 'handoffs', 'billing']
      : ['verification', 'processing', 'quality', 'dispatch'];
  const destination = legacy
    ? coordinatorMenu[Number(legacy[1])]?.id
    : oldMetric
      ? oldMetricViews[Number(oldMetric[1])]
      : target;
  const coordinatorView = coordinatorMenu.find(
    (item) => item.id === (key === 'admin' && destination === 'pricing' ? 'clients' : destination),
  );
  const entry = coordinatorView ? preview.entries[coordinatorView.entry] : undefined;

  return (
    <div className="crm-preview-shell">
      <aside className="crm-preview-sidebar">
        <Link href="/login" aria-label="Shree Sudhya sign-in">
          <BrandLogo />
        </Link>
        <nav aria-label={preview.label + ' menu'}>
          {key === 'executive' ? (
            executiveViews.map(({ id, label, icon: Icon }) => (
              <Link
                key={id}
                href={href(id === 'overview' ? undefined : id)}
                className={'nav-link' + (executiveView.id === id ? ' selected' : '')}
                aria-current={executiveView.id === id ? 'page' : undefined}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))
          ) : (
            <>
              <Link
                className={!coordinatorView ? 'nav-link selected' : 'nav-link'}
                aria-current={!coordinatorView ? 'page' : undefined}
                href={href()}
              >
                <LayoutDashboard size={17} aria-hidden="true" />
                <span>Overview</span>
              </Link>
              {coordinatorMenu
                .filter(({ id }) => id !== 'pricing')
                .map(({ id, label, icon: Icon }) => (
                  <Link
                    key={id}
                    href={href(id)}
                    className={'nav-link' + (coordinatorView?.id === id ? ' selected' : '')}
                    aria-current={coordinatorView?.id === id ? 'page' : undefined}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                ))}
            </>
          )}
        </nav>
        <Link className="nav-link demo-exit" href="/login">
          <LogOut size={18} aria-hidden="true" /> Back to sign-in
        </Link>
      </aside>
      <main className="content role-preview" id="content">
        <header className="role-preview-header">
          <span className="workspace-role-badge">{preview.label}</span>
          {key === 'admin' ? (
            <PracticeAdminNotifications />
          ) : (
            <PracticeRoleNotifications role={key} />
          )}
        </header>
        <p className="practice-context">Practice workspace · Entries stay in this browser.</p>
        {key === 'executive' ? (
          <>
            {executiveView.id !== 'pickups' && executiveView.id !== 'pickup-history' && (
              <PageHeader
                eyebrow="Executive workspace"
                title={executiveView.id === 'overview' ? preview.title : executiveView.label}
                description={executiveView.description}
              />
            )}
            {executiveView.id === 'overview' && (
              <div className="crm-kpis" aria-label="Executive dashboard">
                <PendingPickupMetric href={href('pickups')} />
                <PracticeFulfillmentMetric view="deliveries" href={href('deliveries')} />
                <PracticeFulfillmentMetric
                  view="delivery-history"
                  href={href('delivery-history')}
                />
              </div>
            )}
            {executiveView.id === 'pickups' && <PracticeHandoff key="pickups" role={key} focus />}
            {executiveView.id === 'pickup-history' && (
              <PracticeHandoff key="history" role={key} history />
            )}
            {(executiveView.id === 'deliveries' || executiveView.id === 'delivery-history') && (
              <PracticeFulfillment key={executiveView.id} view={executiveView.id} />
            )}
          </>
        ) : coordinatorView?.id === 'assign' ? (
          <>
            <PageHeader
              title="Assign a pickup"
              description="Set the branch and instructions for the Executive’s next collection."
            />
            <PracticeHandoff
              key="assign"
              role="supervisor"
              assignment
              sites={<PracticeAssignmentSites />}
            />
          </>
        ) : coordinatorView?.id === 'verification' || coordinatorView?.id === 'handoffs' ? (
          <PracticeHandoff key={coordinatorView.id} role={key} />
        ) : key === 'supervisor' &&
          (coordinatorView?.id === 'processing' ||
            coordinatorView?.id === 'quality' ||
            coordinatorView?.id === 'dispatch') ? (
          <>
            <PageHeader eyebrow="Supervisor workspace" title={coordinatorView.label} />
            <PracticeFulfillment key={coordinatorView.id} view={coordinatorView.id} />
          </>
        ) : key === 'admin' &&
          coordinatorView &&
          (coordinatorView.id === 'clients' ||
            coordinatorView.id === 'pricing' ||
            coordinatorView.id === 'billing' ||
            coordinatorView.id === 'payments' ||
            coordinatorView.id === 'expenses' ||
            coordinatorView.id === 'losses') ? (
          <>
            <PageHeader eyebrow="Admin workspace" title={coordinatorView.label} />
            {coordinatorView.id === 'billing' && (
              <p>Review the draft and rate snapshot before confirming payment.</p>
            )}
            <PracticeAdmin key={coordinatorView.id} view={coordinatorView.id} />
          </>
        ) : coordinatorView && entry ? (
          <>
            <PageHeader eyebrow={preview.label + ' workspace'} title={coordinatorView.label} />
            <section className="surface panel-pad coordinator-task">
              <div>
                <StatusBadge>{entry[2]}</StatusBadge>
                <h2>{entry[1]}</h2>
                <p>{entry[3]}</p>
              </div>
              <details open>
                <summary>Workflow steps</summary>
                <ol>
                  {coordinatorView.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </details>
            </section>
          </>
        ) : (
          <>
            <PageHeader
              eyebrow={preview.label + ' workspace'}
              title={preview.title}
              description={preview.description}
            />
            {key === 'admin' ? (
              <div className="admin-kpi-grid" role="group" aria-label="Admin dashboard">
                <PracticeAdminMetrics />
              </div>
            ) : (
              <div className="crm-kpis" aria-label={preview.label + ' dashboard'}>
                <PendingPickupMetric href={href('verification')} queue="verification" />
                <PendingPickupMetric href={href('assign')} />
                <PracticeFulfillmentMetric view="processing" href={href('processing')} />
                <PracticeFulfillmentMetric view="quality" href={href('quality')} />
                <PracticeFulfillmentMetric view="dispatch" href={href('dispatch')} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
