const EMPTY_RATE = { flat: 0, percent: 0 };

export const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const readFeeRate = (source) => ({
  flat: Math.max(0, toNumber(source?.flat ?? source?.amount ?? source?.fixed)),
  percent: Math.max(0, toNumber(source?.percent ?? source?.percentage)),
});

export const chargeFromRate = (rate, taxableBase) => {
  const flat = rate?.flat ?? 0;
  const percent = rate?.percent ?? 0;
  if (flat > 0) return roundMoney(flat);
  if (percent > 0) return roundMoney((Math.max(0, taxableBase) * percent) / 100);
  return 0;
};

export const feeRateLabel = (prefix, rate) => {
  if ((rate?.percent ?? 0) > 0 && !(rate?.flat && rate.flat > 0)) {
    return `${prefix} (${rate?.percent}%)`;
  }
  return prefix;
};

const firstRate = (...sources) => {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const rate = readFeeRate(source);
    if (rate.flat > 0 || rate.percent > 0) return rate;
  }
  return { ...EMPTY_RATE };
};

const firstPositive = (...values) => {
  for (const value of values) {
    const n = toNumber(value);
    if (n > 0) return roundMoney(n);
  }
  return 0;
};

const gstPercentFromClass = (source) => {
  if (source == null || source === '') return 0;
  if (Array.isArray(source)) {
    const percents = source.map((entry) => gstPercentFromClass(entry)).filter((n) => n > 0);
    if (!percents.length) return 0;
    const looksLikeSplit = percents.every((n) => n <= 50) && percents.length > 1;
    return looksLikeSplit ? Math.min(100, percents.reduce((sum, n) => sum + n, 0)) : percents[0];
  }
  if (typeof source === 'number') return source > 0 && source <= 100 ? source : 0;
  if (typeof source === 'string') {
    const match = source.match(/(\d+(?:\.\d+)?)/);
    const n = match ? Number(match[1]) : 0;
    return n > 0 && n <= 100 ? n : 0;
  }
  if (typeof source !== 'object') return 0;

  const direct = firstPositive(
    source.tax_percentage,
    source.taxPercentage,
    source.gst_percentage,
    source.gstPercentage,
    source.percentage,
    source.percent,
    source.igst,
    source.integrated_gst,
    source.integratedGst,
    source.rate,
  );
  if (direct > 0 && direct <= 100) return direct;

  const split =
    toNumber(source.cgst ?? source.central_gst ?? source.centralGst) +
    toNumber(source.sgst ?? source.state_gst ?? source.stateGst);
  if (split > 0 && split <= 100) return split;

  const nested = gstPercentFromClass(
    source.tax_type || source.taxType || source.gst_tax_type || source.gstTaxType || source.components,
  );
  if (nested > 0) return nested;

  return gstPercentFromClass(
    source.code || source.gst_tax_type_code || source.gstTaxTypeCode || source.name,
  );
};

const readOrderItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      sellingPrice: toNumber(item?.selling_price ?? item?.price ?? item?.unit_price),
      quantity: Math.max(0, toNumber(item?.quantity) || 1),
      gstPercent: gstPercentFromClass(item?.unicommerce_gst_class ?? item?.gst_class ?? item?.gst),
    }))
    .filter((item) => item.sellingPrice > 0 && item.quantity > 0);
};

const readMoneyField = (source) => {
  if (source == null || source === '') return 0;
  if (typeof source === 'number' || typeof source === 'string') return firstPositive(source);
  if (typeof source !== 'object') return 0;
  return firstPositive(
    source.amount,
    source.flat,
    source.charge,
    source.charges,
    source.value,
    source.fee,
    source.standard,
    source.base,
    source.delivery_charge,
    source.delivery_charges,
    source.shipping_charge,
  );
};

const readDeliveryRules = (delivery, summary) => {
  const charge = firstPositive(
    readMoneyField(delivery?.charges),
    readMoneyField(delivery?.charge),
    summary?.delivery_charges,
    summary?.delivery_charge,
  );
  const minimum = firstPositive(
    delivery?.free_delivery_minimum_order_value,
    summary?.free_delivery_minimum_order_value,
  );
  return {
    charge,
    minimum,
    factors: Array.isArray(delivery?.variation_factors) ? delivery.variation_factors : [],
    conditions: Array.isArray(delivery?.free_delivery_conditions)
      ? delivery.free_delivery_conditions
      : delivery?.free_delivery_conditions && typeof delivery.free_delivery_conditions === 'object'
        ? [delivery.free_delivery_conditions]
        : [],
  };
};

