// Tax invoice for a purchased diet plan. Amounts come from GET diet/fee-quote/.
// Nothing here recomputes GST or fees.
import { formatDisplayId } from '../utils/formatDisplayId';
import {
  buildBillToBlock,
  formatInvoiceDate,
  INVOICE_DECLARATION,
  INVOICE_FOOTER,
  INVOICE_SELLER_FALLBACK,
  invoiceSellerBlock,
  money,
} from './documentData';

const num = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const percentLabel = (label, percent) => {
  const n = num(percent);
  if (n == null || n <= 0) return label;
  if (/\d/.test(label)) return label;
  const shown = Number.isInteger(n) ? n : Number(n.toFixed(2));
  return `${label} (${shown}%)`;
};

const FEE_EXTRAS = [
  {
    keys: ['discount', 'discount_amount'],
    key: 'discount',
    label: 'Discount',
    fields: ['discount_amount', 'discount'],
    effect: 'subtract',
  },
  {
    keys: ['coupon', 'coupon_discount', 'coupon_amount'],
    key: 'coupon',
    label: 'Coupon',
    fields: ['coupon_discount', 'coupon_amount'],
    effect: 'subtract',
  },
  {
    keys: ['offer', 'offer_discount', 'offer_amount'],
    key: 'offer',
    label: 'Offer',
    fields: ['offer_discount', 'offer_amount'],
    effect: 'subtract',
  },
  {
    keys: ['platform_fee', 'platform'],
    key: 'platform_fee',
    label: 'Platform fee',
    fields: ['platform_fee'],
    effect: 'add',
  },
  {
    keys: ['convenience', 'convenience_fee'],
    key: 'convenience',
    label: 'Convenience fee',
    fields: ['convenience_fee'],
    effect: 'add',
  },
  {
    keys: ['gst', 'gst_amount'],
    key: 'gst',
    label: 'GST',
    fields: ['gst_amount'],
    effect: 'add',
  },
  {
    keys: ['administrative_charges'],
    key: 'administrative_charges',
    label: 'Administrative charges',
    fields: ['administrative_charges'],
    effect: 'add',
  },
  {
    keys: ['digital_report_access'],
    key: 'digital_report_access',
    label: 'Digital report access',
    fields: ['digital_report_access'],
    effect: 'add',
  },
];

const firstNumber = (source, fields) => {
  for (const field of fields) {
    const n = num(source?.[field]);
    if (n != null) return n;
  }
  return null;
};

const decorateLabel = (line, fees, configurations) => {
  if (line.key === 'gst') {
    return percentLabel(line.label || 'GST', fees.gst_percent ?? configurations?.gst?.percent);
  }
  if (line.key === 'platform_fee' || line.key === 'platform') {
    return percentLabel(
      line.label || 'Platform fee',
      fees.platform_fee_percent ?? configurations?.platform_fee?.percent,
    );
  }
  return line.label || 'Charge';
};

/**
 * Every breakup row the server returned, plus any fee the summary omitted.
 * Zero platform/GST lines stay, because they are part of the bill.
 * Zero discounts are dropped.
 */
export const collectDietBreakup = (quote) => {
  const data = quote?.data && typeof quote.data === 'object' ? quote.data : quote || {};
  const fees = data.fees && typeof data.fees === 'object' ? data.fees : {};
  const configurations = data.configurations && typeof data.configurations === 'object' ? data.configurations : {};
  const summary = Array.isArray(data.summary?.lines) ? data.summary.lines : [];
  const lines = summary
    .map((line) => {
      const amount = num(line?.amount);
      if (amount == null) return null;
      const key = String(line.key || line.label || 'charge');
      return {
        key,
        label: decorateLabel({ key, label: String(line.label || key) }, fees, configurations),
        amount,
        effect: line.effect === 'subtract' ? 'subtract' : 'add',
      };
    })
    .filter(Boolean);

  const present = new Set(lines.map((line) => line.key));
  const hasPrice = ['listed_price', 'selling_price', 'price', 'plan_price'].some((key) => present.has(key));
  if (!hasPrice) {
    const price = firstNumber(fees, ['selling_price', 'listed_price', 'price', 'plan_price']);
    if (price != null) {
      lines.unshift({ key: 'selling_price', label: 'Diet plan price', amount: price, effect: 'add' });
      present.add('selling_price');
    }
  }

  FEE_EXTRAS.forEach((extra) => {
    if (extra.keys.some((key) => present.has(key))) return;
    const amount = firstNumber(fees, extra.fields);
    if (amount == null) return;
    if (extra.effect === 'subtract' && amount === 0) return;
    lines.push({
      key: extra.key,
      label: decorateLabel({ key: extra.key, label: extra.label }, fees, configurations),
      amount,
      effect: extra.effect,
    });
    present.add(extra.key);
  });

  const total =
    num(data.total_payable_amount) ??
    num(data.summary?.total_payable_amount) ??
    num(fees.total_payable_amount);

  return { lines, total };
};

