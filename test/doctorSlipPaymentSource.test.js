import { describe, expect, it } from 'vitest';
import { buildDoctorSlipHtml } from '../src/documents/doctorSlipHtml.js';
import { consultationChargeLabel, getConsultationPaymentSource, getSlipFee } from '../src/utils/doctorSlipUtils.js';

describe('consultation payment source', () => {
  it('marks a package-funded visit', () => {
    const source = getConsultationPaymentSource({
      funded_by_package: true,
      package_name: 'Family Care',
      payment: { amount: 0, consultation_fee: 0 },
    });
    expect(source.kind).toBe('package');
    expect(source.line).toBe('Paid through package · Family Care');
  });

  it('marks a normal gateway payment and keeps a short reference', () => {
    const source = getConsultationPaymentSource({
      payment: {
        amount: 499,
        payment_method: 'upi',
        gateway_payment_id: 'pay_abcdefghijklmnop',
      },
    });
    expect(source.kind).toBe('normal');
    expect(source.line).toContain('Normal consultation');
    expect(source.line).toContain('upi');
    expect(source.line).toContain('Ref PAY_ABCD');
  });

  it('prints payment done instead of ₹0 when a package covered the visit', () => {
    const { html } = buildDoctorSlipHtml({
      doctor: { doctor_name: 'Dr. Vishwash Saxena' },
      consultation: {
        appointment_date: '2026-11-13',
        patient: { patient_name: 'Rohana Singh' },
        funded_by_package: true,
        package_name: 'Family Care',
        payment: { amount: 0, consultation_fee: 0 },
      },
    });
    expect(html).toContain('Consultation fee');
    expect(html).toContain('Payment done · Paid through package · Family Care');
    expect(html).not.toContain('₹0');
  });

  it('keeps a real consultation fee when payable is 0', () => {
    expect(getSlipFee({
      payment: { amount: 0, summary: { total_payable_amount: 0, consultation_fee: 499 } },
    })).toBe(499);
  });

  it('replaces a zero payment that already has a reference with payment done', () => {
    const charge = consultationChargeLabel({
      payment: { amount: 0, payment_id: '733274bf-1111-2222-3333-444444444444' },
    });
    expect(charge.amount).toBeNull();
    expect(charge.note).toBe('Payment done');
  });
});
