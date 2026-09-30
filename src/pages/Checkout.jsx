import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Leaf, MapPin, Plus } from 'lucide-react';
import AppShell from '../components/AppShell';
import CouponApplyCard from '../components/CouponApplyCard';
import PageHeader from '../components/PageHeader';
import { formatRupee } from '../home/catalog';
import { useCart } from '../hooks/useCart';
import { useCheckoutCoupons } from '../hooks/useCheckoutCoupons';
import {
  CHECKOUT_KEY,
  ORDER_RESULT_KEY,
  formatAddress,
  isCodAvailableForItems,
  isOrderSuccessful,
  isPrepaidVerifyAcceptable,
} from '../cart/mapCart';
import { calculateOrderFees, feeRateLabel, parseFeeQuoteConfig } from '../cart/feeQuote';
import { getOrderFeeQuote, placeOrder, verifyOrderPayment } from '../services/orderService';
import { getAddresses, listAddresses, user_profile } from '../services/profileService';
import { formatOrderStockError } from '../product/stock';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import { Badge, Button, Disclaimer, EmptyState } from '../components/ui';
import { CHECKOUT_COPY as T } from '../content/checkout';
import '../design/pages/checkout.css';

const loadRazorpay = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Unable to load Razorpay'));
    document.body.appendChild(script);
  });

const pickPaymentData = (orderResponse) => {
  const data = orderResponse?.data && typeof orderResponse.data === 'object' ? orderResponse.data : {};
  const nested = data.payment || orderResponse?.payment || data.order?.payment || {};
  return {
    ...orderResponse,
    ...data,
    ...(data.order && typeof data.order === 'object' ? data.order : {}),
    ...nested,
  };
};

const isCouponOrderError = (message) => {
  const msg = String(message || '').toLowerCase();
  return msg.includes('coupon') || msg.includes('matching product') || msg.includes('does not apply');
};

