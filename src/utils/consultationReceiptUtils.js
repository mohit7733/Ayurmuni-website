const toNumber = (value) => {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Integer paise for sum / visibility checks. Not used for currency display. */
export const rupeesToPaise = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number((n * 100).toFixed(0));
};

const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const amountFromPaymentEntity = (entity, fallbackRupees) => {
  const raw = toNumber(entity?.amount);
  if (!raw) return fallbackRupees;
  if (raw >= 1000 && Number.isInteger(raw)) return raw / 100;
  return raw;
};

const firstFinite = (sources, keys) => {
  for (const source of sources) {
    const object = asObject(source);
    if (!object) continue;
    for (const key of keys) {
      const raw = object[key];
      if (raw == null || raw === '') continue;
      if (typeof raw === 'object') continue;
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
};

const firstText = (sources, keys) => {
  for (const source of sources) {
    const object = asObject(source);
    if (!object) continue;
    for (const key of keys) {
      const raw = object[key];
      if (raw == null || raw === '') continue;
      if (typeof raw === 'object') {
        const nested = raw.code || raw.coupon_code || raw.name;
        if (nested) return String(nested).trim();
        continue;
      }
      const text = String(raw).trim();
      if (text) return text;
    }
  }
  return '';
};

const collectFeeSources = (receipt, notes, entity, info) => {
  const payment = asObject(receipt?.payment) || asObject(receipt?.payment_details);
  const summary = asObject(receipt?.summary) || asObject(payment?.summary);
  const infoNotes = asObject(info?.notes) || asObject(info?.data?.notes) || asObject(info?.order?.notes);
  const snapshot =
    asObject(receipt?.fee_snapshot) ||
    asObject(payment?.fee_snapshot) ||
    asObject(info?.fee_snapshot) ||
    asObject(info?.breakdown) ||
    asObject(info?.fee_breakdown);
  return [summary, payment, receipt, notes, infoNotes, snapshot, entity, asObject(info)];
};

export const getConsultationPaymentEntity = (receipt) => {
  const info = receipt?.payment_information;
  return (
    info?.payload?.payment?.entity ||
    info?.payment?.entity ||
    info?.payload?.entity ||
    null
  );
};

export const getConsultationPaymentNotes = (receipt) => {
  const entity = getConsultationPaymentEntity(receipt);
  const notes = entity?.notes;
  return notes && typeof notes === 'object' ? notes : {};
};

/** Pull a payment/summary block off a consultation-detail payload. */
export const extractConsultationPayment = (payload) => {
  const root = payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : payload;
  if (!root || typeof root !== 'object') return null;
  return (
    asObject(root.payment) ||
    asObject(root.appointment?.payment) ||
    asObject(root.consultation?.payment) ||
    null
  );
};

export const mergeReceiptPayment = (receipt, payment) => {
  if (!receipt || !payment) return receipt;
  return {
    ...receipt,
    payment: asObject(receipt.payment) || payment,
    summary: asObject(receipt.summary) || asObject(payment.summary),
  };
};

const percentLabel = (label, percent) =>
  percent > 0 && !/\(\s*\d/.test(label) ? `${label} (${String(percent).replace(/\.0+$/, '')}%)` : label;

export const parseConsultationReceiptBreakdown = (receipt) => {
  const notes = getConsultationPaymentNotes(receipt);
  const entity = getConsultationPaymentEntity(receipt);
  const info = asObject(receipt?.payment_information) || {};
  const payment = asObject(receipt?.payment) || asObject(receipt?.payment_details);
  const summary = asObject(receipt?.summary) || asObject(payment?.summary);
  const sources = collectFeeSources(receipt, notes, entity, info);

  const consultationFee = firstFinite(sources, [
    'consultation_fee',
    'consultation_fees',
    'listed_amount',
    'listed',
  ]);
  const platformFee = firstFinite(sources, ['platform_fee', 'platformFee', 'platform_charges']);
  const platformFeePercent = firstFinite(sources, [
    'platform_fee_percent',
    'platformFeePercent',
    'platform_fee_percentage',
  ]);
  const convenienceFeeRaw = firstFinite(sources, [
    'convenience',
    'convenience_fee',
    'convenienceFee',
  ]);
  const serviceFee = firstFinite(sources, ['service_fee', 'serviceFee']);
  const convenienceFee =
    convenienceFeeRaw ||
    (platformFee > 0 && serviceFee === platformFee ? 0 : serviceFee);
  const gstAmount = firstFinite(sources, ['gst_amount', 'gstAmount', 'gst', 'tax_amount']);
  const gstPercent = firstFinite(sources, [
    'gst_percent',
    'gst_percentage',
    'gstPercent',
    'tax_percent',
  ]);
  const discount = firstFinite(sources, [
    'coupon_discount',
    'discount',
    'discount_amount',
    'promo_discount',
  ]);
  const couponCode = firstText(sources, ['coupon_code', 'couponCode', 'coupon']);
  const walletAmount = firstFinite(sources, [
    'wallet_amount',
    'wallet_used',
    'amount_from_wallet',
    'wallet_debit',
    'paid_from_wallet',
  ]);
  const administrativeCharges = firstFinite(sources, [
    'administrative_charges',
    'administrativeCharges',
  ]);
  const digitalReportAccess = firstFinite(sources, [
    'digital_report_access',
    'digitalReportAccess',
  ]);

  const totalFromApi = firstFinite(
    [summary, payment, receipt],
    ['total_payable_amount', 'total_amount', 'amount', 'totalPaid', 'grand_total'],
  );
  const totalFromParts =
    consultationFee - discount + platformFee + convenienceFee + gstAmount + administrativeCharges + digitalReportAccess;
  const totalPaid =
    totalFromApi > 0
      ? totalFromApi
      : amountFromPaymentEntity(entity, totalFromParts > 0 ? totalFromParts : consultationFee);

  const method = String(entity?.method || receipt?.payment_method || payment?.method || '').trim();
  const methodLabel = method
    ? method.charAt(0).toUpperCase() + method.slice(1)
    : String(receipt?.payment_type || payment?.payment_type || '').trim() || '—';

  const apiLines = Array.isArray(summary?.lines)
    ? summary.lines
        .map((line) => {
          if (!line || typeof line !== 'object') return null;
          const amount = toNumber(line.amount);
          const effect = line.effect === 'subtract' || line.effect === 'minus' ? 'subtract' : 'add';
          const label = String(line.label || '').trim();
          if (!label) return null;
          return { key: String(line.key || ''), label, amount, effect };
        })
        .filter(Boolean)
    : [];

  const partsSum = consultationFee - discount + platformFee + convenienceFee + gstAmount + administrativeCharges + digitalReportAccess;

  return {
    consultationFee,
    platformFee,
    platformFeePercent,
    convenienceFee,
    gstAmount,
    gstPercent,
    discount,
    couponCode,
    walletAmount,
    administrativeCharges,
    digitalReportAccess,
    listedAmount: firstFinite(sources, ['listed_amount']) || consultationFee,
    totalPaid,
    partsSum,
    totalsMatch: rupeesToPaise(partsSum) === rupeesToPaise(totalPaid),
    apiLines,
    paymentMethod: methodLabel,
    paymentStatus: String(receipt?.payment_status || payment?.status || entity?.status || '').trim(),
    paymentId: String(
      entity?.id ||
        info?.cf_payment_id ||
        info?.gateway_payment_id ||
        info?.razorpay_payment_id ||
        receipt?.payment_id ||
        payment?.gateway_payment_id ||
        payment?.payment_id ||
        '',
    ).trim(),
    orderId: String(
      entity?.order_id ||
        info?.cashfree_order_id ||
        info?.gateway_order_id ||
        info?.razorpay_order_id ||
        payment?.order_id ||
        '',
    ).trim(),
    bank: String(entity?.bank || '').trim(),
    bankTransactionId: String(entity?.acquirer_data?.bank_transaction_id || '').trim(),
  };
};

/** True when the receipt total is unexplained by the fee lines we could read. */
export const receiptBreakdownIsIncomplete = (breakdown) => {
  if (!breakdown) return false;
  const extras =
    breakdown.platformFee +
    breakdown.convenienceFee +
    breakdown.gstAmount +
    breakdown.discount +
    breakdown.administrativeCharges +
    breakdown.digitalReportAccess;
  return rupeesToPaise(extras) === 0 && rupeesToPaise(breakdown.totalPaid) !== rupeesToPaise(breakdown.consultationFee);
};

/** A line with no paise is not a charge. GST of ₹0.18 must still appear. */
const showsOnBill = (amount) => rupeesToPaise(amount) !== 0;

export const buildConsultationReceiptBillRows = (breakdown) => {
  if (!breakdown) return [];
  const rows = [];
  const push = (key, label, amount, effect = 'add') => {
    if (!showsOnBill(amount)) return;
    rows.push({ key, label, amount, effect });
  };

  const usableApiLines = (breakdown.apiLines || []).filter((line) => showsOnBill(line.amount));
  if (usableApiLines.length) {
    usableApiLines.forEach((line) => {
      let label = line.label;
      if (line.key === 'gst' || /^gst$/i.test(line.label)) label = percentLabel(label, breakdown.gstPercent);
      if (line.key === 'platform_fee' || /platform/i.test(line.label)) {
        label = percentLabel(label, breakdown.platformFeePercent);
      }
      if (line.key === 'coupon_discount' && breakdown.couponCode && !breakdown.couponCode.includes(' ')) {
        label = `${label} (${breakdown.couponCode})`;
      }
      rows.push({ key: line.key || label, label, amount: line.amount, effect: line.effect });
    });
  } else {
    push('consultation_fee', 'Consultation fee', breakdown.consultationFee);
    const discountLabel = breakdown.couponCode
      ? `Coupon discount (${breakdown.couponCode})`
      : 'Coupon discount';
    push('coupon_discount', discountLabel, breakdown.discount, 'subtract');
    push(
      'platform_fee',
      percentLabel('Platform fee', breakdown.platformFeePercent),
      breakdown.platformFee,
    );
    push('convenience', 'Convenience fee', breakdown.convenienceFee);
    push('gst', percentLabel('GST', breakdown.gstPercent), breakdown.gstAmount);
    push('administrative_charges', 'Administrative charges', breakdown.administrativeCharges);
    push('digital_report_access', 'Digital report access', breakdown.digitalReportAccess);
  }

  const alreadyHasWallet = rows.some((row) => /wallet/i.test(row.key) || /wallet/i.test(row.label));
  if (
    !alreadyHasWallet &&
    breakdown.walletAmount > 0 &&
    rupeesToPaise(breakdown.walletAmount) !== rupeesToPaise(breakdown.totalPaid)
  ) {
    push('wallet', 'Wallet', breakdown.walletAmount, 'subtract');
  }

  return rows;
};
