import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { body, verifyOrigin, failure } from '../src/server/http';
import { DomainError } from '@shree/domain';
describe('HTTP command boundary', () => {
  it('rejects cross-origin writes and unconfigured application origin', () => {
    delete process.env.APP_URL;
    expect(() => verifyOrigin(new Request('http://localhost'))).toThrow('APP_URL');
    process.env.APP_URL = 'http://localhost:3002';
    expect(() =>
      verifyOrigin(
        new Request('http://localhost:3002/api', {
          headers: { origin: 'https://attacker.invalid', 'content-type': 'application/json' },
        }),
      ),
    ).toThrow('originate');
  });
  it('rejects malformed JSON and oversized body', async () => {
    await expect(
      body(new Request('http://localhost', { method: 'POST', body: '{' })),
    ).rejects.toThrow('valid JSON');
    await expect(
      body(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(32769) })),
    ).rejects.toThrow('large');
  });
  it('returns stable errors without exposing a stack', async () => {
    const response = failure(new DomainError('FORBIDDEN', 'Denied', 403), 'correlation');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: 'FORBIDDEN', message: 'Denied' },
      requestId: 'correlation',
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
