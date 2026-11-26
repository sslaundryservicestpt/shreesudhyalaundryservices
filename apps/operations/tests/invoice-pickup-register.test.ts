import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import InvoicePickupRegister from '../src/components/InvoicePickupRegister';

it('groups same-day collections in Tirupati and totals the original invoice amounts', () => {
  const markup = renderToStaticMarkup(
    createElement(InvoicePickupRegister, {
      lines: [
        {
          orderId: 'a',
          garment: 'Bath towel',
          service: 'Wash',
          unit: 'PIECE',
          quantity: 2000,
          amount: '2000',
        },
        {
          orderId: 'b',
          garment: 'Bath towel',
          service: 'Wash',
          unit: 'PIECE',
          quantity: 3000,
          amount: '4500',
        },
        {
          orderId: 'c',
          garment: 'Bath towel',
          service: 'Wash',
          unit: 'PIECE',
          quantity: 1000,
          amount: '1000',
        },
      ],
      collections: {
        a: '2026-11-01T19:00:00Z',
        b: '2026-11-02T05:00:00Z',
        c: '2026-11-03T05:00:00Z',
      },
      timezone: 'Asia/Kolkata',
      money: (amount) => '₹' + amount,
    }),
  );
  expect(markup).toContain('<strong>2</strong> pickup days');
  expect(markup).toContain('<strong>3</strong> pickups');
  expect(markup).toContain('2026-11-02');
  expect(markup).toContain('2 pickups');
  expect(markup).toContain('₹7500');
  expect(markup).not.toContain('2026-11-01');
});
