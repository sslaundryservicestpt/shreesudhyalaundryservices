import Link from 'next/link';
import { pageActor } from '@/server/page-access';
import { reportData } from '@/server/reports';
import ExportButton from '@/components/ExportButton';
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await pageActor(),
    search = await searchParams,
    result = await reportData(actor, search),
    admin = actor.roles.includes('ADMIN'),
    page = Math.min(10000, Math.max(1, Number(search.page) || 1));
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(search).filter(([k, v]) => v && k !== 'page')) as Record<
      string,
      string
    >,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REPORTS / RECONCILIATION</p>
          <h1>Trace the numbers.</h1>
          <p>
            Generated {result.generatedAt} · {result.rows.length} matching rows · Amounts are exact
            integer minor units.
          </p>
        </div>
        <div className="form-actions">
          <a className="button" href={`/api/v1/reports?${query}`}>
            Export matching CSV
          </a>
          <ExportButton filters={result.filter} />
        </div>
      </div>
      <section className="surface">
        <form className="filters">
          <label>
            Report
            <select name="kind" defaultValue={search.kind || 'work'}>
              {(admin
                ? ['work', 'quantities', 'invoices', 'payments', 'expenses', 'statement']
                : ['work', 'quantities']
              ).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            From UTC (ISO instant)
            <input name="from" placeholder="2026-11-01T00:00:00Z" defaultValue={search.from} />
          </label>
          <label>
            Exclusive end UTC
            <input name="to" placeholder="2026-12-01T00:00:00Z" defaultValue={search.to} />
          </label>
          <label>
            Branch UUID
            <input name="branch" defaultValue={search.branch} />
          </label>
          <label>
            Client UUID
            <input name="client" defaultValue={search.client} />
          </label>
          <button className="button">Apply filters</button>
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {result.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.slice((page - 1) * 50, page * 50).map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j}>{String(v ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!result.rows.length && <div className="empty-state">No matching source records.</div>}
        <div className="pagination">
          <span>Page {page} · 50 rows per page · Export includes all matching rows</span>
          {page > 1 && <Link href={`?${query}&page=${page - 1}`}>Previous</Link>}
          {page * 50 < result.rows.length && <Link href={`?${query}&page=${page + 1}`}>Next</Link>}
        </div>
      </section>
      <section className="surface panel-pad">
        <h2>How to read this report</h2>
        <p>
          Work reports filter on order creation time. Invoice reports filter on issuance time,
          payments on receipt time and expenses on incurred time. Every period is [start, end),
          using explicit UTC instants. Current outstanding includes all posted allocations and
          credit adjustments, including those posted after the filtered issue period. Reversed
          receipts contribute zero collections. PIECE and KG quantities remain separate.
        </p>
        <p>
          Customer statements show issued invoices and their current balances. Open customer credit
          is listed in the payments report. This workspace is operational finance, not a general
          ledger or an audited profit statement.
        </p>
      </section>
    </>
  );
}
