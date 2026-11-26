import 'server-only';
import { createHash } from 'node:crypto';
import { createClient, type User } from '@supabase/supabase-js';
import { z } from 'zod';
import { DomainError } from '@shree/domain';
import { authConfig, registrationConfigured, registrationSecret } from './config';
import { database } from './db';

const staffSuffix = '@shreesudhayalaudary';
const providerSuffix = '@staff-login.example';
const alias = /^[a-z0-9][a-z0-9._-]{1,47}$/;
export const staffLogin = z
  .string()
  .trim()
  .max(254)
  .toLowerCase()
  .transform((login, ctx) => {
    if (alias.test(login)) return login + staffSuffix;
    if (login.endsWith(staffSuffix) && alias.test(login.slice(0, -staffSuffix.length)))
      return login;
    if (!login.endsWith(providerSuffix) && z.email().safeParse(login).success) return login;
    ctx.addIssue({ code: 'custom', message: 'Enter a username or email-style login.' });
    return z.NEVER;
  });

const contactPhone = z
  .string()
  .trim()
  .max(25)
  .refine(
    (value) =>
      !value || (/^\+?[\d(). -]+$/.test(value) && /^\d{7,15}$/.test(value.replace(/\D/g, ''))),
    'Enter a valid phone number or leave it blank.',
  )
  .optional();

export const registrationInput = z
  .object({
    displayName: z.string().trim().min(2).max(160),
    login: staffLogin,
    password: z.string().min(12).max(256),
    contactPhone,
  })
  .strict();

export function internalLoginEmail(login: string) {
  return createHash('sha256').update(login).digest('hex').slice(0, 48) + providerSuffix;
}

const internalIdentity = z.object({
  login: staffLogin,
  displayName: z.string().trim().min(2).max(160),
  contactPhone,
});

/** Only a server-provisioned identity can enqueue an internal staff request. */
export async function queueStaffRequest(user: User, requestId: string) {
  const identity = internalIdentity.safeParse(user.app_metadata.operations_staff);
  if (!identity.success || user.email !== internalLoginEmail(identity.data.login)) return false;
  const { login, displayName } = identity.data;
  return database().$transaction(async (tx) => {
    const created = await tx.userProfile.createMany({
      data: { authUserId: user.id, email: login, displayName, active: false },
      skipDuplicates: true,
    });
    const profile = await tx.userProfile.findUniqueOrThrow({
      where: { authUserId: user.id },
      select: { id: true, active: true, _count: { select: { memberships: true } } },
    });
    if (created.count) {
      await tx.auditLog.create({
        data: {
          actorId: profile.id,
          resourceId: profile.id,
          resourceType: 'staff',
          action: 'STAFF_ACCESS_REQUESTED',
          requestId,
          ...(identity.data.contactPhone
            ? { after: { contactPhone: identity.data.contactPhone } }
            : {}),
        },
      });
    }
    return !profile.active && profile._count.memberships === 0;
  });
}

export async function registerStaff(input: z.output<typeof registrationInput>, requestId: string) {
  const secret = registrationSecret();
  if (!registrationConfigured() || !secret)
    throw new DomainError(
      'SETUP_REQUIRED',
      'Registration is unavailable. Contact your administrator.',
      503,
    );
  const { login, displayName, password, contactPhone } = input;
  if (
    await database().userProfile.findFirst({
      where: { email: { equals: login, mode: 'insensitive' } },
      select: { id: true },
    })
  ) {
    throw new DomainError(
      'LOGIN_UNAVAILABLE',
      'This login cannot be registered. Use sign-in or choose another login.',
      409,
    );
  }
  const { url, key } = authConfig();
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const email = internalLoginEmail(login);
  const result = await createClient(url, secret, options).auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      operations_staff: { login, displayName, ...(contactPhone ? { contactPhone } : {}) },
    },
  });
  let user = result.data?.user;
  if (result.error?.code === 'email_exists' || result.error?.code === 'user_already_exists') {
    // A retry after a database outage may finish the request only after proving password ownership.
    const existing = await createClient(url, key, options).auth.signInWithPassword({
      email,
      password,
    });
    user = existing.data.user;
    if (!user || !(await queueStaffRequest(user, requestId)))
      throw new DomainError(
        'LOGIN_UNAVAILABLE',
        'This login cannot be registered. Use sign-in or choose another login.',
        409,
      );
    return;
  }
  if (result.error || !user)
    throw new DomainError(
      'REGISTRATION_UNAVAILABLE',
      'Registration could not be completed. Try again later or contact your administrator.',
      result.error?.status === 429 ? 429 : 503,
    );
  if (!(await queueStaffRequest(user, requestId)))
    throw new DomainError(
      'REGISTRATION_UNAVAILABLE',
      'The access request could not be saved. Retry with the same login.',
      503,
    );
}
