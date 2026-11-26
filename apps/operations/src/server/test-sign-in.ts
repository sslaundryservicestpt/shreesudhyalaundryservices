import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { DomainError } from '@shree/domain';
import { authClient } from './auth';
import { authConfig } from './config';
import { database } from './db';
import { isLoopback, localSignInRequest } from './local-dev';

export const testRoles = ['ADMIN', 'SUPERVISOR', 'DELIVERY_EXECUTIVE'] as const;
type TestRole = (typeof testRoles)[number];
const labels: Record<TestRole, string> = {
  ADMIN: 'Admin',
  SUPERVISOR: 'Supervisor',
  DELIVERY_EXECUTIVE: 'Executive',
};
/** Test credentials are usable only against local Auth and an explicitly isolated local database. */
function isolatedTestEnvironment(host: string | null) {
  if (
    !localSignInRequest(host) ||
    process.env.OPERATIONS_TEST_AUTOFILL !== 'true' ||
    process.env.OPERATIONS_LOOPBACK_TEST_SERVER !== '1'
  )
    return false;
  try {
    const db = new URL(process.env.DATABASE_URL || '');
    const auth = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    return (
      isLoopback(db.hostname) &&
      /^postgres(?:ql)?:$/.test(db.protocol) &&
      db.pathname.endsWith('_test') &&
      process.env.DATABASE_URL === process.env.TEST_DATABASE_URL &&
      isLoopback(auth.hostname) &&
      /^https?:$/.test(auth.protocol)
    );
  } catch {
    return false;
  }
}

function account(role: TestRole) {
  const email = process.env[`TEST_AUTOFILL_${role}_EMAIL`]?.trim();
  const password = process.env[`TEST_AUTOFILL_${role}_PASSWORD`];
  return email && password ? { email, password } : null;
}

export function localRoleOptions(host: string | null) {
  if (!localSignInRequest(host)) return [];
  const enabled = isolatedTestEnvironment(host);
  return testRoles.map((role) => ({
    role,
    label: labels[role],
    email: enabled ? (account(role)?.email ?? null) : null,
    previewHref:
      '/demo?role=' + (role === 'DELIVERY_EXECUTIVE' ? 'executive' : role.toLowerCase()),
  }));
}

export async function signInToTestRole(host: string | null, role: TestRole) {
  const selected = isolatedTestEnvironment(host) ? account(role) : null;
  if (!selected)
    throw new DomainError('NOT_FOUND', 'This local test account is not configured.', 404);

  const { url, key } = authConfig();
  const verifier = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await verifier.auth.signInWithPassword(selected);
  if (error || !data.user || !data.session)
    throw new DomainError('SIGN_IN_FAILED', 'The configured test account could not sign in.', 401);

  const profile = await database().userProfile.findUnique({
    where: { authUserId: data.user.id },
    select: { active: true, memberships: { select: { role: true } } },
  });
  if (!profile?.active || profile.memberships.length !== 1 || profile.memberships[0].role !== role)
    throw new DomainError(
      'TEST_ROLE_MISMATCH',
      'This account needs exactly the selected test role and an active profile.',
      403,
    );

  const auth = await authClient(true);
  const session = await auth.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (session.error)
    throw new DomainError(
      'SIGN_IN_FAILED',
      'The test session could not be started. Retry sign-in.',
      401,
    );
}