const money = (value) => formatRupee(value, { decimals: 2 });

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchCart } = useCart();
  const [items, setItems] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState('');
  const [method, setMethod] = useState('cod');
  const [feeConfig, setFeeConfig] = useState(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState(null);
  const [billExpanded, setBillExpanded] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    const fromState = location.state?.selectedProducts;
    if (Array.isArray(fromState) && fromState.length) {
      setItems(fromState);
      sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(fromState));
      return;
    }
    try {
      const cached = JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) || '[]');
      setItems(Array.isArray(cached) ? cached : []);
    } catch {
      setItems([]);
    }
  }, [location.state]);

  useEffect(() => {
    const picked = location.state?.selectedAddress;
    if (!picked?.id) return;
    setAddressId(String(picked.id));
    setAddresses((prev) => {
      const exists = prev.some((item) => String(item.id) === String(picked.id));
      return exists
        ? prev.map((item) => (String(item.id) === String(picked.id) ? { ...item, ...picked } : item))
        : [picked, ...prev];
    });
  }, [location.state?.selectedAddress]);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to checkout'))) return;
      const profileRes = await user_profile();
      const profile =
        profileRes?.data && !Array.isArray(profileRes.data) ? profileRes.data : profileRes;
      setCustomer(profile);
      const fromProfile = Array.isArray(profile?.addresses) ? profile.addresses : [];
      const addressRes = await getAddresses();
      const list = listAddresses(addressRes);
      const merged = list.length ? list : fromProfile;
      setAddresses((_prev) => {
        if (!location.state?.selectedAddress?.id) return merged;
        const picked = location.state.selectedAddress;
        const exists = merged.some((item) => String(item.id) === String(picked.id));
        return exists
          ? merged.map((item) => (String(item.id) === String(picked.id) ? { ...item, ...picked } : item))
          : [picked, ...merged];
      });
      if (!location.state?.selectedAddress?.id) {
        const def = merged.find((item) => item?.is_default) || merged[0];
        if (def?.id) setAddressId(String(def.id));
      }
    })();
  }, [location.state?.selectedAddress]);

  const cartItemIds = useMemo(
    () => items.map((item) => String(item.cart_item_id || item.id)).filter(Boolean),
    [items],
  );
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0),
    [items],
  );
  const itemUnits = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [items],
  );
  const codAvailable = isCodAvailableForItems(items);

  const {
    coupons,
    eligibleCoupons,
    loading: couponsLoading,
    applied: appliedCoupon,
    error: couponError,
    discount: couponDiscount,
    applyCode,
    remove: removeCoupon,
  } = useCheckoutCoupons('product', subtotal);

  useEffect(() => {
    if (!codAvailable && method === 'cod') setMethod('online');
  }, [codAvailable, method]);

  useEffect(() => {
    if (!cartItemIds.length) {
      setFeeConfig(null);
      setFeeError(null);
      return undefined;
    }
    let alive = true;
    setFeeLoading(true);
    (async () => {
      try {
        const res = await getOrderFeeQuote({
          cart_item_ids: cartItemIds,
          coupon_code: appliedCoupon?.code,
        });
        if (!alive) return;
        const quoteData = res?.data ?? res;
        const summary = quoteData?.summary ?? {};
        const hasRates = Boolean(
          quoteData?.configurations?.gst ||
            quoteData?.configurations?.platform_fee ||
            quoteData?.configurations?.delivery ||
            (Array.isArray(quoteData?.items) && quoteData.items.length) ||
            summary?.item_total ||
            summary?.gst ||
            summary?.platform_fee ||
            summary?.delivery_charge ||
            summary?.delivery_charges,
        );
        const parsed = hasRates
          ? parseFeeQuoteConfig(
              {
                ...quoteData,
                configurations: quoteData?.configurations || {
                  gst: { flat: Number(summary.gst ?? summary.product_gst) || 0 },
                  platform_fee: { flat: Number(summary.platform_fee) || 0 },
                  delivery: {
                    charges: Number(
                      summary.delivery_charge ?? summary.delivery_charges ?? summary.shipping_charges,
                    ) || 0,
                    free_delivery_minimum_order_value: summary.free_delivery_minimum_order_value,
                  },
                  cod: { flat: Number(summary.cod_charges ?? summary.cod) || 0 },
                },
              },
              subtotal,
              { ignoreConsultationFee: true },
            )
          : null;
        if (parsed) parsed.quotedCouponCode = String(appliedCoupon?.code || '').trim();
        setFeeConfig(parsed);
        setFeeError(parsed ? null : 'Unable to load order fees. Please try again.');
      } catch {
        if (alive) {
          setFeeConfig(null);
          setFeeError('Unable to load order fees. Please try again.');
        }
      } finally {
        if (alive) setFeeLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cartItemIds, appliedCoupon?.code, subtotal]);

  const feeBreakdown = useMemo(
    () =>
      calculateOrderFees({
        quote: feeConfig,
        fallbackSubtotal: subtotal,
        localDiscount: couponDiscount,
        includeCod: method === 'cod',
        couponCode: appliedCoupon?.code,
      }),
    [feeConfig, subtotal, couponDiscount, method, appliedCoupon?.code],
  );

  const shipping = feeBreakdown.shipping;
  const gst = feeBreakdown.gst;
  const platform = feeBreakdown.platformFee;
  const codFee = feeBreakdown.cod;
  const total = feeBreakdown.total;
  const selectedAddress = addresses.find((item) => String(item.id) === String(addressId));
  const busy = placing || verifying;

  const failMessage = (result, fallback) =>
    formatOrderStockError(result?.message) ||
    formatOrderStockError(result?.data?.message) ||
    result?.message ||
    result?.data?.message ||
    fallback;

  const finishOrder = async (result, orderedItems = items) => {
    sessionStorage.removeItem(CHECKOUT_KEY);
    sessionStorage.setItem(
      ORDER_RESULT_KEY,
      JSON.stringify({
        order: result?.data?.order ?? result?.data ?? result,
        items: orderedItems,
      }),
    );
    await fetchCart();
    navigate('/order-confirmation', { replace: true });
  };

  const handleCouponFailure = (message) => {
    if (isCouponOrderError(message) && appliedCoupon) {
      removeCoupon();
      showSuccessToast(
        'This coupon does not apply to items in your cart. Coupon removed — try placing the order again.',
        'error',
      );
      return true;
    }
    return false;
  };

  const handleCod = async () => {
    if (!codAvailable) {
      showSuccessToast('COD is disabled for this order', 'error');
      return;
    }
    if (!addressId) {
      showSuccessToast('Please select a delivery address', 'error');
      return;
    }
    setPlacing(true);
    setOrderError('');
    try {
      const result = await placeOrder({
        delivery_address_id: addressId,
        payment_type: 'cod',
        payment_method: 'cash',
        shipping_method: 'STD',
        shipping_charges: shipping,
        cod_charges: codFee,
        prepaid_amount: total,
        cart_item_ids: cartItemIds,
        coupon_code: appliedCoupon?.code,
        gift_wrap_item_ids: items
          .filter((item) => item.gift_wrap)
          .map((item) => item.cart_item_id || item.id),
      });
      if (isOrderSuccessful(result)) {
        await finishOrder(result);
        return;
      }
      const failMsg = failMessage(result, 'Order failed');
      if (handleCouponFailure(failMsg)) return;
      setOrderError(failMsg);
      showSuccessToast(failMsg, 'error');
    } catch (error) {
      const failMsg = formatOrderStockError(error?.message) || error?.message || 'Order failed';
      if (handleCouponFailure(failMsg)) return;
      setOrderError(failMsg);
      showSuccessToast(failMsg, 'error');
    } finally {
      setPlacing(false);
    }
  };

  const handleOnline = async () => {
    if (!addressId) {
      showSuccessToast('Please add a delivery address before checkout', 'error');
      return;
    }
    setPlacing(true);
    setOrderError('');
    try {
      const result = await placeOrder({
        delivery_address_id: addressId,
        payment_type: 'prepaid',
        shipping_method: 'STD',
        shipping_charges: shipping,
        cod_charges: 0,
        prepaid_amount: total,
        cart_item_ids: cartItemIds,
        coupon_code: appliedCoupon?.code,
        gift_wrap_item_ids: items
          .filter((item) => item.gift_wrap)
          .map((item) => item.cart_item_id || item.id),
      });
      if (!result?.success && !isOrderSuccessful(result)) {
        const failMsg = failMessage(result, 'Order failed');
        if (handleCouponFailure(failMsg)) return;
        setOrderError(failMsg);
        showSuccessToast(failMsg, 'error');
        return;
      }
      const payment = pickPaymentData(result);
      const key = String(payment?.razorpay_key ?? payment?.key ?? payment?.key_id ?? '').trim();
      const orderId = String(
        payment?.razorpay_order_id ?? payment?.razorpayOrderId ?? payment?.rzp_order_id ?? '',
      ).trim();
      const amount = Math.round(Number(payment?.amount) || total * 100);
      if (!key || !orderId) {
        if (isOrderSuccessful(result)) {
          await finishOrder(result);
          return;
        }
        showSuccessToast('Payment details missing. Please try again.', 'error');
        return;
      }
      const Razorpay = await loadRazorpay();
      await new Promise((resolve) => {
        const rzp = new Razorpay({
          key,
          amount,
          currency: payment?.currency || 'INR',
          name: 'Ayurmuni',
          description: 'Product order',
          order_id: orderId,
          prefill: {
            name: customer?.first_name || '',
            email: customer?.email || '',
            contact: customer?.phone_number || customer?.phone || '',
          },
          theme: { color: '#0D614E' },
          handler: async (response) => {
            setVerifying(true);
            try {
              const verify = await verifyOrderPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (isPrepaidVerifyAcceptable(verify, response)) {
                await finishOrder(verify?.data ? verify : result);
              } else {
                const failMsg = failMessage(verify, 'Payment verification failed');
                setOrderError(failMsg);
                showSuccessToast(failMsg, 'error');
              }
            } finally {
              setVerifying(false);
              resolve();
            }
          },
          modal: {
            ondismiss: () => {
              showSuccessToast('Payment cancelled', 'error');
              resolve();
            },
          },
        });
        rzp.open();
      });
    } catch (error) {
      const failMsg = formatOrderStockError(error?.message) || error?.message || 'Unable to start payment';
      if (handleCouponFailure(failMsg)) return;
      setOrderError(failMsg);
      showSuccessToast(failMsg, 'error');
    } finally {
      setPlacing(false);
    }
  };

  const place = () => {
    if (!selectedAddress?.id) {
      showSuccessToast('Please add a delivery address before checkout', 'error');
      return;
    }
    if (method === 'cod') {
      if (!codAvailable) {
        showSuccessToast('COD is disabled for this order', 'error');
        return;
      }
      handleCod();
      return;
    }
    handleOnline();
  };

  if (!items.length) {
    return (
      <AppShell tab="cart">
        <section className="co-page">
          <PageHeader title={T.title} subtitle={T.emptyTitle} backTo="/cart" />
          <EmptyState
            title={T.emptyTitle}
            description={T.emptyText}
            action={
              <Button variant="primary" onClick={() => navigate('/cart')}>
                {T.backToCart}
              </Button>
            }
          />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell tab="cart">
      <section className="co-page">
        <PageHeader title={T.title} subtitle={T.itemsInOrder(itemUnits)} backTo="/cart" />

        <button
          type="button"
          className="co-card co-address"
          onClick={() =>
            navigate('/profile/addresses', {
              state: { returnTo: '/checkout', selectedAddress },
            })
          }
        >
          {selectedAddress ? (
            <>
              <div className="co-address__copy">
                <p className="co-kicker">
                  <MapPin size={14} aria-hidden />
                  {T.deliverTo}
                  <Badge tone="neutral" size="sm">
                    {selectedAddress.address_type_name || selectedAddress.address_type || 'Home'}
                  </Badge>
                </p>
                <p className="co-address__line">{formatAddress(selectedAddress)}</p>
              </div>
              <span className="am-btn am-btn--ghost am-btn--sm" aria-hidden>
                <span className="am-btn__label">{T.changeAddress}</span>
                <ChevronRight size={16} aria-hidden />
              </span>
            </>
          ) : (
            <>
              <div className="co-address__copy">
                <strong>{T.addAddress}</strong>
                <p className="co-address__hint">{T.addAddressHint}</p>
              </div>
              <span className="am-btn am-btn--primary am-btn--sm" aria-hidden>
                <Plus size={16} aria-hidden />
                <span className="am-btn__label">{T.add}</span>
              </span>
            </>
          )}
        </button>

        <div className="co-card">
          <h2>{T.itemsInOrder(itemUnits)}</h2>
          {items.map((item) => (
            <button
              key={item.id || item.variant_id}
              type="button"
              className="co-item"
              onClick={() => item.variant_id && navigate(`/products/${item.variant_id}`)}
            >
              <span className="co-item__thumb">
                {item.image ? (
                  <img src={item.image} alt="" loading="lazy" decoding="async" />
                ) : (
                  <Leaf size={20} aria-hidden />
                )}
              </span>
              <p className="co-item__name">
                {item.name}
                <small>{T.qty(item.quantity)}</small>
              </p>
              <strong className="co-item__price">
                {money(Number(item.price) * Number(item.quantity))}
              </strong>
            </button>
          ))}
        </div>

        <div className="co-card">
          <h2>{T.paymentTitle}</h2>
          <div className="co-pay" role="radiogroup" aria-label={T.paymentTitle}>
            <button
              type="button"
              role="radio"
              aria-checked={method === 'online'}
              className={`co-pay__option${method === 'online' ? ' is-on' : ''}`}
              onClick={() => setMethod('online')}
            >
              <strong>{T.payOnline}</strong>
              <small>{T.payOnlineHint}</small>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={method === 'cod'}
              className={`co-pay__option${method === 'cod' ? ' is-on' : ''}${codAvailable ? '' : ' is-off'}`}
              onClick={() => {
                if (!codAvailable) return;
                setMethod('cod');
              }}
              disabled={!codAvailable}
            >
              <strong>{T.cod}</strong>
              <small>{codAvailable ? T.codHint : T.codUnavailable}</small>
            </button>
          </div>
          {method === 'online' ? <p className="co-online-hint">{T.onlineHint}</p> : null}
        </div>

        <div className="co-card">
          <CouponApplyCard
            coupons={coupons}
            eligibleCoupons={eligibleCoupons}
            cartAmount={subtotal}
            loading={couponsLoading}
            applied={appliedCoupon}
            discount={feeBreakdown.discount || couponDiscount}
            payable={total}
            error={couponError}
            checkoutScope="product"
            onApply={applyCode}
            onRemove={removeCoupon}
          />
        </div>

        <div className="co-card">
          <button
            type="button"
            className="co-bill-toggle"
            onClick={() => setBillExpanded((open) => !open)}
            aria-expanded={billExpanded}
          >
            <h2>{T.billTitle}</h2>
            <span>{billExpanded ? T.hide : T.show}</span>
          </button>
          {feeLoading ? <p className="co-online-hint">{T.calculating}</p> : null}
          {feeError ? <p className="co-error">{feeError}</p> : null}
          {billExpanded ? (
            <>
              <p className="co-bill__row">
                <span>{T.itemTotal}</span>
                <span>{money(feeBreakdown.baseAmount)}</span>
              </p>
              {feeBreakdown.discount > 0 ? (
                <p className="co-bill__row is-success">
                  <span>{T.discount}</span>
                  <span>− {money(feeBreakdown.discount)}</span>
                </p>
              ) : null}
              {feeBreakdown.discount > 0 || feeBreakdown.itemsAfterDiscount !== feeBreakdown.baseAmount ? (
                <p className="co-bill__row">
                  <span>{T.subTotal}</span>
                  <span>{money(feeBreakdown.itemsAfterDiscount)}</span>
                </p>
              ) : null}
              <p className={`co-bill__row${feeBreakdown.freeDelivery ? ' is-success' : ''}`}>
                <span>
                  {feeBreakdown.freeDelivery
                    ? T.freeDelivery(formatRupee(feeBreakdown.freeDeliveryMinimum))
                    : T.delivery}
                </span>
                <span>{feeBreakdown.freeDelivery || !shipping ? T.free : money(shipping)}</span>
              </p>
              {method === 'cod' ? (
                <p className="co-bill__row">
                  <span>{T.codCharges}</span>
                  <span>{money(codFee)}</span>
                </p>
              ) : null}
              {platform > 0 ? (
                <p className="co-bill__row">
                  <span>{feeRateLabel(T.platformFee, feeBreakdown.platformRate)}</span>
                  <span>{money(platform)}</span>
                </p>
              ) : null}
              {gst > 0 ? (
                <p className="co-bill__row">
                  <span>{feeRateLabel(T.gst, feeBreakdown.gstRate)}</span>
                  <span>{money(gst)}</span>
                </p>
              ) : null}
            </>
          ) : null}
          <p className="co-bill__row is-total">
            <span>{T.grandTotal}</span>
            <span>{money(total)}</span>
          </p>
        </div>

        <ul className="co-trust">
          <li>{T.trustSecure}</li>
          <li>{T.trustDelivery}</li>
          <li>{T.trustGenuine}</li>
        </ul>

        {orderError ? <p className="co-error" role="alert">{orderError}</p> : null}

        <div className="co-sticky">
          <div className="co-sticky__meta">
            <strong>{money(total)}</strong>
            <small>
              {method === 'cod' ? T.payOnDelivery : T.payNow} · {T.itemsInOrder(itemUnits)}
            </small>
          </div>
          <Button
            variant="primary"
            disabled={busy || feeLoading || Boolean(feeError) || !selectedAddress}
            loading={busy}
            onClick={place}
          >
            {busy ? T.placing : method === 'cod' ? T.placeOrder : T.payNow}
          </Button>
        </div>

        <Disclaimer />
      </section>

      {verifying ? (
        <div className="co-verify" role="alertdialog" aria-live="assertive" aria-busy="true">
          <div className="co-verify__panel">
            <p>{T.verifyingLabel}</p>
            <h2>{T.verifyingTitle}</h2>
            <p>{T.verifyingText}</p>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
