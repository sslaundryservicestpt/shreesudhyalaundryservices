import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  finance: vi.fn(),
  financeView: vi.fn(),
}));
vi.mock('../src/server/auth', () => ({ principal: mocks.principal }));
vi.mock('../src/server/work', () => ({ createPickup: mocks.create, listWork: mocks.list }));
vi.mock('../src/server/finance', () => ({
  financeCommand: mocks.finance,
  financeView: mocks.financeView,
}));
import { POST as pickup, GET as list } from '../src/app/api/v1/work/route';
import { POST as finance } from '../src/app/api/v1/finance/route';
import { DomainError } from '@shree/domain';
beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = 'http://localhost:3002';
});
const request = (origin = 'http://localhost:3002') =>
  new Request('http://localhost:3002/api/v1/work', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: '{}',
  });
describe('operations and finance API boundaries', () => {
  it('rejects anonymous pickup and list access before service dispatch', async () => {
    mocks.principal.mockRejectedValue(new DomainError('UNAUTHENTICATED', 'Sign in.', 401));
    expect((await pickup(request())).status).toBe(401);
    expect((await list(new Request('http://localhost:3002/api/v1/work'))).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('rejects direct creation that bypasses CRM', async () => {
    mocks.principal.mockResolvedValue({
      id: 'actor',
      active: true,
      roles: ['SUPERVISOR'],
      scopes: [],
    });
    const response = await pickup(request());
    expect(response.status).toBe(410);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('blocks supervisor finance writes before dispatch', async () => {
    mocks.principal.mockResolvedValue({
      id: 'actor',
      active: true,
      roles: ['SUPERVISOR'],
      scopes: [],
    });
    expect((await finance(request())).status).toBe(403);
    expect(mocks.finance).not.toHaveBeenCalled();
  });
  it('blocks disabled users and cross-origin writes', async () => {
    mocks.principal.mockResolvedValue({ id: 'actor', active: false, roles: ['ADMIN'], scopes: [] });
    expect((await finance(request())).status).toBe(403);
    expect((await pickup(request('https://untrusted.invalid'))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
