import { resolveImageUrl } from '../home/catalog';
import { isPrescriptionRequired } from '../product/stock';

const toPositive = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const resolveCartItemMrp = (item) =>
  toPositive(item?.variant?.mrp) ??
  toPositive(item?.mrp) ??
  toPositive(item?.product?.mrp) ??
  0;

export const resolveCartItemSellingPrice = (item) => {
  const candidates = [
    item?.variant?.selling_price,
    item?.selling_price,
    item?.unit_selling_price,
    item?.unit_price,
    item?.product?.selling_price,
    item?.variant?.price,
  ];
  for (const candidate of candidates) {
    const parsed = toPositive(candidate);
    if (parsed != null) return parsed;
  }
  const mrp = resolveCartItemMrp(item);
  const qty = Math.max(1, Number(item?.quantity) || 1);
  const price = toPositive(item?.price);
  if (price == null) return mrp;
  if (qty > 1) {
    const perUnit = price / qty;
    if (perUnit > 0 && (mrp <= 0 || perUnit <= mrp)) return perUnit;
  }
  return price;
};

export const resolvePayOnDelivery = (item) => {
  const raw =
    item?.pay_on_delivery ??
    item?.is_pay_on_delivery ??
    item?.variant?.pay_on_delivery ??
    item?.product?.pay_on_delivery;
  if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true;
  return false;
};

export const isCodAvailableForItems = (items) =>
  Array.isArray(items) &&
  items.length > 0 &&
  items.every((item) => resolvePayOnDelivery(item));

export const isCartLineOutOfStock = (item) => {
  if (!item) return false;
  if (item._isOutOfStock === true) return true;
  const flag =
    item.out_of_stock ??
    item.is_out_of_stock ??
    item.variant?.out_of_stock ??
    item.in_stock === false;
  if (flag === true || flag === 1 || flag === 'true') return true;
  const inv = Number(
    item.available_quantity ??
      item.variant?.quantity ??
      item.stock_quantity,
  );
  return Number.isFinite(inv) && inv <= 0;
};

export const mapCartProduct = (item, extras = {}) => {
  const qty = Number(item?.quantity) || 0;
  const variantId =
    item?.variant?.variant_id || item?.variant?.id || item?.variant_id || '';
  const name = String(
    item?.variant?.variant_title ||
      item?.variant?.title ||
      item?.product_name ||
      item?.name ||
      '',
  ).trim();
  const image =
    resolveImageUrl(item?.variant) ||
    resolveImageUrl(item) ||
    resolveImageUrl(item?.product);
  return {
    ...item,
    ...extras,
    id: String(item?.id ?? item?.cart_item_id ?? ''),
    cart_item_id: String(item?.id ?? item?.cart_item_id ?? ''),
    name,
    variant_id: String(variantId),
    price: resolveCartItemSellingPrice(item),
    mrp: resolveCartItemMrp(item),
    quantity: qty,
    image,
    size: item?.variant?.size || '',
    gift_wrap: Boolean(item?.gift_wrap || item?.is_gift_wrap),
    pay_on_delivery: resolvePayOnDelivery(item),
    prescription_required: isPrescriptionRequired(item),
    variant: item?.variant,
    available_quantity:
      item?.available_quantity ?? item?.variant?.quantity ?? item?.stock_quantity,
    prescribed_quantity:
      item?.prescribed_quantity ?? item?.doctor_quantity ?? item?.prescription_quantity,
    _isOutOfStock: isCartLineOutOfStock(item),
  };
};

export const isRenderableCartProduct = (product) =>
  Boolean(
    String(product?.variant_id ?? '').trim() &&
      String(product?.name ?? '').trim() &&
      Number(product?.quantity) > 0,
  );

