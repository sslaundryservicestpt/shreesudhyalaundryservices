import { z } from 'zod';
import Link from 'next/link';
import { pageActor } from '@/server/page-access';
import { exportJob } from '@/server/exports';
export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().parse((await params).id),
    { job, p } = await exportJob(await pageActor(), id),
    ready =
      job.processedAt && typeof p.expiresAt === 'string' && new Date(p.expiresAt) > new Date();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REPORTS / PRIVATE EXPORT</p>
          <h1>
            {ready
              ? 'Your report is ready.'
              : job.failedAt
                ? 'Export needs attention.'
                : job.processedAt
                  ? 'Download window expired.'
                  : 'Preparing your report.'}
          </h1>
          <p>
            {job.attempts} attempts · Requested {job.createdAt.toISOString()}
          </p>
        </div>
        <Link href="/workspace/reports" className="text-link">
          Back to reports
        </Link>
      </div>
      <section className="surface panel-pad">
        {ready ? (
          <a className="button" href={`/api/v1/exports/${id}?download=1`}>
            Download CSV
          </a>
        ) : (
          <p>
            Run the worker and refresh this page. After expiry, request a new export. Access is
            checked again on download and invalidated when role or scope changes.
          </p>
        )}
        {typeof p.expiresAt === 'string' && <p>Download expires: {p.expiresAt}</p>}
        {job.lastError && <p role="alert">{job.lastError}</p>}
        <Link className="button secondary" href={`/workspace/exports/${id}`}>
          Refresh status
        </Link>
      </section>
    </>
  );
}
