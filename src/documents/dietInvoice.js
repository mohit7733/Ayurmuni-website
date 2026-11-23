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

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const invoiceMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '-';
};
const closeMoney = (a, b) => Math.abs(round2(a) - round2(b)) < 0.05;

const PRICE_KEYS = new Set(['listed_price', 'selling_price', 'price', 'plan_price']);
const isGstLine = (line) => line.key === 'gst' || line.key === 'gst_amount';
const isDiscountLine = (line) => line.effect === 'subtract';

const gstPercentOf = (data, lines) => {
  const fees = data.fees && typeof data.fees === 'object' ? data.fees : {};
  const configurations = data.configurations && typeof data.configurations === 'object' ? data.configurations : {};
  const direct = num(fees.gst_percent ?? configurations?.gst?.percent);
  if (direct != null && direct > 0) return direct;
  const label = lines.find(isGstLine)?.label || '';
  const match = label.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : 0;
};

const taxCell = (tax, percent) => {
  if (!(tax > 0)) return '0.00';
  if (!(percent > 0)) return invoiceMoney(tax);
  const shown = Math.abs(percent - Math.round(percent)) < 0.05 ? Number(percent).toFixed(1) : Number(percent.toFixed(2));
  return `${invoiceMoney(tax)}\n(${shown}%)`;
};

const supplyRow = (sno, description, taxable, tax, percent, qty = 1) => ({
  sno,
  description,
  qty: qty ? String(qty) : '',
  rate: taxable != null && qty ? invoiceMoney(round2(taxable / qty)) : '',
  taxableValue: invoiceMoney(taxable),
  tax: taxCell(tax, percent),
  total: invoiceMoney(round2(taxable + tax)),
  taxableNum: round2(taxable),
  taxNum: round2(tax),
});

/**
 * Tax invoice rows. GST is the IGST column of the supply, not a goods line
 * whose amount is added again. A fee is a goods line only when the payable
 * total includes it.
 */
const buildDietSupplyRows = (lines, data, planName, grand) => {
  const gst = round2(lines.filter(isGstLine).reduce((sum, line) => sum + signedAmount(line), 0));
  const percent = gstPercentOf(data, lines);
  const charges = lines.filter((line) => !isGstLine(line));
  const chargeSum = round2(charges.reduce((sum, line) => sum + signedAmount(line), 0));
  const payableBase = round2(grand - gst);
  const priceSum = round2(
    charges.filter((line) => PRICE_KEYS.has(line.key) || isDiscountLine(line)).reduce((sum, line) => sum + signedAmount(line), 0),
  );
  const inPayable = closeMoney(chargeSum, payableBase)
    ? charges
    : closeMoney(priceSum, payableBase)
      ? charges.filter((line) => PRICE_KEYS.has(line.key) || isDiscountLine(line))
      : charges;
  const planNet = round2(
    inPayable
      .filter((line) => PRICE_KEYS.has(line.key) || isDiscountLine(line))
      .reduce((sum, line) => sum + signedAmount(line), 0),
  );
  const extras = inPayable.filter(
    (line) => !PRICE_KEYS.has(line.key) && !isDiscountLine(line) && Math.abs(line.amount) > 0.0001,
  );
  const extraSum = round2(extras.reduce((sum, line) => sum + signedAmount(line), 0));
  const taxableBase = closeMoney(planNet + extraSum, payableBase) ? round2(planNet + extraSum) : payableBase;
  const gstOnWhole = percent > 0 && closeMoney(gst, (taxableBase * percent) / 100);
  const rows = [];
  const planTaxable = planNet || round2(taxableBase - extraSum);
  const planTax = gstOnWhole ? round2((Math.max(planTaxable, 0) / (taxableBase || 1)) * gst) : gst;
  rows.push(supplyRow(1, planName, planTaxable, Math.max(0, planTax), percent));
  extras.forEach((line) => {
    const taxable = round2(signedAmount(line));
    const tax = gstOnWhole ? round2((taxable / (taxableBase || 1)) * gst) : 0;
    rows.push(supplyRow(rows.length + 1, line.label, taxable, Math.max(0, tax), tax > 0 ? percent : 0));
  });
  return { rows, gst, taxable: round2(rows.reduce((sum, row) => sum + row.taxableNum, 0)) };
};

/** Structured invoice input for renderDocumentHtml. */
export const buildDietInvoiceDocument = ({ quote, plan, profile, patients } = {}) => {
  const data = quote?.data && typeof quote.data === 'object' ? quote.data : quote || {};
  const { lines, total } = collectDietBreakup(data);
  const planName = data.diet_plan_name || plan?.name || plan?.title || 'Diet plan';
  const gstOnly = round2(lines.filter(isGstLine).reduce((sum, line) => sum + signedAmount(line), 0));
  const chargeSum = round2(lines.filter((line) => !isGstLine(line)).reduce((sum, line) => sum + signedAmount(line), 0));
  const grand = total != null ? total : round2(chargeSum + gstOnly);
  const built = lines.length
    ? buildDietSupplyRows(lines, data, planName, grand)
    : { rows: [supplyRow(1, planName, grand, 0, 0)], gst: 0, taxable: grand };
  const { rows, gst, taxable } = built;
  const breakup = [];
  lines.forEach((line) => {
    if (isGstLine(line) || Math.abs(line.amount) < 0.0001) return;
    const shown = invoiceMoney(Math.abs(line.amount));
    breakup.push(line.effect === 'subtract' ? `${line.label}: - ${shown}` : `${line.label}: ${shown}`);
  });
  breakup.push(`Taxable value: ${invoiceMoney(taxable)}`);
  breakup.push(gstPercentOf(data, lines) > 0 ? `IGST (${gstPercentOf(data, lines)}%): ${invoiceMoney(gst)}` : `IGST: ${invoiceMoney(gst)}`);
  breakup.push(`Total payable: ${invoiceMoney(grand)}`);

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
    lineItems: rows.map(({ taxableNum, taxNum, ...row }) => row),
    totals: [
      { label: 'Qty', value: '1' },
      { label: 'Rate', value: '-' },
      { label: 'Taxable', value: invoiceMoney(taxable) },
      { label: 'GST', value: invoiceMoney(gst) },
      { label: 'Grand Total', value: invoiceMoney(grand) },
    ],
    sections: [{ title: 'Price breakup', lines: breakup }],
    signatoryFor: INVOICE_SELLER_FALLBACK.wellness_name,
    showSignature: true,
    declaration: INVOICE_DECLARATION,
    footerNote: INVOICE_FOOTER,
  };
};