export const buildCartSections = (cartData) => {
  const root = cartData?.data ?? cartData ?? {};
  const sections = [];
  const prescribedLineIds = new Set();
  (root?.prescription_cart?.items ?? []).forEach((group) => {
    (group?.items ?? []).forEach((item) => {
      const id = String(item?.id ?? '').trim();
      if (id) prescribedLineIds.add(id);
    });
  });

  const cartItems = (root?.my_cart?.items ?? [])
    .map((item) => mapCartProduct(item, { source: 'cart' }))
    .filter(isRenderableCartProduct)
    .filter((item) => !prescribedLineIds.has(String(item.id)));
  if (cartItems.length) {
    sections.push({ id: 'cart', title: 'My Cart', type: 'cart', items: cartItems });
  }

  const prescribed = (root?.prescription_cart?.items ?? []).flatMap((group) => {
    const lines = Array.isArray(group?.items) ? group.items : [];
    return lines
      .filter((item) => item?.id)
      .map((item) =>
        mapCartProduct(item, {
          source: 'prescribed',
          doctorName: group?.doctor_name,
          rx_group_id: String(group?.id || item.id),
          appointment_id: group?.appointment_id,
          consultation_id: group?.consultation_id,
          prescription_id: group?.prescription_id,
          doctor_id: group?.doctor_id,
          rx_status: group?.status,
          patient_name: group?.patient_name,
          rx_created_at: group?.created_at,
          rx_source: group?.source,
          rx_group: group,
        }),
      )
      .filter(isRenderableCartProduct);
  });
  if (prescribed.length) {
    sections.push({
      id: 'prescribed',
      title: 'Prescribed Medicines',
      type: 'prescribed',
      items: prescribed,
    });
  }
  return sections;
};

export const formatAddress = (address) => {
  if (!address) return '';
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.zipcode || address.pincode,
  ]
    .filter(Boolean)
    .join(', ');
};

const getResponseMessage = (response) =>
  String(
    response?.message ||
      response?.data?.message ||
      response?.error ||
      response?.data?.error ||
      '',
  ).toLowerCase();

const hasOrderEntity = (response) => {
  const data = response?.data ?? {};
  const order = data.order ?? data;
  return Boolean(
    order?.id ||
      order?.order_id ||
      order?.order_number ||
      order?.order_code ||
      response?.order?.id,
  );
};

const isFulfillmentNoise = (msg) =>
  msg.includes('unicommerce') ||
  msg.includes('uni-commerce') ||
  msg.includes('fulfillment') ||
  msg.includes('inventory') ||
  msg.includes('warehouse') ||
  msg.includes('sync') ||
  msg.includes('channel item') ||
  msg.includes('facility') ||
  msg.includes('allocation');

const isHardPaymentFailure = (msg) =>
  msg.includes('signature') ||
  msg.includes('invalid payment') ||
  msg.includes('payment failed') ||
  msg.includes('authentication failed') ||
  msg.includes('unauthorized') ||
  msg.includes('not verified');

export const isOrderSuccessful = (response) => {
  if (!response || typeof response !== 'object') return false;
  if (response.success === true || response.status === true) return true;
  if (response.success === 'true' || response.success === 1) return true;
  if (hasOrderEntity(response)) return true;

  const data = response.data ?? {};
  const msg = getResponseMessage(response);
  const paidLike =
    data?.payment_id ||
    data?.razorpay_payment_id ||
    data?.status === 'paid' ||
    data?.payment_status === 'paid' ||
    data?.payment_status === 'success' ||
    data?.order_status ||
    data?.verified === true ||
    response?.payment_id ||
    response?.payment_status === 'paid';

  if (isFulfillmentNoise(msg) && (paidLike || hasOrderEntity(response))) return true;
  if (
    response.success === false &&
    isFulfillmentNoise(msg) &&
    !isHardPaymentFailure(msg) &&
    (hasOrderEntity(response) || paidLike)
  ) {
    return true;
  }
  return false;
};

export const isPrepaidVerifyAcceptable = (response, razorpayResult) => {
  if (isOrderSuccessful(response)) return true;
  if (!razorpayResult?.razorpay_payment_id) return false;
  const msg = getResponseMessage(response);
  if (isHardPaymentFailure(msg)) return false;
  if (
    (msg.includes('out of stock') ||
      msg.includes('insufficient') ||
      msg.includes('not available') ||
      msg.includes('no stock')) &&
    !hasOrderEntity(response)
  ) {
    return false;
  }
  return true;
};

export const CHECKOUT_KEY = 'ayurmuni_checkout';
export const ORDER_RESULT_KEY = 'ayurmuni_order_result';
