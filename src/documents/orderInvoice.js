// Product-order tax invoice. Line names come from the order itself so Description of
// Goods is never blank, and a discount is its own row when one was given.
import { formatOrderId } from '../utils/formatDisplayId';
import { buildPaymentRows, formatDeliveryAddress } from '../utils/orderDetailUtils';
import {
  buildBillToBlock,
  formatInvoiceDate,
  INVOICE_DECLARATION,
  INVOICE_FOOTER,
  INVOICE_SELLER_FALLBACK,
  invoiceSellerBlock,
  money,
} from './documentData';

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const num = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const useful = (value) => {
  const text = String(value ?? '').trim();
  if (!text || /^(-|—|n\/a|na|null|undefined)$/i.test(text)) return '';
  return text;
};

const firstUseful = (...values) => {
  for (const value of values) {
    const text = useful(value);
    if (text) return text;
  }
  return '';
};

const personName = (source) => {
  if (!source || typeof source !== 'object') return '';
  return firstUseful(
    source.name,
    source.full_name,
    source.customer_name,
    [source.first_name, source.last_name].filter(Boolean).join(' '),
  );
};

const ITEM_LIST_KEYS = ['items', 'order_items', 'line_items', 'order_lines', 'products'];

export const orderLineItems = (order) => {
  for (const key of ITEM_LIST_KEYS) {
    if (Array.isArray(order?.[key]) && order[key].length) return order[key];
  }
  return [];
};

/** Product title for the invoice. Never returns a blank description. */
export const orderItemName = (item, index = 0) => {
  const variant = item?.variant || item?.product_variant || {};
  const product = item?.product || variant?.product || {};
  return (
    firstUseful(
      variant.variant_title,
      variant.title,
      variant.name,
      product.product_name,
      product.name,
      product.title,
      item?.product_name,
      item?.item_name,
      item?.itemName,
      item?.name,
      item?.title,
      item?.sku_name,
      item?.skuName,
      variant.sku_name,
      item?.sku,
      item?.sku_code,
      item?.skuCode,
      variant.sku,
      variant.sku_code,
    ) || `Product ${index + 1}`
  );
};

const percentFromObject = (source) => {
  if (source == null || source === '') return 0;
  if (typeof source === 'number') return source > 0 && source <= 100 ? source : 0;
  if (typeof source === 'string') {
    const match = source.match(/(\d+(?:\.\d+)?)/);
    const n = match ? Number(match[1]) : 0;
    return n > 0 && n <= 100 ? n : 0;
  }
  if (typeof source !== 'object') return 0;
  const keys = [
    'gst_percent',
    'gst_percentage',
    'tax_percent',
    'tax_percentage',
    'igst_percent',
    'tax_rate',
    'percentage',
    'percent',
  ];
  for (const key of keys) {
    const n = num(source[key]);
    if (n != null && n > 0 && n <= 100) return n;
  }
  const split = (num(source.cgst) || 0) + (num(source.sgst) || 0) + (num(source.ugst) || 0);
  if (split > 0 && split <= 100) return split;
  return (
    percentFromObject(source.tax_type || source.gst_tax_type || source.code || source.name) || 0
  );
};

const lineGstPercent = (item) => {
  const variant = item?.variant || {};
  const product = item?.product || variant?.product || {};
  const sources = [
    item?.unicommerce_gst_class,
    variant?.unicommerce_gst_class,
    product?.unicommerce_gst_class,
    item?.gst_class,
    variant?.gst_class,
    item?.gst,
    variant?.gst,
    item,
    variant,
    product,
  ];
  for (const source of sources) {
    const percent = percentFromObject(source);
    if (percent > 0) return percent;
  }
  return 0;
};

const explicitTax = (item) => {
  for (const key of ['igst_amount', 'gst_amount', 'tax_amount', 'total_tax', 'igst_value']) {
    const n = num(item?.[key] ?? item?.variant?.[key]);
    if (n != null && n >= 0) return n;
  }
  return null;
};

