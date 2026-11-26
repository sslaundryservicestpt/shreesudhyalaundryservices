import { pageActor } from '@/server/page-access';
import WorkspaceShell from '@/components/WorkspaceShell';
export const dynamic = 'force-dynamic';
export default async function Workspace({ children }: { children: React.ReactNode }) {
  const actor = await pageActor();
  const now = new Date();
  const timeZone = 'Asia/Kolkata';
  const businessDate = new Intl.DateTimeFormat('sv-SE', { timeZone }).format(now);
  const businessDateLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(now);
  return (
    <WorkspaceShell
      name={actor.displayName}
      email={actor.email}
      roles={actor.roles}
      scopeCount={actor.scopes.length}
      businessDate={businessDate}
      businessDateLabel={businessDateLabel}
    >
      {children}
    </WorkspaceShell>
  );
}
