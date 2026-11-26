import 'server-only';
import type { Principal } from '@shree/domain';
import { dashboardRole } from '@/lib/dashboard-roles';
import { database } from './db';
import { countCrmQueue, pickupNotices } from './crm';
import { executiveDashboardCounts, workScope } from './work';
import { pendingStaffFilter } from './staff';

export async function workspaceNotifications(actor: Principal) {
  const role = dashboardRole(actor.roles);
  if (role === 'executive') {
    const [notices, work] = await Promise.all([
      pickupNotices(actor),
      executiveDashboardCounts(actor),
    ]);
    return [
      ...notices.map((notice) => ({
        label: 'New pickup assigned',
        detail: notice.pickup.lead.branch?.name ?? 'Open pickup for details',
        href: '/workspace/pickups?task=' + notice.pickupId,
        count: 1,
      })),
      {
        label: 'Work orders to pick up',
        href: '/workspace/work?view=pickups&stage=pending',
        count: work.pending,
      },
      {
        label: 'Deliveries ready to start',
        href: '/workspace/work?view=deliveries&stage=queued',
        count: work.queued,
      },
    ].filter((item) => item.count > 0);
  }

  const db = database();
  const [enquiries, groups, staff, drafts] = await Promise.all([
    countCrmQueue(actor, 'NEW'),
    db.workOrder.groupBy({
      by: ['queue'],
      where: {
        AND: [
          workScope(actor),
          {
            queue: {
              in: [
                'RECEIVING',
                'VERIFICATION',
                'PROCESSING',
                'DISCREPANCY',
                'DELIVERY_EXCEPTION',
                'QC',
                'REWORK',
                'OUTWARD',
              ],
            },
          },
        ],
      },
      _count: true,
    }),
    role === 'admin' ? db.userProfile.count({ where: pendingStaffFilter }) : 0,
    role === 'admin' ? db.invoice.count({ where: { status: 'DRAFT' } }) : 0,
  ]);
  const counts = new Map(groups.map((group) => [group.queue, group._count]));
  const count = (...queues: string[]) =>
    queues.reduce((n, queue) => n + (counts.get(queue) ?? 0), 0);
  return [
    { label: 'New enquiries', href: '/workspace/crm?status=NEW', count: enquiries },
    {
      label: 'Pickups to receive or verify',
      href: '/workspace/work?view=receiving',
      count: count('RECEIVING', 'VERIFICATION'),
    },
    {
      label: 'Exceptions to review',
      href: '/workspace/work?view=exceptions',
      count: count('DISCREPANCY', 'DELIVERY_EXCEPTION'),
    },
    ...(role === 'supervisor'
      ? [
          {
            label: 'Orders in processing',
            href: '/workspace/work?view=processing',
            count: count('PROCESSING'),
          },
          {
            label: 'Quality checks and rework',
            href: '/workspace/work?view=quality',
            count: count('QC', 'REWORK'),
          },
          {
            label: 'Orders to release',
            href: '/workspace/work?view=outward',
            count: count('OUTWARD'),
          },
        ]
      : [
          { label: 'Staff access requests', href: '/workspace/access#requests', count: staff },
          {
            label: 'Draft invoices to review',
            href: '/workspace/finance?section=invoices&status=DRAFT',
            count: drafts,
          },
        ]),
  ].filter((item) => item.count > 0);
}
