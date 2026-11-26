import './env';
import { PrismaClient, Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
// CLI only: no public HTTP bootstrap route, signup or service-role auth bypass.
export async function bootstrapAdmin() {
  const {
    DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    BOOTSTRAP_AUTH_USER_ID,
    BOOTSTRAP_EMAIL,
    BOOTSTRAP_DISPLAY_NAME,
  } = process.env;
  if (
    !DATABASE_URL ||
    !NEXT_PUBLIC_SUPABASE_URL ||
    !NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !BOOTSTRAP_AUTH_USER_ID ||
    !BOOTSTRAP_EMAIL ||
    !BOOTSTRAP_DISPLAY_NAME
  )
    throw Error('Configure the bootstrap environment documented in docs/local-setup.md.');
  // Prove possession of an invited identity's active access token, supplied only to this process.
  const token = process.env.BOOTSTRAP_ACCESS_TOKEN;
  if (!token)
    throw Error(
      'BOOTSTRAP_ACCESS_TOKEN from the invited user session is required. Never commit it.',
    );
  const auth = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.getUser(token);
  if (
    error ||
    data.user?.id !== BOOTSTRAP_AUTH_USER_ID ||
    data.user.email?.toLowerCase() !== BOOTSTRAP_EMAIL.toLowerCase() ||
    !data.user.email_confirmed_at
  )
    throw Error(
      'The token must belong to the verified invited identity named in the bootstrap configuration.',
    );
  const db = new PrismaClient();
  try {
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('initial-admin-bootstrap',0))`;
        if (await tx.roleMembership.count({ where: { role: 'ADMIN' } }))
          throw Error(
            'An administrator already exists. Bootstrap is locked; use the documented controlled provisioning procedure.',
          );
        const user = await tx.userProfile.create({
          data: {
            authUserId: BOOTSTRAP_AUTH_USER_ID,
            email: BOOTSTRAP_EMAIL,
            displayName: BOOTSTRAP_DISPLAY_NAME,
            memberships: { create: { role: 'ADMIN' } },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'INITIAL_ADMIN_BOOTSTRAP',
            resourceType: 'users',
            resourceId: user.id,
            requestId: randomUUID(),
            after: { authUserId: user.authUserId },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    console.log('Initial administrator provisioned. No password was created or stored.');
  } finally {
    await db.$disconnect();
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  bootstrapAdmin().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Bootstrap failed');
    process.exitCode = 1;
  });
