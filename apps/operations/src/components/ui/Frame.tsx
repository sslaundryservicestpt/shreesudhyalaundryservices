import type { ReactNode } from 'react';
export function AppShell({
  children,
  collapsed = false,
}: {
  children: ReactNode;
  collapsed?: boolean;
}) {
  return <div className={'workspace ' + (collapsed ? 'collapsed' : '')}>{children}</div>;
}
export function Sidebar({ children }: { children: ReactNode }) {
  return <aside className="sidebar">{children}</aside>;
}
export function TopBar({ children }: { children: ReactNode }) {
  return <header className="topbar">{children}</header>;
}
