const STATUS_RANK = {
  pending: 0,
  placed: 0,
  confirmed: 1,
  processing: 2,
  verified: 2,
  packed: 3,
  dispatched: 4,
  shipped: 5,
  in_transit: 5,
  out_for_delivery: 6,
  delivered: 7,
  completed: 7,
  cancelled: -1,
  returned: -1,
};

export const CANCEL_ALLOWED = ['pending', 'confirmed', 'processing', 'packed'];
export const INVOICE_ALLOWED = [
  'packed',
  'dispatched',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'returned',
];
export const RETURN_ALLOWED = ['delivered'];
export const TRACKING_ALLOWED = [
  'packed',
  'dispatched',
  'shipped',
  'in_transit',
  'out_for_delivery',
];

export const CANCELLATION_REASONS = [
  'Changed my mind',
  'Ordered by mistake',
  'Found a better price',
  'Product is no longer required',
  'Other',
];

export const SUPPORT_EMAIL = 'support@ayurmuni.com';

const normalizeStatus = (status) => String(status ?? 'pending').toLowerCase().replace(/\s+/g, '_');

export const getOrderStatusRank = (status) => STATUS_RANK[normalizeStatus(status)] ?? 0;

export const formatOrderDateTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const buildOrderTrackingSteps = (order) => {
  const currentStatus = normalizeStatus(order?.order_status || order?.status);
  const currentRank = getOrderStatusRank(currentStatus);
  const isCancelled = currentStatus === 'cancelled';
  const isReturned = currentStatus === 'returned';

  const history = Array.isArray(order?.status_history)
    ? order.status_history
    : Array.isArray(order?.tracking_history)
      ? order.tracking_history
      : [];

  const findHistoryDate = (...keys) => {
    const match = history.find((entry) => {
      const status = normalizeStatus(entry?.status ?? entry?.order_status ?? entry?.title);
      return keys.some((key) => status.includes(key));
    });
    return match?.created_at ?? match?.date ?? match?.timestamp ?? '';
  };

  const formatStepDate = (value) => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isCancelled || isReturned) {
    return [
      {
        key: 'placed',
        label: 'Order Placed',
        date: formatStepDate(order?.created_at),
        completed: true,
        active: false,
      },
      {
        key: isReturned ? 'returned' : 'cancelled',
        label: isReturned ? 'Returned' : 'Cancelled',
        subtitle:
          order?.cancellation_reason ??
          order?.return_reason ??
          (isReturned ? 'Order was returned' : 'Order was cancelled'),
        date: formatStepDate(order?.updated_at),
        completed: true,
        active: true,
      },
    ];
  }

  return [
    {
      key: 'placed',
      label: 'Order Placed',
      subtitle: 'We received your order',
      date: formatStepDate(order?.created_at ?? findHistoryDate('placed', 'pending')),
      completed: currentRank >= 0,
      active: currentRank === 0,
    },
    {
      key: 'confirmed',
      label: 'Confirmed',
      subtitle: 'Order confirmed by pharmacy',
      date: formatStepDate(findHistoryDate('confirmed')),
      completed: currentRank >= 1,
      active: currentRank === 1,
    },
    {
      key: 'processing',
      label: 'Processing',
      subtitle: 'Preparing your items',
      date: formatStepDate(findHistoryDate('processing', 'verified')),
      completed: currentRank >= 2,
      active: currentRank === 2,
    },
    {
      key: 'packed',
      label: 'Packed',
      subtitle: 'Ready for dispatch',
      date: formatStepDate(findHistoryDate('packed')),
      completed: currentRank >= 3,
      active: currentRank === 3,
    },
    {
      key: 'dispatched',
      label: 'Dispatched',
      subtitle: 'Handed to courier',
      date: formatStepDate(findHistoryDate('dispatched')),
      completed: currentRank >= 4,
      active: currentRank === 4,
    },
    {
      key: 'shipped',
      label: 'Shipped',
      subtitle: currentStatus === 'in_transit' ? 'In transit to your city' : 'On the way to you',
      date: formatStepDate(findHistoryDate('shipped', 'in_transit', 'transit')),
      completed: currentRank >= 5,
      active: currentRank === 5,
    },
    {
      key: 'out_for_delivery',
      label: 'Out for Delivery',
      subtitle: 'Arriving today',
      date: formatStepDate(findHistoryDate('out_for_delivery')),
      completed: currentRank >= 6,
      active: currentRank === 6,
    },
    {
      key: 'delivered',
      label: 'Delivered',
      subtitle: 'Order completed',
      date: formatStepDate(order?.delivered_at ?? findHistoryDate('delivered', 'completed')),
      completed: currentRank >= 7,
      active: currentRank >= 7,
    },
  ];
};

