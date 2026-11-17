import { describe, expect, it } from 'vitest';
import { formatConsultationAmount, formatExactRupee, formatRupee } from '../src/home/catalog';
import { formatPlanMoney } from '../src/packages/planTheme';
import { formatServerMoney } from '../src/payment/packagePurchase';

describe('formatConsultationAmount', () => {
  it('displays consultation amounts with exactly two decimal places', () => {
    expect(formatConsultationAmount(0.99)).toBe('₹0.99');
    expect(formatConsultationAmount(0.18)).toBe('₹0.18');
    expect(formatConsultationAmount(1.17)).toBe('₹1.17');
    expect(formatConsultationAmount('1.17')).toBe('₹1.17');
    expect(formatConsultationAmount(499)).toBe('₹499.00');
    expect(formatConsultationAmount(1234.5)).toBe('₹1,234.50');
  });

  it('handles null, undefined and empty values the same way as formatRupee', () => {
    expect(formatConsultationAmount(null)).toBe('');
    expect(formatConsultationAmount(undefined)).toBe('');
    expect(formatConsultationAmount('')).toBe('');
    expect(formatConsultationAmount(null)).toBe(formatRupee(null));
    expect(formatConsultationAmount(undefined)).toBe(formatRupee(undefined));
    expect(formatConsultationAmount('')).toBe(formatRupee(''));
  });

  it('does not round 0.99 or 1.17 up or down to a whole rupee', () => {
    expect(formatConsultationAmount(0.99)).not.toBe('₹1');
    expect(formatConsultationAmount(1.17)).not.toBe('₹1');
  });
});

describe('formatExactRupee', () => {
  it('keeps paise and does not publish a second rounded rupee', () => {
    expect(formatExactRupee(0.99)).toBe('₹0.99');
    expect(formatExactRupee('0.99')).toBe('₹0.99');
    expect(formatPlanMoney(0.99)).toBe('₹0.99');
    expect(formatServerMoney('0.99')).toBe('₹0.99');
    expect(formatExactRupee(0.99)).not.toBe('₹1');
    expect(formatExactRupee('1.00')).toBe('₹1');
    expect(formatExactRupee(10)).toBe('₹10');
    expect(formatExactRupee(9)).toBe('₹9');
    expect(formatExactRupee('554.65')).toBe('₹554.65');
  });
});
