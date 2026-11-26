import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyBalances, type WorkState } from '@shree/domain';
import WorkflowPipeline from '../src/components/WorkflowPipeline';
import BrandLogo from '../src/components/BrandLogo';
const initial: WorkState = {
  pickup: 'ASSIGNED',
  custody: 'BRANCH',
  received: false,
  collectedAt: null,
  completedAt: null,
  lines: [],
  batches: [],
  deliveries: [],
};
describe('accessible brand and persisted workflow', () => {
  it('uses the real marketing asset with a text alternative', () => {
    const html = renderToStaticMarkup(createElement(BrandLogo));
    expect(html).toContain('/images/brand-logo-clean.jpg');
    expect(html).toContain('alt="Shree Sudhya Laundry Services"');
  });
  it('does not show quality or billing complete for unverified work', () => {
    const html = renderToStaticMarkup(createElement(WorkflowPipeline, { state: initial }));
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('Verification');
    expect(html).not.toContain('Ready for finance review');
    expect(html).not.toContain('data-done="true"');
  });
  it('distinguishes full delivery eligibility from invoice issuance', () => {
    const state: WorkState = {
      ...initial,
      pickup: 'COLLECTED',
      received: true,
      completedAt: '2026-11-17T00:00:00Z',
      lines: [
        {
          id: 'line',
          garmentId: 'garment',
          serviceId: 'service',
          name: 'Shirt',
          service: 'Iron only',
          unit: 'PIECE',
          route: ['IRON'],
          pickup: 1000,
          inward: 1000,
          accepted: 1000,
          discrepancy: null,
          balances: { ...emptyBalances(), DELIVERED: 1000 },
        },
      ],
      batches: [
        {
          id: 'batch',
          lineId: 'line',
          quantity: 1000,
          step: 1,
          status: 'DONE',
          machine: 'Iron',
          operator: 'Staff',
        },
      ],
    };
    const html = renderToStaticMarkup(createElement(WorkflowPipeline, { state }));
    expect(html).toContain('Ready for finance review');
    expect(html).toContain('does not mean an invoice has been issued');
  });
});