const chargeFromVariation = (factor, orderValue) => {
  if (!factor || typeof factor !== 'object') return null;
  const min = firstPositive(
    factor.min_order_value,
    factor.minimum_order_value,
    factor.min,
    factor.from,
  );
  const max = firstPositive(
    factor.max_order_value,
    factor.maximum_order_value,
    factor.max,
    factor.to,
  );
  if (min > 0 && orderValue < min) return null;
  if (max > 0 && orderValue > max) return null;
  const markedFree = factor.free === true || factor.is_free === true;
  const charge = readMoneyField(
    factor.charge ??
      factor.charges ??
      factor.amount ??
      factor.delivery_charge ??
      factor.delivery_charges ??
      factor.fee,
  );
  if (markedFree) return 0;
  if (charge > 0) return charge;
  return null;
};

const matchesFreeDeliveryCondition = (condition, orderValue) => {
  if (!condition || typeof condition !== 'object') return false;
  const min = firstPositive(
    condition.min_order_value,
    condition.minimum_order_value,
    condition.free_delivery_minimum_order_value,
    condition.order_value,
  );
  if (min > 0) return orderValue >= min;
  return condition.free === true || condition.is_free === true || condition.applicable === true;
};

export const parseFeeQuoteConfig = (data, fallbackBase = 0, options = {}) => {
  if (!data || typeof data !== 'object') return null;

  const config = data.configurations ?? data.configuration ?? {};
  const summary = data.summary ?? {};

  const baseAmount = firstPositive(
    ...(options.ignoreConsultationFee
      ? []
      : [
          config?.consultation?.global_fee,
          summary?.consultation_fee,
          summary?.taxable_consultation_fee,
          data?.consultation_fee,
        ]),
    summary?.item_total,
    summary?.subtotal,
    summary?.order_amount,
    summary?.cart_total,
    fallbackBase,
  );

  const itemsAfterDiscountRaw = summary?.items_after_discount ?? data?.items_after_discount;
  const itemsAfterDiscount =
    itemsAfterDiscountRaw == null || itemsAfterDiscountRaw === ''
      ? null
      : roundMoney(toNumber(itemsAfterDiscountRaw));

  const gst = firstRate(
    config?.gst,
    data?.gst_percent != null || data?.gst_amount != null
      ? { flat: data?.gst_amount, percent: data?.gst_percent }
      : null,
  );
  const platformFee = firstRate(
    config?.platform_fee,
    config?.platformFee,
    data?.platform_fee_percent != null || data?.platform_fee != null
      ? { flat: data?.platform_fee, percent: data?.platform_fee_percent }
      : null,
  );
  const shipping = firstRate(
    config?.shipping,
    config?.delivery,
    config?.shipping_charges,
    config?.delivery_fee,
  );
  const cod = firstRate(config?.cod, config?.cod_charges, config?.cash_on_delivery);

  if (
    baseAmount <= 0 &&
    gst.flat <= 0 &&
    gst.percent <= 0 &&
    platformFee.flat <= 0 &&
    platformFee.percent <= 0
  ) {
    return null;
  }

  const delivery = readDeliveryRules(config?.delivery, summary);

  return {
    baseAmount,
    gst,
    platformFee,
    shipping,
    cod,
    currency: String(summary?.currency || data?.currency || 'INR'),
    durationMinutes: toNumber(config?.consultation?.duration_minutes) || null,
    couponDiscount:
      summary?.coupon_discount == null && data?.coupon_discount == null
        ? null
        : roundMoney(toNumber(summary?.coupon_discount ?? data?.coupon_discount)),
    itemsAfterDiscount,
    deliveryCharge: delivery.charge,
    freeDeliveryMinimum: delivery.minimum,
    items: readOrderItems(data?.items),
    summaryCod: firstPositive(summary?.cod_charges, summary?.cod_charge),
    summaryProductGst: firstPositive(summary?.product_gst, summary?.gst),
    variationFactors: delivery.factors,
    freeDeliveryConditions: delivery.conditions,
  };
};