export const formatDeliveryAddress = (address) => {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.zipcode || address.pincode,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');
};

export const resolveOrderItemsTotal = (order) => {
  const candidates = [
    order?.items_total,
    order?.item_total,
    order?.items_subtotal,
    order?.products_total,
    order?.subtotal,
    order?.cart_subtotal,
    order?.amount_items,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const items = Array.isArray(order?.items) ? order.items : [];
  const sum = items.reduce((acc, item) => {
    const qty = Number(item?.quantity ?? 1) || 1;
    const unit = Number(
      item?.selling_price ?? item?.variant?.selling_price ?? item?.price ?? item?.unit_price ?? 0,
    );
    const line = Number(item?.item_total ?? item?.line_total ?? item?.total ?? item?.subtotal ?? unit * qty);
    return acc + (Number.isFinite(line) ? line : 0);
  }, 0);
  if (sum > 0) return sum;
  const grand = Number(order?.total_amount ?? order?.grand_total ?? 0);
  if (!Number.isFinite(grand) || grand <= 0) return 0;
  const shipping = Number(order?.shipping_charges ?? 0) || 0;
  const cod = Number(order?.cod_charges ?? 0) || 0;
  const discount = Number(order?.total_discount ?? order?.discount ?? 0) || 0;
  const derived = grand - shipping - cod + discount;
  return derived > 0 ? derived : grand;
};

export const buildPaymentRows = (order) => {
  const num = (...keys) => {
    for (const key of keys) {
      const n = Number(order?.[key]);
      if (Number.isFinite(n) && n !== 0) return n;
    }
    return 0;
  };
  const itemsTotal = resolveOrderItemsTotal(order);
  const discount = Math.abs(
    num('total_discount', 'discount', 'coupon_discount', 'promo_discount', 'discount_amount'),
  );
  const giftWrap = num('gift_wrap_charges', 'gift_wrap_amount', 'gift_wrap_fee', 'gift_wrap');
  const platformFee = num('platform_fee', 'platform_charges', 'convenience_fee', 'service_fee');
  const gstDirect = num('gst', 'gst_amount', 'tax', 'tax_amount', 'igst');
  const gstSplit = (Number(order?.cgst) || 0) + (Number(order?.sgst) || 0) + (Number(order?.ugst) || 0);
  const gst = gstDirect > 0 ? gstDirect : gstSplit > 0 ? gstSplit : 0;
  const shipping = num('shipping_charges', 'shipping', 'delivery_charges');
  const cod = num('cod_charges', 'cod_fee', 'cod_amount');
  return {
    itemsTotal,
    discount,
    giftWrap,
    platformFee,
    gst,
    shipping,
    cod,
  };
};

export const getRefundInfo = (order) => {
  const amount = Number(
    order?.refund_amount ?? order?.refunded_amount ?? order?.refund?.amount ?? order?.refund?.refund_amount ?? 0,
  );
  const status = String(
    order?.refund_status ?? order?.refund?.status ?? order?.refund?.refund_status ?? '',
  ).trim();
  const method = String(
    order?.refund_method ?? order?.refund?.method ?? order?.refund?.refund_method ?? '',
  ).trim();
  if (!status && !(Number.isFinite(amount) && amount > 0)) return null;
  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    status,
    method,
  };
};

export const getDeliveryAgent = (order, live) => {
  const nested = order?.delivery_partner ?? order?.delivery_agent ?? order?.delivery_person ?? {};
  const name = String(live?.agentName || nested?.name || nested?.full_name || '').trim();
  const phone = String(live?.agentPhone || nested?.phone || nested?.mobile || '').trim();
  if (!name && !phone) return null;
  return { name: name || 'Delivery Partner', phone };
};
