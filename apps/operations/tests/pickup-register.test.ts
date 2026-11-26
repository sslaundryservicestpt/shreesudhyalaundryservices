import { describe, expect, it } from 'vitest';
import {
  billingMonth,
  billingMonthForPeriod,
  pickupRegister,
  pickupRegisterCsv,
} from '../src/lib/pickup-register';

describe('monthly pickup register', () => {
  it('uses Tirupati month boundaries and includes every calendar date', () => {
    const period = billingMonth('2028-02')!;
    expect(period.startsAt).toBe('2028-01-31T18:30:00.000Z');
    expect(period.endsAt).toBe('2028-02-29T18:30:00.000Z');
    expect(period.days).toHaveLength(29);
    expect(billingMonthForPeriod(new Date(period.startsAt), new Date(period.endsAt))).toEqual(
      period,
    );
    expect(billingMonth('2028-13')).toBeNull();
  });

  it('counts visits once per order and keeps unpriced or mixed-unit totals explicit', () => {
    const line = {
      garment: '=Special linen',
      service: 'Wash',
      unit: 'PIECE',
      quantity: 2000,
      amount: '1200',
    };
    const register = pickupRegister({
      calendarDays: billingMonth('2028-02')!.days,
      timezone: 'Asia/Kolkata',
      money: String,
      lines: [
        { ...line, orderId: 'a', collectedAt: '2028-02-01T20:00:00Z' },
        { ...line, orderId: 'a', garment: 'Other linen', collectedAt: '2028-02-01T20:00:00Z' },
        { ...line, orderId: 'b', collectedAt: '2028-02-02T15:00:00Z' },
        { ...line, orderId: 'c', garment: 'Bulk', unit: 'KG', quantity: 1500, amount: null },
      ],
    });
    expect(register.columns[1]).toEqual({ day: '2028-02-02', pickups: 2 });
    expect(register.rows[0].cells[1]).toBe('4 pcs');
    expect(register.pickupCount).toBe(3);
    expect(register.pickupDays).toBe(1);
    expect(register.totalQuantity).toBe('6 pcs · 1.5 kg');
    expect(register.subtotal).toBe('');
    const csv = pickupRegisterCsv('Client', register);
    expect(csv).toContain('"2028-02-29"');
    expect(csv).toContain(`"'=Special linen","Wash","PIECE","","4"`);
  });
});
