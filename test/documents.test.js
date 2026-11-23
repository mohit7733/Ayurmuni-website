import { describe, expect, it } from 'vitest';
import { escapeHtml, renderDocumentHtml } from '../src/documents/documentHtml.js';
import { buildPrescriptionDocument, buildReceiptDocument } from '../src/documents/documentData.js';

const receipt = {
  consultation_id: 'c-123',
  payment_id: 'p-9',
  consultation_fees: 499,
  amount: 519,
  info: { doctor_name: 'Dr. Rao', doctor_specialization: ['Ayurveda', 'Panchakarma'] },
  patient: { name: 'Asha', phone_number: '9999999999' },
  administrative_charges: 20,
  payment_status: 'captured',
};

const rx = {
  doctor: { doctor_name: 'Dr. Rao', doctor_specialization: ['Ayurveda'] },
  patient: { patient_name: 'Asha', age: 30, gender: 'female' },
  appointment: { appointment_date: '2026-10-01', consultation_id: 'c-1' },
  prescription: {
    id: 'rx-1',
    diagnosis: 'Amlapitta',
    items: [{ medicine_name: 'Avipattikar', quantity: 2, price: 100 }],
    do_list: ['Eat warm food'],
  },
};

describe('document html', () => {
  it('escapes markup', () => {
    expect(escapeHtml('<b>&"x"</b>')).toBe('&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
  });

  it('renders a bordered receipt with line items, totals and signature', () => {
    const html = renderDocumentHtml(buildReceiptDocument(receipt), 'Receipt');
    expect(html).toContain('Sender:');
    expect(html).toContain('Online Consultation - Ayurveda, Panchakarma');
    expect(html).toContain('Administrative charges');
    expect(html).toContain('<th>S.No</th>');
    expect(html).toContain('Amount (INR)');
    expect(html).toContain('This is a computer generated Invoice');
    expect(html).toContain('For Dr. Rao');
    expect(html).toContain('@page { size: A4');
  });

  it('builds the prescription document like the app (medicines, sections, physician)', () => {
    const input = buildPrescriptionDocument(rx);
    expect(input.documentHeading).toBe('PRESCRIPTION');
    expect(input.lineItems[0].description).toContain('Avipattikar');
    expect(input.lineItems[0].qty).toBe('2');
    expect(input.lineItems[0].rate).toBeUndefined();
    const titles = input.sections.map((s) => s.title);
    expect(titles).toContain('Prescribing Physician');
    expect(titles).not.toContain('Medicine Price Summary');
    const html = renderDocumentHtml(input);
    expect(html).toContain('Prescribed Medicine');
    expect(html).toContain('Avipattikar');
    expect(html).toContain('Prescribing Physician');
    expect(html).not.toContain('Taxable Value');
    expect(html).not.toContain('100.00');
  });

  it('prints the consultation fee at the end, not on a medicine row', () => {
    const input = buildPrescriptionDocument({
      ...rx,
      payment: { consultation_fee: 499, payment_method: 'upi', payment_status: 'success' },
    });
    expect(input.lineItems[0].description).toBe('Avipattikar');
    expect(JSON.stringify(input.lineItems)).not.toContain('499');
    const html = renderDocumentHtml(input);
    expect(html).toContain('Consultation amount');
    expect(html).toContain('499.00');
    expect(html.indexOf('Avipattikar')).toBeLessThan(html.indexOf('Consultation amount'));
  });

  it('shows a placeholder row when there are no medicines', () => {
    const input = buildPrescriptionDocument({ ...rx, prescription: { id: 'rx-2' } });
    expect(input.lineItems[0].description).toBe('No medicines prescribed');
  });

  it('never injects raw html from data', () => {
    const html = renderDocumentHtml(
      buildReceiptDocument({ ...receipt, patient: { name: '<script>x</script>' } }),
    );
    expect(html).not.toContain('<script>x</script>');
  });
});
