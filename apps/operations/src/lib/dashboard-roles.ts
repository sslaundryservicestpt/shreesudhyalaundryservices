export type DashboardRole = 'admin' | 'supervisor' | 'executive';

export function dashboardRole(roles: readonly string[]): DashboardRole {
  if (roles.includes('ADMIN')) return 'admin';
  if (roles.includes('SUPERVISOR')) return 'supervisor';
  return 'executive';
}

export const dashboardWorkflows = {
  admin: [
    {
      title: 'Set up a client site',
      detail: 'Create the client, branch and processing unit before taking pickup requests.',
      href: '/workspace/masters/clients',
    },
    {
      title: 'Set client rates',
      detail: 'Add the agreed item prices, service and effective dates for each client.',
      href: '/workspace/finance?section=pricing',
    },
    {
      title: 'Assign staff access',
      detail: 'Give each staff member their role and authorized client sites or units.',
      href: '/workspace/access',
    },
    {
      title: 'Review exceptions',
      detail: 'Compare the driver’s count with the laundry’s count before accepting an adjustment.',
      href: '/workspace/work?view=exceptions',
    },
    {
      title: 'Close a billing cycle',
      detail: 'Generate a draft from reconciled deliveries after the client’s billing period ends.',
      href: '/workspace/finance?section=cycles',
    },
  ],
  supervisor: [
    {
      title: 'Log an enquiry',
      detail: 'Record the client’s request, choose the site, and assign an executive.',
      href: '/workspace/crm',
    },
    {
      title: 'Receive and verify',
      detail: 'Count at the laundry and compare with what the executive collected.',
      href: '/workspace/work?view=receiving',
    },
    {
      title: 'Process and check quality',
      detail: 'Track batches through each service step, then pass them or send them to rework.',
      href: '/workspace/work?view=processing',
    },
    {
      title: 'Recount and queue delivery',
      detail: 'Check packed quantities, choose the driver, and queue the order.',
      href: '/workspace/work?view=outward',
    },
  ],
  executive: [
    {
      title: 'Start a pickup',
      detail: 'Open an assigned stop, start travel and confirm arrival at the client site.',
      href: '/workspace/pickups',
    },
    {
      title: 'Record collected pieces',
      detail: 'Count each item on site and save the pickup before handing it to the laundry.',
      href: '/workspace/work?view=pickups',
    },
    {
      title: 'Dispatch and deliver',
      detail:
        'Open a ready delivery, and record the recipient and accepted pieces.',
      href: '/workspace/work?view=deliveries',
    },
    {
      title: 'Review completed stops',
      detail: 'Use your history to confirm previous pickups and handovers.',
      href: '/workspace/work?view=history',
    },
  ],
} as const;
