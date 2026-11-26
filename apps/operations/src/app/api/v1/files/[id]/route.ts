import { z } from 'zod';
import { DomainError } from '@shree/domain';
import { database } from '@/server/db';
import { principal } from '@/server/auth';
import { workDetail } from '@/server/work';
import { failure, requestId } from '@/server/http';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const correlation = requestId();
  try {
    const actor = await principal(),
      id = z.uuid().parse((await context.params).id);
    const f = await database().fileAsset.findUnique({ where: { id }, select: { orderId: true } });
    if (!f) throw new DomainError('NOT_FOUND', 'File not found.', 404);
    const detail = await workDetail(actor, f.orderId);
    if (!detail.files.some((file) => file.id === id))
      throw new DomainError('NOT_FOUND', 'File outside current access.', 404);
    const content = await database().fileAsset.findUniqueOrThrow({ where: { id } });
    return new Response(new Uint8Array(content.content), {
      headers: {
        'Content-Type': content.mime,
        'Content-Disposition': `attachment; filename="${content.name}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return failure(e, correlation);
  }
}
