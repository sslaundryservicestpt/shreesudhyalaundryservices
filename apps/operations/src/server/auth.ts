import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { DomainError, requireIdentity, type Principal } from '@shree/domain';
import { authConfig } from './config';
import { database } from './db';
export async function authClient(writable = false) {
  const config = authConfig();
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      // Route handlers write refresh cookies; server-component reads are refreshed by proxy.
      setAll: (values) => {
        if (writable) values.forEach(({ name, value, options }) => jar.set(name, value, options));
      },
    },
  });
}
export async function principal(): Promise<Principal & { displayName: string; email: string }> {
  const auth = await authClient();
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user)
    throw new DomainError('UNAUTHENTICATED', 'Please sign in to continue.', 401);
  const profile = await database().userProfile.findUnique({
    where: { authUserId: data.user.id },
    include: { memberships: true, scopes: true },
  });
  if (!profile)
    throw new DomainError(
      'ACCESS_NOT_ASSIGNED',
      'An administrator must assign your account before you can access this workspace.',
      403,
    );
  const actor = {
    id: profile.id,
    active: profile.active,
    roles: profile.memberships.map((item) => item.role),
    scopes: profile.scopes.map(({ clientId, branchId, unitId }) => ({
      clientId,
      branchId,
      unitId,
    })),
    displayName: profile.displayName,
    email: profile.email,
  };
  requireIdentity(actor);
  return actor;
}