const explicitTaxable = (item) => {
  for (const key of ['taxable_value', 'taxable_amount', 'taxable']) {
    const n = num(item?.[key] ?? item?.variant?.[key]);
    if (n != null && n >= 0) return n;
  }
  return null;
};

const unitPrice = (item) => {
  const variant = item?.variant || {};
  const product = item?.product || variant?.product || {};
  for (const value of [
    item?.selling_price,
    item?.unit_price,
    item?.price,
    variant?.selling_price,
    variant?.price,
    product?.selling_price,
    item?.mrp,
    variant?.mrp,
  ]) {
    const n = num(value);
    if (n != null && n > 0) return n;
  }
  const qty = lineQuantity(item);
  const extended = num(item?.total_price ?? item?.line_total ?? item?.item_total ?? item?.subtotal);
  if (extended != null && extended > 0) return extended / qty;
  return 0;
};

const lineQuantity = (item) => {
  const n = num(item?.quantity ?? item?.qty);
  return n != null && n > 0 ? n : 1;
};

const percentLabel = (percent) => {
  if (!(percent > 0)) return '';
  const shown = Math.abs(percent - Math.round(percent)) < 0.05 ? Number(percent).toFixed(1) : Number(percent.toFixed(2));
  return `(${shown}%)`;
};

const taxCell = (tax, percent) => {
  const label = percentLabel(percent);
  return label ? `${money(tax)}\n${label}` : money(tax);
};

const addressText = (address) => formatDeliveryAddress(address);

const customerName = (order) =>
  firstUseful(
    order?.customer_name,
    order?.billing_name,
    personName(order?.user),
    personName(order?.customer),
    personName(order?.billing_address),
    personName(order?.delivery_address),
    personName(order?.shipping_address),
    personName(order?.address),
  );

const customerPhone = (order, address) =>
  firstUseful(
    order?.customer_phone,
    order?.phone_number,
    order?.phone,
    order?.user?.phone_number,
    order?.user?.phone,
    address?.phone_number,
    address?.phone,
    address?.mobile,
  );

const discountCode = (order) =>
  firstUseful(order?.coupon_code, order?.coupon?.code, order?.promo_code, order?.offer_code);

const invoiceCode = (order) =>
  firstUseful(
    order?.invoice_code,
    order?.invoice_number,
    order?.invoice_no,
    order?.unicommerce_invoice_code,
    order?.unicommerce_invoice_number,
  );

/**
 * Decide whether stored line prices already include GST and whether they are
 * before or after the order discount. The paid total picks the closest reading.
 */
const choosePriceMode = ({ list, discount, ship, percent, orderGst, grand }) => {
  const gstOn = (base) => (percent > 0 ? round2(Math.max(0, base) * percent / 100) : orderGst);
  const netBase = Math.max(0, list - discount);
  const candidates = [
    { mode: 'exclusive-pre', total: round2(netBase + gstOn(netBase) + ship) },
    { mode: 'exclusive-net', total: round2(list + (percent > 0 ? gstOn(list) : orderGst) + ship) },
    { mode: 'inclusive-pre', total: round2(netBase + ship) },
    { mode: 'inclusive-net', total: round2(list + ship) },
  ];
  if (!(grand > 0)) {
    return percent > 0 || orderGst > 0 ? 'exclusive-pre' : 'inclusive-net';
  }
  candidates.sort((a, b) => Math.abs(a.total - grand) - Math.abs(b.total - grand));
  return candidates[0].mode;
};

const splitInclusive = (amount, percent) => {
  if (!(percent > 0) || !(amount > 0)) return { taxable: round2(amount), tax: 0 };
  const taxable = round2(amount / (1 + percent / 100));
  return { taxable, tax: round2(amount - taxable) };
};

