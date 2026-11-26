import { pickupRegister, type PickupRegister } from '@/lib/pickup-register';

export default function InvoicePickupRegister({
  downloadHref,
  ...props
}: Parameters<typeof pickupRegister>[0] & { downloadHref?: string }) {
  return (
    <section className="surface panel-pad invoice-pickup-register">
      <div className="section-heading">
        <h2>Pickup register</h2>
        {downloadHref && (
          <a className="button secondary" href={downloadHref}>
            Download pickup register (CSV)
          </a>
        )}
      </div>
      <p>Verified billed quantities by pickup date, using the rates saved on the invoice.</p>
      <PickupRegisterTable register={pickupRegister(props)} />
    </section>
  );
}

export function PickupRegisterTable({ register }: { register: PickupRegister }) {
  const { columns, rows, pickupCount, pickupDays, undated, totals, totalQuantity, subtotal } =
    register;
  return (
    <>
      <p className="pickup-register-summary">
        <span>
          <strong>{pickupDays}</strong> pickup {pickupDays === 1 ? 'day' : 'days'}
        </span>
        <span>
          <strong>{pickupCount}</strong> {pickupCount === 1 ? 'pickup' : 'pickups'}
        </span>
        {undated > 0 && <span>{undated} without a recorded pickup date</span>}
      </p>
      {rows.length > 0 ? (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Pickup quantities by date"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Particular</th>
                {columns.map(({ day, pickups }) => (
                  <th
                    key={day}
                    scope="col"
                    className={pickups ? 'pickup-register-active' : undefined}
                  >
                    {day === 'Undated' ? (
                      day
                    ) : (
                      <time dateTime={day} title={day}>
                        {day.slice(8)}
                        <small>/{day.slice(5, 7)}</small>
                      </time>
                    )}
                    {pickups > 0 && (
                      <small className="pickup-register-visits">
                        {pickups} {pickups === 1 ? 'pickup' : 'pickups'}
                      </small>
                    )}
                  </th>
                ))}
                <th scope="col">Total quantity</th>
                <th scope="col">Amount before tax</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">
                    {row.name}
                    <small className="pickup-register-visits">{row.service}</small>
                  </th>
                  {row.cells.map((cell, index) => (
                    <td key={columns[index].day}>{cell || '–'}</td>
                  ))}
                  <td>{row.quantity}</td>
                  <td>{row.amount || 'Rate needed'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Totals</th>
                {totals.map((total, index) => (
                  <td key={columns[index].day}>{total || '–'}</td>
                ))}
                <td>{totalQuantity}</td>
                <td>{subtotal || 'Rate needed'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p>No eligible pickups in this period.</p>
      )}
    </>
  );
}
