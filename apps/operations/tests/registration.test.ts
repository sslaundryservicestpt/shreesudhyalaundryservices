import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  createProfile: vi.fn(),
  findFirst: vi.fn(),
  createAudit: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { admin: { createUser: mocks.createUser } } }),
}));
vi.mock('../src/server/config', () => ({
  authConfig: () => ({ url: 'https://auth.example.invalid', key: 'fake-publishable-key' }),
  registrationConfigured: () => true,
  registrationSecret: () => 'fake-server-key',
}));
vi.mock('../src/server/db', () => ({
  database: () => ({
    userProfile: { findFirst: mocks.findFirst },
    $transaction: (transaction: (db: unknown) => unknown) =>
      transaction({
        userProfile: {
          createMany: mocks.createProfile,
          findUniqueOrThrow: () => ({
            id: 'test-profile',
            active: false,
            _count: { memberships: 0 },
          }),
        },
        auditLog: { create: mocks.createAudit },
      }),
  }),
}));
import {
  internalLoginEmail,
  registerStaff,
  registrationInput,
  staffLogin,
} from '../src/server/registration';

it('provisions a password account without emailing the supplied login', async () => {
  const input = registrationInput.parse({
    displayName: 'Team Member',
    login: ' Jo@shreesudhayalaudary ',
    password: 'fictional-password',
    contactPhone: '+91 98765 43210',
  });
  expect(registrationInput.safeParse({ ...input, contactPhone: 'invalid' }).success).toBe(false);
  expect(registrationInput.safeParse({ ...input, contactPhone: '' }).success).toBe(true);
  expect(staffLogin.parse('JO')).toBe(input.login);
  expect(staffLogin.parse('dummy@example.invalid')).toBe('dummy@example.invalid');
  mocks.findFirst.mockResolvedValue(null);
  mocks.createUser.mockImplementation(async (identity) => ({
    data: { user: { ...identity, id: 'test-auth-user' } },
    error: null,
  }));
  mocks.createProfile.mockResolvedValue({ count: 1 });
  await registerStaff(input, 'test-request');
  expect(mocks.createUser).toHaveBeenCalledWith({
    email: internalLoginEmail(input.login),
    email_confirm: true,
    password: input.password,
    app_metadata: {
      operations_staff: {
        login: input.login,
        displayName: input.displayName,
        contactPhone: input.contactPhone,
      },
    },
  });
  expect(mocks.createProfile).toHaveBeenCalledWith({
    data: {
      authUserId: 'test-auth-user',
      email: input.login,
      displayName: input.displayName,
      active: false,
    },
    skipDuplicates: true,
  });
  expect(mocks.createAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        action: 'STAFF_ACCESS_REQUESTED',
        after: { contactPhone: input.contactPhone },
      }),
    }),
  );
});
