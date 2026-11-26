import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  findProfile: vi.fn(),
  setSession: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signInWithPassword: mocks.verifyPassword } }),
}));
vi.mock('../src/server/auth', () => ({
  authClient: async () => ({ auth: { setSession: mocks.setSession } }),
}));
vi.mock('../src/server/db', () => ({
  database: () => ({ userProfile: { findUnique: mocks.findProfile } }),
}));

import { localRoleOptions, signInToTestRole } from '../src/server/test-sign-in';

const host = 'localhost:3002';
function localConfig() {
  const db = 'postgresql://localhost:54322/laundry_test';
  for (const [key, value] of Object.entries({
    NODE_ENV: 'development',
    APP_URL: 'http://' + host,
    OPERATIONS_TEST_AUTOFILL: 'true',
    OPERATIONS_LOOPBACK_TEST_SERVER: '1',
    DATABASE_URL: db,
    TEST_DATABASE_URL: db,
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'mock-local-key',
    TEST_AUTOFILL_ADMIN_EMAIL: 'admin@example.invalid',
    TEST_AUTOFILL_ADMIN_PASSWORD: 'test-secret-not-for-client',
    TEST_AUTOFILL_SUPERVISOR_EMAIL: '',
    TEST_AUTOFILL_SUPERVISOR_PASSWORD: '',
    TEST_AUTOFILL_DELIVERY_EXECUTIVE_EMAIL: '',
    TEST_AUTOFILL_DELIVERY_EXECUTIVE_PASSWORD: '',
  }))
    vi.stubEnv(key, value);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe('local test sign-in', () => {
  it('keeps test passwords off the page and rejects production, remote and regular dev mode', async () => {
    localConfig();
    expect(localRoleOptions(host)).toEqual([
      {
        role: 'ADMIN',
        label: 'Admin',
        email: 'admin@example.invalid',
        previewHref: '/demo?role=admin',
      },
      {
        role: 'SUPERVISOR',
        label: 'Supervisor',
        email: null,
        previewHref: '/demo?role=supervisor',
      },
      {
        role: 'DELIVERY_EXECUTIVE',
        label: 'Executive',
        email: null,
        previewHref: '/demo?role=executive',
      },
    ]);
    expect(localRoleOptions('192.168.0.2:3002')).toEqual([]);
    vi.stubEnv('NODE_ENV', 'production');
    expect(localRoleOptions(host)).toEqual([]);
    await expect(signInToTestRole(host, 'ADMIN')).rejects.toMatchObject({ status: 404 });
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('OPERATIONS_LOOPBACK_TEST_SERVER', '');
    await expect(signInToTestRole(host, 'ADMIN')).rejects.toMatchObject({ status: 404 });
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });

  it('requires both local Auth and the explicit isolated database', async () => {
    localConfig();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://remote.example.invalid');
    await expect(signInToTestRole(host, 'ADMIN')).rejects.toMatchObject({ status: 404 });
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:54322/postgres');
    await expect(signInToTestRole(host, 'ADMIN')).rejects.toMatchObject({ status: 404 });
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });

  it('creates a session only after verifying the credentials and exact active role', async () => {
    localConfig();
    mocks.verifyPassword.mockResolvedValue({
      data: {
        user: { id: 'verified-test-user' },
        session: { access_token: 'access', refresh_token: 'refresh' },
      },
      error: null,
    });
    mocks.findProfile.mockResolvedValueOnce({
      active: true,
      memberships: [{ role: 'SUPERVISOR' }],
    });
    await expect(signInToTestRole(host, 'ADMIN')).rejects.toMatchObject({ status: 403 });
    expect(mocks.setSession).not.toHaveBeenCalled();
    mocks.findProfile.mockResolvedValueOnce({ active: true, memberships: [{ role: 'ADMIN' }] });
    mocks.setSession.mockResolvedValue({ error: null });
    await signInToTestRole(host, 'ADMIN');
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    });
  });
});
