const toNumber = (value) => {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const amountFromPaymentEntity = (entity, fallbackRupees) => {
  const raw = toNumber(entity?.amount);
  if (!raw) return fallbackRupees;
  if (raw >= 1000 && Number.isInteger(raw)) return raw / 100;
  return raw;
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

export const parseConsultationReceiptBreakdown = (receipt) => {
  const notes = getConsultationPaymentNotes(receipt);
  const entity = getConsultationPaymentEntity(receipt);
  const info = receipt?.payment_information || {};

  const consultationFee = toNumber(receipt?.consultation_fees ?? notes?.listed_amount ?? 0);
  const platformFee = toNumber(notes?.platform_fee ?? receipt?.platform_fee);
  const gstAmount = toNumber(notes?.gst_amount ?? receipt?.gst_amount);
  const listedAmount = toNumber(notes?.listed_amount) || consultationFee;

  const totalFromApi = toNumber(receipt?.amount ?? receipt?.total_amount);
  const totalFromParts =
    consultationFee + platformFee + gstAmount > 0
      ? consultationFee + platformFee + gstAmount
      : 0;
  const totalPaid =
    totalFromApi > 0
      ? totalFromApi
      : amountFromPaymentEntity(entity, totalFromParts || consultationFee);

  const method = String(entity?.method || receipt?.payment_method || '').trim();
  const methodLabel = method
    ? method.charAt(0).toUpperCase() + method.slice(1)
    : String(receipt?.payment_type || '').trim() || '—';

  return {
    consultationFee,
    platformFee,
    gstAmount,
    listedAmount,
    totalPaid,
    paymentMethod: methodLabel,
    paymentStatus: String(receipt?.payment_status || entity?.status || '').trim(),
    paymentId: String(
      entity?.id || info?.razorpay_payment_id || receipt?.payment_id || '',
    ).trim(),
    orderId: String(entity?.order_id || info?.razorpay_order_id || '').trim(),
    bank: String(entity?.bank || '').trim(),
    bankTransactionId: String(entity?.acquirer_data?.bank_transaction_id || '').trim(),
  };
};
