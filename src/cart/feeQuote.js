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
      id: String(item?.id ?? item?.cart_item_id ?? '').trim(),
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
    summary?.items_after_discount,
    summary?.item_total,
    summary?.subtotal,
    summary?.order_amount,
    summary?.cart_total,
    fallbackBase,
  );

  const couponInfo = data.coupon && typeof data.coupon === 'object' ? data.coupon : null;
  const couponValid = typeof couponInfo?.valid === 'boolean' ? couponInfo.valid : null;
  const couponDiscountRaw = summary?.coupon_discount ?? data?.coupon_discount ?? couponInfo?.discount;
  const quotedCouponCode = String(data?.coupon_code ?? couponInfo?.code ?? '').trim();

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

  // 0 is a real server value. Missing means we may fall back to the config rate.
  const productGstRaw =
    summary?.product_gst ?? summary?.gst_amount ?? summary?.gst ?? data?.product_gst;
  const hasExplicitProductGst = productGstRaw != null && productGstRaw !== '';
  const summaryProductGst = hasExplicitProductGst ? roundMoney(toNumber(productGstRaw)) : null;
  const gstPresent = summaryProductGst != null ? summaryProductGst > 0 : gst.flat > 0 || gst.percent > 0;

  const platformFee = firstRate(
    config?.platform_fee,
    config?.platformFee,
    summary?.platform_fee != null ? { flat: summary.platform_fee, percent: 0 } : null,
    data?.platform_fee_percent != null || data?.platform_fee != null
      ? { flat: data?.platform_fee, percent: data?.platform_fee_percent }
      : null,
  );
  const summaryPlatformRaw = summary?.platform_fee ?? data?.platform_fee;
  const summaryPlatformFee =
    summaryPlatformRaw == null || summaryPlatformRaw === ''
      ? null
      : roundMoney(toNumber(summaryPlatformRaw));
  const shipping = firstRate(
    config?.shipping,
    config?.delivery,
    config?.shipping_charges,
    config?.delivery_fee,
  );
  const cod = firstRate(
    summary?.cod_charges != null ? { flat: summary.cod_charges, percent: 0 } : null,
    config?.cod,
    config?.cod_charges,
    config?.cash_on_delivery,
  );

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
  const deliveryAmountRaw = summary?.delivery_amount ?? data?.delivery_amount;
  const summaryDeliveryAmount =
    deliveryAmountRaw == null || deliveryAmountRaw === ''
      ? null
      : roundMoney(toNumber(deliveryAmountRaw));
  const freeDeliveryFlag = summary?.free_delivery_applicable ?? data?.free_delivery_applicable;
  const summaryFreeDelivery = typeof freeDeliveryFlag === 'boolean' ? freeDeliveryFlag : null;
  const totalPayableRaw = summary?.total_payable_amount ?? data?.total_payable_amount;
  const summaryTotalPayable =
    totalPayableRaw == null || totalPayableRaw === '' ? null : roundMoney(toNumber(totalPayableRaw));
  const orderItems = readOrderItems(data?.items).map((item) =>
    summaryProductGst != null || !gstPresent ? { ...item, gstPercent: 0 } : item,
  );

  return {
    baseAmount,
    gst:
      summaryProductGst != null
        ? summaryProductGst > 0
          ? { flat: summaryProductGst, percent: 0 }
          : { ...EMPTY_RATE }
        : gstPresent
          ? gst
          : { ...EMPTY_RATE },
    gstPresent,
    platformFee: summaryPlatformFee != null ? { flat: summaryPlatformFee, percent: 0 } : platformFee,
    shipping,
    cod,
    currency: String(summary?.currency || data?.currency || 'INR'),
    durationMinutes: toNumber(config?.consultation?.duration_minutes) || null,
    couponDiscount:
      couponValid === false
        ? 0
        : couponDiscountRaw == null || couponDiscountRaw === ''
          ? null
          : roundMoney(toNumber(couponDiscountRaw)),
    quotedCouponCode,
    couponValid,
    couponMessage: String(couponInfo?.message ?? ''),
    itemsAfterDiscount,
    deliveryCharge: delivery.charge,
    freeDeliveryMinimum: firstPositive(summary?.free_delivery_minimum_order_value, delivery.minimum),
    items: orderItems,
    summaryCod: firstPositive(summary?.cod_charges, summary?.cod_charge),
    summaryProductGst,
    summaryPlatformFee,
    summaryDeliveryAmount,
    summaryFreeDelivery,
    summaryTotalPayable,
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
  const requestedCoupon = String(couponCode || '').trim();
  const quoteMatchesCoupon = (quote?.quotedCouponCode || '') === requestedCoupon;
  const apiDiscount =
    quoteMatchesCoupon && quote?.couponDiscount != null
      ? roundMoney(Math.max(0, quote.couponDiscount))
      : null;
  const useApiSummary =
    quote?.itemsAfterDiscount != null &&
    quoteMatchesCoupon &&
    (apiDiscount != null || !requestedCoupon);

  let itemTotal;
  let discount;
  let itemsAfterDiscount;
  if (useApiSummary) {
    // summary.items_after_discount already has summary.coupon_discount removed.
    discount = apiDiscount ?? 0;
    itemsAfterDiscount = roundMoney(Math.max(0, quote.itemsAfterDiscount));
    itemTotal = roundMoney(itemsAfterDiscount + discount);
  } else {
    // Quote was priced without the applied coupon: apply the local discount on top.
    itemTotal =
      quote?.itemsAfterDiscount != null && quote.itemsAfterDiscount > 0
        ? roundMoney(quote.itemsAfterDiscount)
        : items.length
          ? roundMoney(items.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0))
          : roundMoney(quote?.baseAmount || fallbackSubtotal);
    discount = roundMoney(Math.min(Math.max(0, localDiscount), itemTotal));
    itemsAfterDiscount = roundMoney(Math.max(0, itemTotal - discount));
  }
  const discountRatio = itemTotal > 0 ? itemsAfterDiscount / itemTotal : 1;

  // summary.product_gst of 0 means the server is not charging GST. Do not invent it from item tax class.
  let gst = 0;
  let gstPresent = false;
  if (quote?.summaryProductGst != null) {
    gst = roundMoney(Math.max(0, quote.summaryProductGst) * (useApiSummary ? 1 : discountRatio));
    gstPresent = gst > 0;
  } else if (quote?.gstPresent) {
    const computedGst = items.reduce((sum, item) => {
      if (item.gstPercent <= 0) return sum;
      const line = item.sellingPrice * item.quantity * discountRatio;
      return sum + (line * item.gstPercent) / 100;
    }, 0);
    gst = roundMoney(computedGst > 0 ? computedGst : chargeFromRate(quote?.gst, itemsAfterDiscount));
    gstPresent = gst > 0;
  }

  const platformFee =
    quote?.summaryPlatformFee != null
      ? roundMoney(Math.max(0, quote.summaryPlatformFee))
      : chargeFromRate(quote?.platformFee, itemsAfterDiscount);
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
  const freeDelivery =
    quote?.summaryFreeDelivery != null
      ? quote.summaryFreeDelivery
      : meetsMinimum || meetsCondition || freeFromSlab;
  const shipping =
    quote?.summaryDeliveryAmount != null
      ? roundMoney(Math.max(0, quote.summaryDeliveryAmount))
      : freeDelivery
        ? 0
        : roundMoney(deliveryCharge);
  const configuredCod = chargeFromRate(quote?.cod, itemsAfterDiscount);
  const cod = includeCod
    ? roundMoney(configuredCod > 0 ? configuredCod : quote?.summaryCod ?? 0)
    : 0;

  const computedTotal = roundMoney(itemsAfterDiscount + gst + platformFee + shipping + cod);
  let total = computedTotal;
  if (quote?.summaryTotalPayable != null && quoteMatchesCoupon) {
    // summary.total_payable_amount is what the gateway order is created for.
    // It already includes the quote's COD; swap in the COD the customer actually chose.
    total = roundMoney(Math.max(0, quote.summaryTotalPayable - (quote.summaryCod ?? 0) + cod));
    const gap = roundMoney(computedTotal - total);
    if (gst > 0 && Math.abs(gap - gst) < 0.02) {
      gst = 0;
      gstPresent = false;
    }
  }

  return {
    baseAmount: itemTotal,
    discount,
    taxable: itemsAfterDiscount,
    itemsAfterDiscount,
    gst,
    gstPresent,
    platformFee,
    platformRate:
      quote?.summaryPlatformFee != null
        ? { flat: quote.summaryPlatformFee, percent: 0 }
        : quote?.platformFee ?? EMPTY_RATE,
    shipping,
    shippingRate: { flat: shipping, percent: 0 },
    cod,
    codRate: quote?.cod ?? EMPTY_RATE,
    gstRate: gstPresent ? quote?.gst ?? EMPTY_RATE : EMPTY_RATE,
    total,
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
  payable = null,
}) => {
  const base = roundMoney(Math.max(0, baseAmount));
  const appliedDiscount = roundMoney(Math.min(Math.max(0, discount), base));
  const taxable = roundMoney(Math.max(0, base - appliedDiscount));
  let gstAmount = chargeFromRate(gst, taxable);
  const platformAmount = chargeFromRate(platformFee, taxable);
  const shippingAmount = includeShipping ? chargeFromRate(shipping, taxable) : 0;
  const codAmount = includeCod ? chargeFromRate(cod, taxable) : 0;
  let total = roundMoney(taxable + gstAmount + platformAmount + shippingAmount + codAmount);
  if (payable != null && payable !== '' && Number.isFinite(Number(payable))) {
    const serverTotal = roundMoney(Math.max(0, Number(payable)));
    const gap = roundMoney(total - serverTotal);
    if (gstAmount > 0 && Math.abs(gap - gstAmount) < 0.02) gstAmount = 0;
    total = serverTotal;
  }
  const gstRate = gstAmount > 0 ? gst ?? EMPTY_RATE : EMPTY_RATE;
  return {
    baseAmount: base,
    discount: appliedDiscount,
    taxable,
    itemsAfterDiscount: taxable,
    gst: gstAmount,
    gstRate,
    platformFee: platformAmount,
    platformRate: platformFee ?? EMPTY_RATE,
    shipping: shippingAmount,
    shippingRate: shipping ?? EMPTY_RATE,
    cod: codAmount,
    codRate: cod ?? EMPTY_RATE,
    total,
    deliveryCharge: shipping?.flat ?? 0,
    freeDeliveryMinimum: 0,
    freeDelivery: false,
    freeDeliveryNote: '',
  };
};
