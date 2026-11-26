'use client';

import type { ReactNode } from 'react';

export type PriceCell = { name: string; value?: string; reference?: number; disabled?: boolean };
export type PriceRow = { id: string; item: string; cells: [PriceCell, PriceCell] };

export default function ClientPriceTable({
  rows,
  scale = 2,
  columns,
  canLoadReference = true,
}: {
  rows: PriceRow[];
  scale?: number;
  columns?: [ReactNode, ReactNode];
  canLoadReference?: boolean;
}) {
  const step = 10 ** -scale;
  return (
    <>
      {canLoadReference && (
        <button
          className="button secondary"
          type="button"
          onClick={(event) => {
            const form = event.currentTarget.form;
            for (const { cells } of rows) {
              for (const cell of cells) {
                const input = form?.elements.namedItem(cell.name);
                if (
                  input instanceof HTMLInputElement &&
                  !input.disabled &&
                  !input.value &&
                  cell.reference !== undefined
                )
                  input.value = String(cell.reference);
              }
            }
          }}
        >
          Fill blank fields from SBHS rate card
        </button>
      )}
      <div
        className="table-scroll client-price-table"
        tabIndex={0}
        role="region"
        aria-label="Item prices"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Particular</th>
              <th scope="col">Standard price{columns?.[0]}</th>
              <th scope="col">Heavy stain{columns?.[1]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, item, cells }) => (
              <tr key={id}>
                <th scope="row">{item}</th>
                {cells.map((cell, column) => (
                  <td key={cell.name}>
                    <input
                      name={cell.name}
                      aria-label={item + (column === 0 ? ' standard price' : ' heavy stain price')}
                      type="number"
                      inputMode={scale ? 'decimal' : 'numeric'}
                      min={step}
                      max={Math.max(1000 - step, Number(cell.value ?? 0)).toFixed(scale)}
                      step={step}
                      defaultValue={cell.value}
                      disabled={cell.disabled}
                      placeholder="—"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
