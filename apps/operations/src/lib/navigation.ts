export type NavigationItem = { href: string; label: string };
export function workspaceNavigation(roles: readonly string[]): NavigationItem[] {
  const work = (label: string, view: string): NavigationItem => ({
    label,
    href: '/workspace/work?view=' + view,
  });
  const finance = (label: string, section: string): NavigationItem => ({
    label,
    href: '/workspace/finance?section=' + section,
  });
  const profile = { label: 'Profile', href: '/workspace/profile' };
  if (roles.includes('ADMIN'))
    return [
      { label: 'Overview', href: '/workspace' },
      { label: 'Clients & pricing', href: '/workspace/masters/clients' },
      { label: 'CRM & pickups', href: '/workspace/crm' },
      { label: 'Operations', href: '/workspace/work' },
      finance('Billing', 'invoices'),
      finance('Receivables', 'receivables'),
      finance('Expenses', 'expenses'),
      finance('Loss & damage', 'losses'),
      { label: 'Reports', href: '/workspace/reports' },
      { label: 'Staff & roles', href: '/workspace/access' },
      { label: 'Audit', href: '/workspace/audit' },
      { label: 'Settings', href: '/workspace/settings' },
      profile,
    ];
  if (roles.includes('SUPERVISOR'))
    return [
      { label: 'My work', href: '/workspace' },
      { label: 'CRM & pickups', href: '/workspace/crm' },
      work('Existing work', 'pickups'),
      work('Receiving & verification', 'receiving'),
      work('Processing', 'processing'),
      work('Quality & rework', 'quality'),
      work('Outward release', 'outward'),
      work('Delivery', 'deliveries'),
      work('Exceptions', 'exceptions'),
      { label: 'Operational reports', href: '/workspace/reports' },
      profile,
    ];
  if (roles.includes('DELIVERY_EXECUTIVE'))
    return [
      { label: 'Today', href: '/workspace' },
      { label: 'Assigned pickups', href: '/workspace/pickups' },
      work('Collection history', 'pickups'),
      work('Deliveries', 'deliveries'),
      work('History', 'history'),
      profile,
    ];
  return [];
}