const buildProductLines = (items, { mode, discount, percentFallback, orderGst }) => {
  const drafts = items.map((item, index) => {
    const qty = lineQuantity(item);
    const unit = unitPrice(item);
    const list = round2(unit * qty);
    const percent = lineGstPercent(item) || percentFallback || 0;
    return {
      name: orderItemName(item, index),
      qty,
      list,
      percent,
      givenTax: explicitTax(item),
      givenTaxable: explicitTaxable(item),
    };
  });

  const listSum = drafts.reduce((sum, line) => sum + line.list, 0) || 1;
  let discountLeft = discount;
  const shares = drafts.map((line, index) => {
    if (!(discount > 0)) return 0;
    if (index === drafts.length - 1) return round2(discountLeft);
    const share = round2(discount * (line.list / listSum));
    discountLeft = round2(discountLeft - share);
    return share;
  });
  const netBases = drafts.map((line, index) =>
    mode.endsWith('net') ? line.list : round2(Math.max(0, line.list - shares[index])),
  );
  const netSum = netBases.reduce((sum, value) => sum + value, 0) || 1;

  return drafts.map((line, index) => {
    const share = shares[index];
    const net = netBases[index];
    let taxable;
    let tax;
    if (line.givenTaxable != null) {
      taxable = mode.endsWith('net') ? round2(line.givenTaxable + share) : line.givenTaxable;
      tax = line.givenTax ?? 0;
    } else if (mode.startsWith('inclusive') && !(line.percent > 0) && orderGst > 0) {
      tax = round2(orderGst * (net / netSum));
      taxable = round2((mode.endsWith('net') ? net + share : line.list) - tax);
    } else if (mode.startsWith('inclusive')) {
      const netSplit = splitInclusive(net, line.percent);
      tax = netSplit.tax;
      taxable =
        mode === 'inclusive-pre'
          ? round2(line.list - tax)
          : round2(netSplit.taxable + share);
    } else if (line.givenTax != null && drafts.length === 1) {
      taxable = mode.endsWith('net') ? round2(line.list + share) : line.list;
      tax = line.givenTax;
    } else if (line.percent > 0) {
      taxable = mode.endsWith('net') ? round2(line.list + share) : line.list;
      tax = round2((net * line.percent) / 100);
    } else if (orderGst > 0) {
      taxable = mode.endsWith('net') ? round2(line.list + share) : line.list;
      tax = round2(orderGst * (net / netSum));
    } else {
      taxable = mode.endsWith('net') ? round2(line.list + share) : line.list;
      tax = 0;
    }
    const amount = round2(taxable + tax);
    const rate = line.qty > 0 ? round2(taxable / line.qty) : taxable;
    const shownPercent = line.percent || (taxable > 0 && tax > 0 ? (tax / taxable) * 100 : 0);
    return {
      sno: index + 1,
      description: line.name,
      qty: String(line.qty),
      qtyNum: line.qty,
      rate: money(rate),
      taxableValue: money(taxable),
      taxableNum: taxable,
      tax: taxCell(tax, shownPercent),
      taxNum: tax,
      total: money(amount),
      totalNum: amount,
    };
  });
};

const chargeRow = (sno, description, amount) => ({
  sno,
  description,
  qty: amount > 0 ? '1' : '',
  qtyNum: 0,
  rate: amount > 0 ? money(amount) : '',
  taxableValue: money(amount),
  taxableNum: amount,
  tax: '0.00',
  taxNum: 0,
  total: money(amount),
  totalNum: amount,
});