export const calculateOrderFees = ({
  quote,
  fallbackSubtotal = 0,
  localDiscount = 0,
  includeCod = false,
  couponCode,
}) => {
  const items = quote?.items ?? [];
  const itemTotal = items.length
    ? roundMoney(items.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0))
    : roundMoney(quote?.baseAmount || fallbackSubtotal);

  const requestedCoupon = String(couponCode || '').trim();
  const quoteMatchesCoupon = (quote?.quotedCouponCode || '') === requestedCoupon;
  const resolvedDiscount =
    quoteMatchesCoupon && quote?.couponDiscount != null ? quote.couponDiscount : localDiscount;
  const discount = roundMoney(Math.min(Math.max(0, resolvedDiscount), itemTotal));
  const taxable = roundMoney(Math.max(0, itemTotal - discount));
  const itemsAfterDiscount = roundMoney(
    quote?.itemsAfterDiscount != null ? quote.itemsAfterDiscount : taxable,
  );
  const discountRatio = itemTotal > 0 ? itemsAfterDiscount / itemTotal : 1;

  const computedGst = items.reduce((sum, item) => {
    if (item.gstPercent <= 0) return sum;
    const line = item.sellingPrice * item.quantity * discountRatio;
    return sum + (line * item.gstPercent) / 100;
  }, 0);
  const gst = roundMoney(
    computedGst > 0 ? computedGst : (quote?.summaryProductGst ?? 0) * discountRatio,
  );

  const platformFee = chargeFromRate(quote?.platformFee, itemsAfterDiscount);
  const slabCharge = (quote?.variationFactors ?? [])
    .map((factor) => chargeFromVariation(factor, itemsAfterDiscount))
    .find((charge) => charge != null);
  const deliveryCharge = slabCharge != null ? slabCharge : quote?.deliveryCharge ?? 0;
  const freeDeliveryMinimum = quote?.freeDeliveryMinimum ?? 0;
  const meetsMinimum = freeDeliveryMinimum > 0 && itemsAfterDiscount >= freeDeliveryMinimum;
  const meetsCondition = (quote?.freeDeliveryConditions ?? []).some((condition) =>
    matchesFreeDeliveryCondition(condition, itemsAfterDiscount),
  );
  const freeFromSlab = slabCharge === 0;
  const freeDelivery = meetsMinimum || meetsCondition || freeFromSlab;
  const shipping = freeDelivery ? 0 : roundMoney(deliveryCharge);
  const configuredCod = chargeFromRate(quote?.cod, itemsAfterDiscount);
  const cod = includeCod
    ? roundMoney(configuredCod > 0 ? configuredCod : quote?.summaryCod ?? 0)
    : 0;

  const percents = [...new Set(items.map((item) => item.gstPercent).filter((n) => n > 0))];

  return {
    baseAmount: itemTotal,
    discount,
    taxable: itemsAfterDiscount,
    itemsAfterDiscount,
    gst,
    platformFee,
    platformRate: quote?.platformFee ?? EMPTY_RATE,
    shipping,
    shippingRate: { flat: shipping, percent: 0 },
    cod,
    codRate: quote?.cod ?? EMPTY_RATE,
    gstRate: percents.length === 1 ? { flat: 0, percent: percents[0] } : quote?.gst ?? EMPTY_RATE,
    total: roundMoney(itemsAfterDiscount + gst + platformFee + shipping + cod),
    deliveryCharge,
    freeDeliveryMinimum,
    freeDelivery,
    freeDeliveryNote:
      freeDelivery && freeDeliveryMinimum > 0
        ? `Free delivery on orders of ₹${freeDeliveryMinimum}+`
        : freeDeliveryMinimum > 0 && itemsAfterDiscount < freeDeliveryMinimum
          ? `Add ₹${roundMoney(freeDeliveryMinimum - itemsAfterDiscount)} more for free delivery`
          : '',
  };
};

export const calculateFeeBreakdown = ({
  baseAmount,
  discount = 0,
  gst,
  platformFee,
  shipping,
  cod,
  includeShipping = true,
  includeCod = false,
}) => {
  const base = roundMoney(Math.max(0, baseAmount));
  const appliedDiscount = roundMoney(Math.min(Math.max(0, discount), base));
  const taxable = roundMoney(Math.max(0, base - appliedDiscount));
  const gstAmount = chargeFromRate(gst, taxable);
  const platformAmount = chargeFromRate(platformFee, taxable);
  const shippingAmount = includeShipping ? chargeFromRate(shipping, taxable) : 0;
  const codAmount = includeCod ? chargeFromRate(cod, taxable) : 0;
  return {
    baseAmount: base,
    discount: appliedDiscount,
    taxable,
    itemsAfterDiscount: taxable,
    gst: gstAmount,
    gstRate: gst ?? EMPTY_RATE,
    platformFee: platformAmount,
    platformRate: platformFee ?? EMPTY_RATE,
    shipping: shippingAmount,
    shippingRate: shipping ?? EMPTY_RATE,
    cod: codAmount,
    codRate: cod ?? EMPTY_RATE,
    total: roundMoney(taxable + gstAmount + platformAmount + shippingAmount + codAmount),
    deliveryCharge: shipping?.flat ?? 0,
    freeDeliveryMinimum: 0,
    freeDelivery: false,
    freeDeliveryNote: '',
  };
};
