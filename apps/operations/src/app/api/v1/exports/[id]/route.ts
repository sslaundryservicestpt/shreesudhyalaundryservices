import { z } from 'zod';
import { DomainError } from '@shree/domain';
import { principal } from '@/server/auth';
import { exportJob } from '@/server/exports';
import { failure, requestId, json } from '@/server/http';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const correlation = requestId();
  try {
    const { job, p } = await exportJob(
      await principal(),
      z.uuid().parse((await context.params).id),
    );
    if (!new URL(request.url).searchParams.has('download'))
      return json(
        {
          id: job.id,
          processedAt: job.processedAt,
          failedAt: job.failedAt,
          attempts: job.attempts,
          lastError: job.lastError,
          expiresAt: p.expiresAt,
        },
        correlation,
      );
    if (
      typeof p.csv !== 'string' ||
      typeof p.expiresAt !== 'string' ||
      new Date(p.expiresAt) <= new Date()
    )
      throw new DomainError(
        'EXPORT_UNAVAILABLE',
        'Export is pending or its fifteen-minute download window expired.',
        409,
      );
    return new Response(p.csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="shree-report.csv"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e, correlation);
  }
}
