'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell, Sidebar, TopBar } from './ui/Frame';
import BrandLogo from './BrandLogo';
import NotificationPanel from './NotificationPanel';
import { workspaceNavigation } from '@/lib/navigation';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  LayoutDashboard,
  Layers3,
  Building2,
  Shirt,
  ClipboardList,
  Receipt,
  Users,
  Settings,
  BarChart3,
  UserRound,
  Search,
  ShieldCheck,
  Menu,
  PanelLeftClose,
  LogOut,
  ArrowUpRight,
  BriefcaseBusiness,
  Truck,
  X,
} from 'lucide-react';
type Props = {
  name: string;
  email: string;
  roles: string[];
  scopeCount: number;
  businessDate: string;
  businessDateLabel: string;
  children: React.ReactNode;
};
export default function WorkspaceShell({
  name,
  email,
  roles,
  scopeCount,
  businessDate,
  businessDateLabel,
  children,
}: Props) {
  const [open, setOpen] = useState(false),
    [menuQuery, setMenuQuery] = useState(''),
    [collapsed, setCollapsed] = useState(false),
    [error, setError] = useState(''),
    [leaving, setLeaving] = useState(false);
  const path = usePathname(),
    search = useSearchParams();
  const admin = roles.includes('ADMIN'),
    supervisor = roles.includes('SUPERVISOR');
  async function signOut() {
    setLeaving(true);
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw Error();
      window.location.assign('/login');
    } catch {
      setError('Sign out failed. Please retry.');
      setLeaving(false);
    }
  }
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !drawer.current?.open) drawer.current?.showModal();
    if (!open && drawer.current?.open) drawer.current.close();
  }, [open]);
  const menuItems = workspaceNavigation(roles);
  const filteredItems = menuItems.filter((item) =>
    item.label.toLowerCase().includes(menuQuery.trim().toLowerCase()),
  );
  const roleLabel = admin ? 'Admin' : supervisor ? 'Supervisor' : 'Executive';
  const signOutControl = (
    <div className="workspace-sign-out">
      <button
        className="nav-link"
        type="button"
        aria-label="Sign out"
        onClick={signOut}
        disabled={leaving}
      >
        <LogOut size={16} aria-hidden="true" />
        <span>{leaving ? 'Signing out…' : 'Sign out'}</span>
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
  const nav = (
    <>
      <p className="nav-label">{admin ? 'MANAGEMENT' : supervisor ? 'MY WORKSPACE' : 'MY WORK'}</p>
      <label className="crm-menu-search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          aria-label="Find a menu item"
          placeholder="Find a menu item"
          value={menuQuery}
          onChange={(event) => setMenuQuery(event.target.value)}
        />
      </label>
      {menuQuery.trim() && !filteredItems.length && (
        <p className="workspace-menu-empty" role="status">
          No matching menu items.
        </p>
      )}
      {filteredItems.map((item) => {
        const Icon = /pickup|deliver/i.test(item.label)
          ? Truck
          : /client/i.test(item.label)
            ? Building2
            : /bill|pricing|receivable|expense/i.test(item.label)
              ? Receipt
              : /processing|quality/i.test(item.label)
                ? Shirt
                : /reports/i.test(item.label)
                  ? BarChart3
                  : /users|staff/i.test(item.label)
                    ? Users
                    : /settings/i.test(item.label)
                      ? Settings
                      : /profile/i.test(item.label)
                        ? UserRound
                        : /overview|today|my work/i.test(item.label)
                          ? LayoutDashboard
                          : ClipboardList;
        const url = new URL(item.href, 'http://workspace.local');
        const matchesPath =
          path === url.pathname ||
          (url.pathname !== '/workspace' && path.startsWith(url.pathname + '/')) ||
          (url.pathname === '/workspace/masters/clients' && path.startsWith('/workspace/masters/'));
        const financeSection = search.get('section') || 'invoices';
        const active =
          matchesPath &&
          [...url.searchParams].every(([key, value]) => {
            if (key === 'section')
              return (
                value === financeSection ||
                (value === 'invoices' &&
                  ['policy', 'cycles', 'credits', 'jobs'].includes(financeSection))
              );
            return (search.get(key) || 'all') === value;
          });
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            className={'nav-link ' + (active ? 'selected' : '')}
            onClick={() => setOpen(false)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
  return (
    <AppShell collapsed={collapsed}>
      <Sidebar>
        <Link href="/workspace" className="brand">
          <BrandLogo />
        </Link>
        <nav aria-label="Workspace navigation">{nav}</nav>
        <div className="sidebar-bottom">
          <span className="status-dot" />
          <span>
            Private workspace<small>Operations & finance</small>
          </span>
        </div>
        <button
          className="collapse-button"
          onClick={() => {
            setCollapsed(!collapsed);
            setMenuQuery('');
          }}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <PanelLeftClose size={18} />
          <span>Collapse sidebar</span>
        </button>
        {signOutControl}
      </Sidebar>
      <div className="workspace-main">
        <TopBar>
          <button
            className="icon-button mobile-toggle"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <Menu />
          </button>
          <div className="workspace-context">
            <span className="context-icon">
              {admin ? (
                <BriefcaseBusiness size={18} />
              ) : supervisor ? (
                <Layers3 size={18} />
              ) : (
                <Truck size={18} />
              )}
            </span>
            <span>
              {admin
                ? 'Administration'
                : supervisor
                  ? 'Supervisor workspace'
                  : 'Executive workspace'}
              <small>
                {admin
                  ? 'All authorised records'
                  : `${scopeCount} assigned scope${scopeCount === 1 ? '' : 's'}`}
              </small>
            </span>
          </div>
          <time className="workspace-business-date" dateTime={businessDate}>
            <CalendarDays size={15} aria-hidden="true" />
            {businessDateLabel}
          </time>
          <div className="workspace-header-actions">
            <NotificationPanel />
            <details className="profile">
              <summary>
                <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
                <span>{name}</span>
                <span className="workspace-role-badge">{roleLabel}</span>
              </summary>
              <div className="profile-menu">
                <strong>{name}</strong>
                <Link href="/workspace/profile">My profile</Link>
                <p>{email}</p>
              </div>
            </details>
          </div>
        </TopBar>
        <main id="content" className="content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Shree Sudhya · Internal operations</span>
          <span>
            <ShieldCheck size={13} /> Server-authorised access
          </span>
        </footer>
      </div>
      <dialog
        ref={drawer}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        className="mobile-drawer"
        aria-label="Workspace navigation"
      >
        <button
          autoFocus
          className="icon-button drawer-close"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <nav aria-label="Workspace navigation">{nav}</nav>
        <Link href="/workspace" onClick={() => setOpen(false)} className="text-link">
          My workspace <ArrowUpRight size={16} />
        </Link>
        {signOutControl}
      </dialog>
    </AppShell>
  );
}
