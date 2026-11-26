import { pageActor } from '@/server/page-access';
import { PageHeader, StatusBadge } from '@/components/ui';
export default async function Profile() {
  const actor = await pageActor();
  return (
    <>
      <PageHeader
        eyebrow="MY ACCOUNT"
        title={actor.displayName}
        description="Your server-verified workspace identity."
      />
      <section className="surface panel-pad">
        <p>{actor.email}</p>
        <p>
          {actor.roles.map((role) => (
            <StatusBadge key={role}>{role.replaceAll('_', ' ')}</StatusBadge>
          ))}
        </p>
        <p>
          {actor.scopes.length} assigned scope records. Ask an administrator to review access;
          profile changes cannot grant permissions.
        </p>
      </section>
    </>
  );
}