/** Structured product invoice. Description of Goods is the product name. */
export const buildOrderInvoiceDocument = (order = {}) => {
  const items = orderLineItems(order);
  const payment = buildPaymentRows(order);
  const discount = round2(Math.abs(payment.discount || 0));
  const ship =
    round2(payment.shipping || 0) +
    round2(payment.cod || 0) +
    round2(payment.platformFee || 0) +
    round2(payment.giftWrap || 0);
  const list = round2(
    items.reduce((sum, item) => sum + unitPrice(item) * lineQuantity(item), 0),
  );
  const percents = items.map(lineGstPercent).filter((value) => value > 0);
  const percentFallback = percents.length === 1 ? percents[0] : percents.length > 1 ? 0 : 0;
  const orderGst = round2(payment.gst || 0);
  const grand = num(order?.total_amount ?? order?.payable_amount ?? order?.grand_total);
  const mode = choosePriceMode({
    list,
    discount,
    ship,
    percent: percentFallback || (percents[0] ?? 0),
    orderGst,
    grand: grand ?? 0,
  });

  const productLines = items.length
    ? buildProductLines(items, { mode, discount, percentFallback, orderGst })
    : [
        {
          sno: 1,
          description: 'Product 1',
          qty: '1',
          qtyNum: 1,
          rate: money(0),
          taxableValue: money(0),
          taxableNum: 0,
          tax: '0.00',
          taxNum: 0,
          total: money(0),
          totalNum: 0,
        },
      ];

  const rows = [...productLines];
  let sno = rows.length + 1;
  if (discount > 0) {
    const code = discountCode(order);
    rows.push(chargeRow(sno, code ? `Discount (${code})` : 'Discount', -discount));
    sno += 1;
  }
  const extras = [
    ['Shipping', payment.shipping],
    ['COD charges', payment.cod],
    ['Platform fee', payment.platformFee],
    ['Gift wrap', payment.giftWrap],
  ];
  extras.forEach(([label, amount]) => {
    const value = round2(amount || 0);
    if (value > 0) {
      rows.push(chargeRow(sno, label, value));
      sno += 1;
    }
  });

  const qty = productLines.reduce((sum, row) => sum + (row.qtyNum || 0), 0);
  const taxable = round2(rows.reduce((sum, row) => sum + (row.taxableNum || 0), 0));
  const tax = round2(rows.reduce((sum, row) => sum + (row.taxNum || 0), 0));
  const computed = round2(rows.reduce((sum, row) => sum + (row.totalNum || 0), 0));
  const paid = grand != null && grand >= 0 ? round2(grand) : computed;

  const delivery = order?.delivery_address || order?.shipping_address || order?.address || null;
  const billing = order?.billing_address || delivery;
  const name = customerName(order);
  const phone = customerPhone(order, delivery || billing);
  const email = firstUseful(order?.customer_email, order?.email, order?.user?.email, billing?.email);
  const billTo = buildBillToBlock({
    patient_name: name,
    patient_phone: phone,
    patient_email: email,
    billing_address: addressText(billing),
  });
  const shipLines = [name, addressText(delivery), phone ? `Phone: ${phone}` : ''].filter(Boolean);

  const orderNo = formatOrderId(order?.order_code ?? order?.order_number ?? order?.id);
  const orderDate = formatInvoiceDate(order?.created_at || order?.order_date) || '-';
  const issued = formatInvoiceDate(
    order?.invoice_date || order?.invoiced_at || order?.invoice_created_at || order?.created_at,
  );

  return {
    variant: 'invoice',
    from: invoiceSellerBlock(order),
    billTo,
    shipTo: shipLines.length ? { title: 'Ship To', lines: shipLines } : null,
    leftMetaTitle: 'Invoice Details-',
    leftMeta: [
      { label: 'Invoice Date', value: issued || orderDate },
      { label: 'Invoice Code', value: invoiceCode(order) || '-' },
    ],
    rightMeta: [
      { label: 'Order No', value: orderNo || '-' },
      { label: 'Order Date', value: orderDate },
    ],
    lineItems: rows.map(({ qtyNum, taxableNum, taxNum, totalNum, ...row }) => row),
    totals: [
      { label: 'Qty', value: String(qty || rows.length) },
      { label: 'Rate', value: '' },
      { label: 'Taxable', value: money(taxable) },
      { label: 'IGST', value: money(tax) },
      { label: 'Grand Total', value: money(paid) },
    ],
    signatoryFor: INVOICE_SELLER_FALLBACK.wellness_name,
    showSignature: true,
    declaration: INVOICE_DECLARATION,
    reverseCharge: 'No',
    footerNote: INVOICE_FOOTER,
  };
};
