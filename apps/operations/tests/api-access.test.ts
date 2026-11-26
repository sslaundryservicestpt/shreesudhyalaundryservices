import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ principal: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock('../src/server/auth', () => ({ principal: mocks.principal }));
vi.mock('../src/server/masters', () => ({ listMasters: mocks.list, saveMaster: mocks.save }));
import { GET, POST } from '../src/app/api/v1/masters/[kind]/route';
import { DomainError } from '@shree/domain';
beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = 'http://localhost:3002';
});
describe('API refuses untrusted identity before record access', () => {
  it('anonymous GET has no database access', async () => {
    mocks.principal.mockRejectedValue(new DomainError('UNAUTHENTICATED', 'Please sign in', 401));
    const response = await GET(new Request('http://localhost:3002/api/v1/masters/clients'), {
      params: Promise.resolve({ kind: 'clients' }),
    });
    expect(response.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('supervisor direct API mutation is denied before service dispatch', async () => {
    mocks.principal.mockResolvedValue({
      id: '123e4567-e89b-42d3-a456-426614174000',
      active: true,
      roles: ['SUPERVISOR'],
      scopes: [],
    });
    const response = await POST(
      new Request('http://localhost:3002/api/v1/masters/clients', {
        method: 'POST',
        headers: { origin: 'http://localhost:3002', 'content-type': 'application/json' },
        body: '{"name":"Example"}',
      }),
      { params: Promise.resolve({ kind: 'clients' }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('disabled POST cannot invoke a command', async () => {
    mocks.principal.mockRejectedValue(new DomainError('ACCOUNT_DISABLED', 'Disabled', 403));
    const response = await POST(
      new Request('http://localhost:3002/api/v1/masters/clients', {
        method: 'POST',
        headers: { origin: 'http://localhost:3002', 'content-type': 'application/json' },
        body: '{"name":"Example"}',
      }),
      { params: Promise.resolve({ kind: 'clients' }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
