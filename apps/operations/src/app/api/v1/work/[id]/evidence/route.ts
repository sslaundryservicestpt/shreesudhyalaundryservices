import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { DomainError } from '@shree/domain';
import { principal } from '@/server/auth';
import { canWork, workDetail } from '@/server/work';
import { command, audit } from '@/server/commands';
import { failure, json, requestId } from '@/server/http';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlation = requestId();
  try {
    if (
      !process.env.APP_URL ||
      request.headers.get('origin') !== new URL(process.env.APP_URL).origin
    )
      throw new DomainError('INVALID_ORIGIN', 'Use the operations application.', 403);
    const actor = await principal(),
      id = z.uuid().parse((await context.params).id);
    await workDetail(actor, id);
    const mime = request.headers.get('content-type') || '';
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(mime))
      throw new DomainError('INVALID_FILE', 'Upload JPEG, PNG or PDF.', 415);
    const reader = request.body?.getReader();
    if (!reader) throw new DomainError('INVALID_FILE', 'Choose a file.', 422);
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const c = await reader.read();
      if (c.done) break;
      bytes += c.value.length;
      if (bytes > 5 * 1024 * 1024) {
        await reader.cancel();
        throw new DomainError('FILE_TOO_LARGE', 'Maximum file size is 5 MB.', 413);
      }
      chunks.push(c.value);
    }
    const content = Buffer.concat(chunks);
    const valid =
      mime === 'image/png'
        ? content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === 'image/jpeg'
          ? content[0] === 255 && content[1] === 216
          : content.subarray(0, 5).toString() === '%PDF-';
    if (!valid)
      throw new DomainError('INVALID_FILE', 'File contents do not match the selected format.', 422);
    const hash = createHash('sha256').update(content).digest('hex');
    const result = await command(
      actor,
      request.headers.get('idempotency-key') || '',
      correlation,
      'evidence:' + id,
      { hash, mime },
      async (tx, fresh) => {
        const row = await tx.workOrder.findUnique({ where: { id } });
        if (!row || !canWork(fresh, row))
          throw new DomainError('NOT_FOUND', 'Order not found.', 404);
        if ((await tx.fileAsset.count({ where: { orderId: id } })) >= 20)
          throw new DomainError('FILE_LIMIT', 'Maximum twenty evidence files per order.', 409);
        const fileId = randomUUID(),
          name = `evidence-${fileId}.${mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'pdf'}`;
        await tx.fileAsset.create({
          data: { id: fileId, orderId: id, name, mime, content, actorId: fresh.id },
        });
        await audit(tx, fresh, 'EVIDENCE_ATTACHED', 'work', id, correlation, undefined, {
          fileId,
          name,
        });
        return { id: fileId };
      },
      async (tx, fresh) => {
        const row = await tx.workOrder.findUnique({ where: { id } });
        if (!row || !canWork(fresh, row))
          throw new DomainError('NOT_FOUND', 'Order outside current access.', 404);
      },
    );
    return json(result, correlation, 201);
  } catch (e) {
    return failure(e, correlation);
  }
}
