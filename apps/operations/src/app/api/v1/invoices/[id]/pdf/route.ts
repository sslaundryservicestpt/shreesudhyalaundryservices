import { z } from 'zod';
import { requireAdmin, DomainError } from '@shree/domain';
import { principal } from '@/server/auth';
import { database } from '@/server/db';
import { failure, requestId } from '@/server/http';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const correlation = requestId();
  try {
    requireAdmin(await principal());
    const i = await database().invoice.findUnique({
      where: { id: z.uuid().parse((await context.params).id) },
    });
    if (!i || i.status !== 'ISSUED')
      throw new DomainError('NOT_FOUND', 'Issued invoice not found.', 404);
    if (!i.pdf)
      throw new DomainError(
        'PDF_PENDING',
        'PDF is pending. Run the worker or review its job status.',
        409,
      );
    return new Response(new Uint8Array(i.pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${i.number}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e, correlation);
  }
}
