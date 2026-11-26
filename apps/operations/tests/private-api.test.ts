import { beforeEach, describe, it, expect, vi } from 'vitest';
import { DomainError } from '@shree/domain';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  principal: vi.fn(),
  staff: vi.fn(),
  file: vi.fn(),
  content: vi.fn(),
  detail: vi.fn(),
}));
vi.mock('../src/server/auth', () => ({ principal: mocks.principal }));
vi.mock('../src/server/staff', () => ({ staffCommand: mocks.staff }));
vi.mock('../src/server/db', () => ({
  database: () => ({ fileAsset: { findUnique: mocks.file, findUniqueOrThrow: mocks.content } }),
}));
vi.mock('../src/server/work', () => ({ workDetail: mocks.detail }));
import { POST } from '../src/app/api/v1/staff/route';
import { GET } from '../src/app/api/v1/files/[id]/route';
const id = '123e4567-e89b-42d3-a456-426614174000';
beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = 'http://localhost:3002';
});
describe('private staff and evidence endpoints', () => {
  it.each(['SUPERVISOR', 'DELIVERY_EXECUTIVE'])(
    'refuses %s staff administration before dispatch',
    async (role) => {
      mocks.principal.mockResolvedValue({ id, active: true, roles: [role], scopes: [] });
      const r = await POST(
        new Request('http://localhost:3002/api/v1/staff', {
          method: 'POST',
          headers: { origin: 'http://localhost:3002', 'content-type': 'application/json' },
          body: '{}',
        }),
      );
      expect(r.status).toBe(403);
      expect(mocks.staff).not.toHaveBeenCalled();
    },
  );
  it('refuses anonymous file reads before metadata or content access', async () => {
    mocks.principal.mockRejectedValue(new DomainError('UNAUTHENTICATED', 'Sign in', 401));
    expect(
      (await GET(new Request('http://localhost:3002'), { params: Promise.resolve({ id }) })).status,
    ).toBe(401);
    expect(mocks.file).not.toHaveBeenCalled();
    expect(mocks.content).not.toHaveBeenCalled();
  });
  it('refuses evidence outside the order scope or executive projection before reading bytes', async () => {
    mocks.principal.mockResolvedValue({
      id,
      active: true,
      roles: ['DELIVERY_EXECUTIVE'],
      scopes: [],
    });
    mocks.file.mockResolvedValue({ orderId: id });
    mocks.detail.mockRejectedValueOnce(new DomainError('NOT_FOUND', 'Outside order', 404));
    expect(
      (await GET(new Request('http://localhost:3002'), { params: Promise.resolve({ id }) })).status,
    ).toBe(404);
    mocks.detail.mockResolvedValue({ files: [] });
    expect(
      (await GET(new Request('http://localhost:3002'), { params: Promise.resolve({ id }) })).status,
    ).toBe(404);
    expect(mocks.content).not.toHaveBeenCalled();
  });
});
