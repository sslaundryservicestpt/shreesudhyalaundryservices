import 'server-only';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { DomainError } from '@shree/domain';
export function requestId() {
  return randomUUID();
}
export function json(data: unknown, id: string, status = 200, meta?: unknown) {
  return Response.json(
    { data, ...(meta ? { meta } : {}), requestId: id },
    { status, headers: { 'Cache-Control': 'private, no-store', 'X-Request-Id': id } },
  );
}
export function failure(error: unknown, id: string) {
  if (error instanceof ZodError)
    error = new DomainError('VALIDATION_ERROR', 'Invalid path or request parameters.', 422);
  if (error instanceof DomainError)
    return Response.json(
      { error: { code: error.code, message: error.message, fields: error.fields }, requestId: id },
      { status: error.status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': id } },
    );
  console.error('Operations request failed', {
    requestId: id,
    errorType: error instanceof Error ? error.name : 'Unknown failure',
  });
  return Response.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'This action could not be completed. Please retry with the same request.',
      },
      requestId: id,
    },
    { status: 500, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': id } },
  );
}
export function verifyOrigin(request: Request) {
  const expected = process.env.APP_URL;
  if (!expected)
    throw new DomainError(
      'SETUP_REQUIRED',
      'APP_URL must be configured before accepting commands.',
      503,
    );
  if (request.headers.get('origin') !== new URL(expected).origin)
    throw new DomainError(
      'INVALID_ORIGIN',
      'This request did not originate from the operations application.',
      403,
    );
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    throw new DomainError('UNSUPPORTED_MEDIA_TYPE', 'Send JSON data.', 415);
}
export async function body(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length') || 0) > 32768)
    throw new DomainError('PAYLOAD_TOO_LARGE', 'This request is too large.', 413);
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let text = '',
    bytes = 0;
  if (reader) {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 32768) {
        await reader.cancel();
        throw new DomainError('PAYLOAD_TOO_LARGE', 'This request is too large.', 413);
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError('INVALID_JSON', 'The request must contain valid JSON.', 400);
  }
}