const signedAmount = (line) => (line.effect === 'subtract' ? -Math.abs(line.amount) : line.amount);

const joinName = (...parts) => parts.map((part) => String(part || '').trim()).filter(Boolean).join(' ');

const addressText = (address) => {
  if (!address) return '';
  if (typeof address === 'string') return address.trim();
  const seen = new Set();
  return [
    address.address_line_1,
    address.address_line_2,
    address.line1,
    address.line2,
    address.street,
    address.city,
    address.state,
    address.zipcode,
    address.pincode,
    address.postal_code,
    address.country,
  ]
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter((part) => {
      if (!part) return false;
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
};

const buyerFrom = (profile, patients) => {
  const list = Array.isArray(patients) ? patients : [];
  const patient = list.find((item) => item?.is_active_profile) || list[0] || null;
  const addresses = Array.isArray(profile?.addresses) ? profile.addresses : [];
  const address =
    addresses.find((item) => item?.is_default || item?.is_primary) ||
    addresses[0] ||
    patient?.address ||
    null;
  return {
    patient_name:
      joinName(patient?.first_name, patient?.last_name) ||
      patient?.name ||
      patient?.full_name ||
      joinName(profile?.first_name, profile?.last_name) ||
      profile?.name ||
      '',
    patient_phone: patient?.phone_number || patient?.phone || profile?.phone_number || '',
    patient_email: patient?.email || profile?.email || '',
    billing_address: addressText(address),
  };
};

const issuedOn = (plan) =>
  formatInvoiceDate(plan?.started_at || plan?.purchased_at || plan?.paid_at || new Date());

const feeLine = (sno, description, amount, tax) => ({
  sno,
  description,
  qty: 1,
  rate: money(amount),
  taxableValue: money(amount),
  tax,
  total: money(amount),
});

/** Structured invoice input for renderDocumentHtml. */
export const buildDietInvoiceDocument = ({ quote, plan, profile, patients } = {}) => {
  const data = quote?.data && typeof quote.data === 'object' ? quote.data : quote || {};
  const { lines, total } = collectDietBreakup(data);
  const planName = data.diet_plan_name || plan?.name || plan?.title || 'Diet plan';
  const gst = lines
    .filter((line) => line.key === 'gst' || line.key === 'gst_amount')
    .reduce((sum, line) => sum + signedAmount(line), 0);
  const taxable = lines
    .filter((line) => line.key !== 'gst' && line.key !== 'gst_amount')
    .reduce((sum, line) => sum + signedAmount(line), 0);
  const grand = total != null ? total : taxable + gst;
  const lineItems = lines.map((line, index) => {
    const amount = signedAmount(line);
    const isGst = line.key === 'gst' || line.key === 'gst_amount';
    const priceKeys = new Set(['listed_price', 'selling_price', 'price', 'plan_price']);
    const description = priceKeys.has(line.key) ? `${planName} — ${line.label}` : line.label;
    return feeLine(index + 1, description, amount, isGst ? money(Math.abs(line.amount)) : '0.00');
  });
  const breakup = lines.map((line) => {
    const shown = money(Math.abs(line.amount));
    return line.effect === 'subtract' ? `${line.label}: - ${shown}` : `${line.label}: ${shown}`;
  });
  breakup.push(`Total payable: ${money(grand)}`);

  const billTo = buildBillToBlock(buyerFrom(profile, patients));
  const shipLines = billTo.lines.filter((line) => line && line !== '-');

  return {
    variant: 'invoice',
    documentHeading: 'TAX INVOICE',
    from: invoiceSellerBlock({}),
    billTo,
    shipTo: shipLines.length ? { title: 'Ship To', lines: shipLines } : null,
    leftMetaTitle: 'Invoice Details-',
    leftMeta: [
      { label: 'Invoice Date', value: issuedOn(plan) || '-' },
      { label: 'Invoice Code', value: formatDisplayId('DIT', data.diet_plan_id || plan?.id) },
      { label: 'Plan', value: planName },
    ],
    rightMeta: [
      { label: 'Payment Status', value: 'Paid' },
      { label: 'Currency', value: data.currency || data.summary?.currency || 'INR' },
      ...(plan?.duration ? [{ label: 'Duration', value: String(plan.duration) }] : []),
    ],
    lineItems: lineItems.length
      ? lineItems
      : [feeLine(1, planName, grand, '0.00')],
    totals: [
      { label: 'Qty', value: '1' },
      { label: 'Rate', value: '-' },
      { label: 'Taxable', value: money(taxable) },
      { label: 'GST', value: money(gst) },
      { label: 'Grand Total', value: money(grand) },
    ],
    sections: [{ title: 'Price breakup', lines: breakup }],
    signatoryFor: INVOICE_SELLER_FALLBACK.wellness_name,
    showSignature: true,
    declaration: INVOICE_DECLARATION,
    footerNote: INVOICE_FOOTER,
  };
};
