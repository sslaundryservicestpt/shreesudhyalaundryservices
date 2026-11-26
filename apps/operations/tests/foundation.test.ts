import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { workspaceNavigation } from '../src/lib/navigation';
import { staffInput } from '../src/server/staff';
import { EmptyState, ErrorState, LoadingSkeleton, StatusBadge } from '../src/components/ui';
import { requireIdentity } from '@shree/domain';
describe('B2B foundation boundaries', () => {
  it('only offers real role-specific destinations', () => {
    const admin = workspaceNavigation(['ADMIN']),
      supervisor = workspaceNavigation(['SUPERVISOR']),
      exec = workspaceNavigation(['DELIVERY_EXECUTIVE']);
    expect(admin.map((x) => x.label)).toEqual(
      expect.arrayContaining([
        'Clients & pricing',
        'Billing',
        'Receivables',
        'Expenses',
        'Staff & roles',
      ]),
    );
    expect(supervisor.map((x) => x.label)).toContain('Quality & rework');
    expect(exec.map((x) => x.label)).toEqual([
      'Today',
      'Assigned pickups',
      'Collection history',
      'Deliveries',
      'History',
      'Profile',
    ]);
    expect([...supervisor, ...exec].some((x) => /finance|access|audit/.test(x.href))).toBe(false);
    expect(workspaceNavigation(['BRANCH_USER'])).toEqual([]);
    expect(() =>
      requireIdentity({ id: 'branch', active: true, roles: ['BRANCH_USER'], scopes: [] }),
    ).toThrow('No role');
  });
  it('rejects branch-user invitations and ambiguous or duplicate scope targets', () => {
    const base = {
      action: 'INVITE',
      email: 'staff@example.invalid',
      displayName: 'Staff',
      roles: ['SUPERVISOR'],
      scopes: [],
    };
    expect(staffInput.safeParse(base).success).toBe(true);
    expect(staffInput.safeParse({ ...base, roles: ['BRANCH_USER'] }).success).toBe(false);
    const id = '123e4567-e89b-42d3-a456-426614174000';
    expect(
      staffInput.safeParse({ ...base, scopes: [{ clientId: id, branchId: id }] }).success,
    ).toBe(false);
    expect(
      staffInput.safeParse({ ...base, scopes: [{ clientId: id }, { clientId: id }] }).success,
    ).toBe(false);
  });
  it('renders semantic empty, loading, error and non-color-only status states', () => {
    expect(
      renderToStaticMarkup(createElement(EmptyState, { title: 'No assigned work' })),
    ).toContain('No assigned work');
    expect(renderToStaticMarkup(createElement(ErrorState, null, 'Unable to load'))).toContain(
      'role="alert"',
    );
    expect(renderToStaticMarkup(createElement(LoadingSkeleton))).toContain('role="status"');
    const status = renderToStaticMarkup(
      createElement(StatusBadge, { tone: 'warning', children: 'Needs review' }),
    );
    expect(status).toContain('Needs review');
    expect(status).toContain('!');
  });
});
