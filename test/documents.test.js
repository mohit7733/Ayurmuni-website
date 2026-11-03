import { describe, expect, it } from 'vitest';
import { escapeHtml, renderDocumentHtml } from '../src/documents/documentHtml.js';
import { buildPrescriptionDocument, buildReceiptDocument } from '../src/documents/documentData.js';

const receipt = {
  consultation_id: 'c-123',
  payment_id: 'p-9',
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
    expect(html).toContain('CONSULTATION RECEIPT');
    expect(html).toContain('Online Consultation - Ayurveda, Panchakarma');
    expect(html).toContain('Administrative Charges');
    expect(html).toContain('<th>S.No</th>');
    expect(html).toContain('For Dr. Rao');
    expect(html).toContain('@page { size: A4');
  });

  it('builds the prescription document like the app (medicines, sections, physician)', () => {
    const input = buildPrescriptionDocument(rx);
    expect(input.documentHeading).toBe('PRESCRIPTION');
    expect(input.lineItems[0].description).toContain('Avipattikar');
    expect(input.lineItems[0].qty).toBe('2');
    const titles = input.sections.map((s) => s.title);
    expect(titles).toContain('Prescribing Physician');
    const html = renderDocumentHtml(input);
    expect(html).toContain('Avipattikar');
    expect(html).toContain('Prescribing Physician');
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
