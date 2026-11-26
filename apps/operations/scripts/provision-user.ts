import './env';
import { PrismaClient, Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { roles } from '@shree/domain';
const input = z.object({
  actorId: z.uuid(),
  authUserId: z.uuid(),
  displayName: z.string().trim().min(1).max(160),
  role: z.enum(roles),
  scopes: z
    .array(
      z
        .object({
          clientId: z.uuid().optional(),
          branchId: z.uuid().optional(),
          unitId: z.uuid().optional(),
        })
        .refine((value) => Object.values(value).filter(Boolean).length === 1),
    )
    .max(100),
});
async function main() {
  if (
    !process.env.DATABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw Error(
      'Configure the server-only database and Supabase admin key for controlled provisioning. Never expose the admin key to Next public env.',
    );
  const raw = process.env.PROVISION_USER_JSON;
  if (!raw) throw Error('Pass PROVISION_USER_JSON as documented. No passwords are accepted.');
  const data = input.parse(JSON.parse(raw));
  const db = new PrismaClient();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const identity = await supabase.auth.admin.getUserById(data.authUserId);
    if (identity.error || !identity.data.user?.email || !identity.data.user.email_confirmed_at)
      throw Error('Identity must already be invited and verified in Supabase.');
    await db.$transaction(
      async (tx) => {
        const actor = await tx.userProfile.findUnique({
          where: { id: data.actorId },
          include: { memberships: true },
        });
        if (!actor?.active || !actor.memberships.some((item) => item.role === 'ADMIN'))
          throw Error('A current active administrator must authorise provisioning.');
        if (data.role === 'BRANCH_USER') throw Error('Branch portal is not enabled in Phase 1.');
        for (const scope of data.scopes) {
          if (
            scope.clientId &&
            !(await tx.client.findFirst({ where: { id: scope.clientId, archived: false } }))
          )
            throw Error('Invalid active client scope');
          if (
            scope.branchId &&
            !(await tx.branch.findFirst({ where: { id: scope.branchId, archived: false } }))
          )
            throw Error('Invalid active branch scope');
          if (
            scope.unitId &&
            !(await tx.laundryUnit.findFirst({ where: { id: scope.unitId, archived: false } }))
          )
            throw Error('Invalid active unit scope');
        }
        const user = await tx.userProfile.create({
          data: {
            authUserId: data.authUserId,
            email: identity.data.user.email!,
            displayName: data.displayName,
            memberships: { create: { role: data.role } },
            scopes: { create: data.scopes },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: 'PROVISION_USER',
            resourceType: 'users',
            resourceId: user.id,
            requestId: randomUUID(),
            after: { role: data.role, scopes: data.scopes },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    console.log('Verified invited user provisioned.');
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Provisioning failed');
  process.exitCode = 1;
});
