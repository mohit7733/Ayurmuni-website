import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Download,
  Headphones,
  Leaf,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Share2,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { formatAddress } from '../cart/mapCart';
import { formatRupee, resolveImageUrl } from '../home/catalog';
import { useCart } from '../hooks/useCart';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import {
  cancelOrder,
  downloadInvoiceFile,
  extractLiveTracking,
  extractOrderDetail,
  getOrderById,
  pollOrderTracking,
} from '../services/orderService';
import { formatOrderId } from '../utils/formatDisplayId';
import { consumePendingProductReview } from '../utils/pendingReviews';
import { isOrderItemRated, resolveOrderItemVariantId } from '../utils/reviewUtils';
import { saveBrowserFile } from '../utils/prescriptionDetailUtils';
import { shareOrder } from '../utils/shareUtils';
import {
  buildOrderTrackingSteps,
  buildPaymentRows,
  CANCEL_ALLOWED,
  CANCELLATION_REASONS,
  formatDeliveryAddress,
  formatOrderDateTime,
  getDeliveryAgent,
  getRefundInfo,
  INVOICE_ALLOWED,
  RETURN_ALLOWED,
  SUPPORT_EMAIL,
  TRACKING_ALLOWED,
} from '../utils/orderDetailUtils';
import {
  Badge,
  Button,
  Chip,
  Disclaimer,
  EmptyState,
  Modal,
  Skeleton,
  SkeletonText,
  Textarea,
} from '../components/ui';
import {
  ORDERS_COPY as T,
  orderStatusLabel,
  orderStatusTone,
} from '../content/orders';
import '../design/pages/orders.css';

export default function OrderDetails() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { variantQuantities, syncCartQuantity } = useCart();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localReviews, setLocalReviews] = useState({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [liveTracking, setLiveTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    const res = await getOrderById(orderId);
    setOrder(extractOrderDetail(res));
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view this order'))) return;
      loadOrder();
    })();
  }, [orderId, location.key, loadOrder]);

  useEffect(() => {
    const pending = consumePendingProductReview();
    if (!pending?.variantId) return;
    if (pending.orderId && String(pending.orderId) !== String(order?.id ?? orderId)) return;
    setLocalReviews((prev) => ({
      ...prev,
      [pending.variantId]: pending,
    }));
  }, [order?.id, orderId, location.key]);

  const items = Array.isArray(order?.items) ? order.items : [];
  const addressObj = order?.delivery_address || order?.address || order?.shipping_address;
  const address = formatDeliveryAddress(addressObj) || formatAddress(addressObj);
  const status = String(order?.order_status || order?.status || '').toLowerCase();
  const canReview = status === 'delivered' || status === 'completed';
  const canCancel = CANCEL_ALLOWED.includes(status);
  const canInvoice = INVOICE_ALLOWED.includes(status);
  const canReturn = RETURN_ALLOWED.includes(status);
  const canTrackLive = TRACKING_ALLOWED.includes(status);
  const orderCode = order?.order_code || order?.order_number || orderId;
  const trackingSteps = useMemo(() => buildOrderTrackingSteps(order), [order]);
  const payment = useMemo(() => buildPaymentRows(order), [order]);
  const refund = useMemo(() => getRefundInfo(order), [order]);
  const agent = useMemo(() => getDeliveryAgent(order, liveTracking), [order, liveTracking]);
  const eta =
    liveTracking?.eta ||
    order?.estimated_delivery_time ||
    order?.delivery_eta ||
    order?.promised_delivery_date ||
    '';
  const currentLocation =
    liveTracking?.currentLocation || order?.current_location || order?.tracking_location || '';
  const finalReason = cancelReason === 'Other' ? customReason.trim() : cancelReason;

  const refreshTracking = useCallback(async () => {
    const id = order?.id || orderId;
    if (!id || !canTrackLive) return;
    setTrackingLoading(true);
    const res = await pollOrderTracking(id);
    if (res?.success !== false) {
      setLiveTracking(extractLiveTracking(res));
    }
    setTrackingLoading(false);
  }, [order?.id, orderId, canTrackLive]);

  useEffect(() => {
    if (!order?.id || !canTrackLive) return undefined;
    refreshTracking();
    const interval = setInterval(refreshTracking, 60_000);
    return () => clearInterval(interval);
  }, [order?.id, canTrackLive, refreshTracking]);

  const openProductReview = (item) => {
    const variantId = resolveOrderItemVariantId(item);
    if (!variantId || !order?.id) return;
    if (isOrderItemRated(item) || localReviews[variantId]) return;
    navigate('/share-experience', {
      state: {
        entityType: 'product',
        entityName: item?.variant?.variant_title || item?.product_name || item?.name || 'Product',
        entitySubtitle: `Order ${formatOrderId(order?.order_code ?? order?.id)}`,
        variantId,
        orderId: String(order.id),
        initialRating: 0,
      },
    });
  };

  const handleCancel = async () => {
    if (!order?.id || cancelLoading || !finalReason) return;
    setCancelLoading(true);
    const res = await cancelOrder(order.id, { cancellation_reason: finalReason });
    setCancelLoading(false);
    if (res?.success === false) {
      showSuccessToast(res?.message || 'Unable to cancel this order', 'error');
      return;
    }
    const updated = res?.data?.data ?? res?.data ?? null;
    setOrder((prev) => ({
      ...prev,
      ...(updated && typeof updated === 'object' && !Array.isArray(updated) ? updated : {}),
      order_status: updated?.order_status || 'cancelled',
    }));
    setCancelOpen(false);
    setCancelReason('');
    setCustomReason('');
    showSuccessToast('Order cancelled', 'success');
  };

  const handleInvoice = async () => {
    if (!order?.id || invoiceLoading) return;
    setInvoiceLoading(true);
    try {
      const response = await downloadInvoiceFile(order.id);
      if (!response?.success || !response.data) throw new Error('Invoice PDF data not found');
      const fileName = `Invoice_${formatOrderId(order?.order_code ?? order.id).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
      saveBrowserFile(new Blob([response.data], { type: 'application/pdf' }), fileName);
      showSuccessToast('Invoice downloaded', 'success');
    } catch (err) {
      showSuccessToast(err?.message || 'Invoice download failed', 'error');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleShare = async () => {
    const result = await shareOrder(order || { id: orderId, order_code: orderCode });
    if (result.success && result.method === 'clipboard') {
      showSuccessToast('Order link copied', 'success');
    } else if (!result.success && !result.cancelled) {
      showSuccessToast('Could not share order', 'error');
    }
  };

  const handleReorder = async () => {
    if (reorderLoading) return;
    const lines = items
      .map((item) => ({
        variantId: resolveOrderItemVariantId(item),
        quantity: Math.max(1, Number(item?.quantity) || 1),
      }))
      .filter((row) => row.variantId);
    if (!lines.length) {
      showSuccessToast('No items available to reorder', 'error');
      return;
    }
    if (!(await requireAuth('Please login to reorder'))) return;
    setReorderLoading(true);
    let added = 0;
    for (const line of lines) {
      const nextQty = (Number(variantQuantities[line.variantId]) || 0) + line.quantity;
      const ok = await syncCartQuantity({ variant_id: line.variantId, id: line.variantId }, nextQty);
      if (ok) added += 1;
    }
    setReorderLoading(false);
    if (added === 0) {
      showSuccessToast('Could not add items to cart', 'error');
      return;
    }
    showSuccessToast(added === lines.length ? 'Items added to cart' : 'Some items were added to cart', 'success');
    navigate('/cart');
  };

  const contactSupport = (subject) => {
    const body = `Order ${formatOrderId(orderCode)}\nStatus: ${orderStatusLabel(status)}`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <AppShell tab="profile">
      <section className="or-page">
        <PageHeader
          title={T.detailTitle}
          subtitle={orderCode ? `#${formatOrderId(orderCode)}` : undefined}
          backTo="/profile/orders"
        />

        {loading ? (
          <div className="or-skel" aria-busy="true" aria-label={T.detailLoading}>
            <Skeleton style={{ height: 120, borderRadius: 'var(--am-radius-lg)' }} />
            <SkeletonText lines={4} />
          </div>
        ) : !order ? (
          <EmptyState
            icon={<Package size={28} />}
            title={T.notFoundTitle}
            description={T.notFoundText}
            action={
              <Button variant="primary" onClick={() => navigate('/profile/orders')}>
                {T.backToOrders}
              </Button>
            }
          />
        ) : (
          <div className="or-detail">
            <div className="or-detail__main">
              <div className="or-card or-hero-actions">
                <div className="or-status-block or-status-block--inline">
                  <p className="or-status-block__label">{T.status}</p>
                  <Badge tone={orderStatusTone(status)} size="md">
                    {orderStatusLabel(status)}
                  </Badge>
                  {order?.created_at ? (
                    <p className="or-row__meta">{formatOrderDateTime(order.created_at)}</p>
                  ) : null}
                </div>
                <div className="or-action-row">
                  {canInvoice ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={invoiceLoading}
                      leadingIcon={<Download size={14} />}
                      onClick={handleInvoice}
                    >
                      {T.invoice}
                    </Button>
                  ) : null}
                  {canReturn ? (
                    <Button variant="secondary" size="sm" leadingIcon={<RefreshCw size={14} />} onClick={() => setReturnOpen(true)}>
                      {T.returnOrder}
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
                      {T.cancelOrder}
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" leadingIcon={<Share2 size={14} />} onClick={handleShare}>
                    {T.shareOrder}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Headphones size={14} />}
                    onClick={() => contactSupport(`Help with order ${formatOrderId(orderCode)}`)}
                  >
                    {T.contactSupport}
                  </Button>
                </div>
              </div>

              <div className="or-card">
                <div className="or-section-head">
                  <h2>{T.trackOrder}</h2>
                  {canTrackLive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={trackingLoading}
                      leadingIcon={<RefreshCw size={14} />}
                      onClick={refreshTracking}
                    >
                      {T.refresh}
                    </Button>
                  ) : null}
                </div>
                <ol className="or-track">
                  {trackingSteps.map((step) => (
                    <li
                      key={step.key}
                      className={`or-track__step${step.completed ? ' is-done' : ''}${step.active ? ' is-active' : ''}${
                        step.key === 'cancelled' || step.key === 'returned' ? ' is-cancelled' : ''
                      }`}
                    >
                      <span className="or-track__dot" aria-hidden />
                      <div>
                        <strong>{step.label}</strong>
                        {step.subtitle ? <small>{step.subtitle}</small> : null}
                        {step.date ? <small>{step.date}</small> : null}
                      </div>
                    </li>
                  ))}
                </ol>
                {liveTracking?.trackingNumber ? (
                  <p className="or-row__meta">
                    {liveTracking.carrier ? `${liveTracking.carrier} · ` : ''}
                    AWB {liveTracking.trackingNumber}
                    {liveTracking.lastUpdated ? ` · Updated ${liveTracking.lastUpdated}` : ''}
                  </p>
                ) : null}
                {eta || currentLocation ? (
                  <div className="or-eta">
                    <MapPin size={16} aria-hidden />
                    <div>
                      {eta ? <strong>{T.arrivingBy(eta)}</strong> : null}
                      {currentLocation ? <small>{currentLocation}</small> : null}
                    </div>
                  </div>
                ) : null}
                {agent ? (
                  <div className="or-agent">
                    <Truck size={18} aria-hidden />
                    <div>
                      <strong>{agent.name}</strong>
                      {agent.phone ? <small>{agent.phone}</small> : null}
                    </div>
                    {agent.phone ? (
                      <Button href={`tel:${agent.phone}`} variant="secondary" size="sm" leadingIcon={<Phone size={14} />}>
                        {T.call}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="or-card">
                <h2>{T.itemsTitle}</h2>
                {items.map((item) => {
                  const variantId = resolveOrderItemVariantId(item);
                  const local = localReviews[variantId];
                  const rated = isOrderItemRated(item) || Boolean(local);
                  const image = resolveImageUrl(item?.variant || item);
                  const name = item?.variant?.variant_title || item?.product_name || item?.name;
                  const unitPrice = formatRupee(item.selling_price ?? item.price ?? item.unit_price);
                  return (
                    <div key={item.id || item.variant_id} className="or-item">
                      <span className="or-item__thumb">
                        {image ? (
                          <img src={image} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <Leaf size={20} aria-hidden />
                        )}
                      </span>
                      <p className="or-item__name">
                        {name}
                        <small>
                          {T.qty(item.quantity)} · {unitPrice}
                        </small>
                        {rated ? (
                          <small>
                            {local?.rating || item?.review?.rating
                              ? T.youRated(local?.rating || item?.review?.rating)
                              : T.reviewSubmitted}
                          </small>
                        ) : null}
                      </p>
                      {!rated && variantId && canReview ? (
                        <Button
                          className="or-item__action"
                          variant="secondary"
                          size="sm"
                          leadingIcon={<Star size={14} aria-hidden />}
                          onClick={() => openProductReview(item)}
                        >
                          {T.rate}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
                <Button
                  variant="secondary"
                  leadingIcon={<ShoppingBag size={16} />}
                  loading={reorderLoading}
                  onClick={handleReorder}
                >
                  {T.reorder}
                </Button>
              </div>
            </div>

            <aside className="or-aside">
              {address ? (
                <div className="or-card or-delivery">
                  <h2>
                    <MapPin size={16} aria-hidden />
                    {T.delivery}
                  </h2>
                  <p>{address}</p>
                </div>
              ) : null}

              <div className="or-card">
                <h2>{T.orderInfo}</h2>
                {[
                  [T.placedOn, formatOrderDateTime(order.created_at)],
                  [T.paymentMethod, order.payment_method || order.payment_type],
                  [T.paymentStatus, order.payment_status],
                  [T.shippingMethod, order.shipping_method],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <p key={label} className="or-info-row">
                      <span>{label}</span>
                      <strong>{String(value).replace(/_/g, ' ')}</strong>
                    </p>
                  ))}
              </div>

              {refund ? (
                <div className="or-card">
                  <h2>{T.refund}</h2>
                  {refund.status ? (
                    <p className="or-info-row">
                      <span>{T.refundStatus}</span>
                      <strong>{String(refund.status).replace(/_/g, ' ')}</strong>
                    </p>
                  ) : null}
                  {refund.amount != null ? (
                    <p className="or-info-row">
                      <span>{T.refundAmount}</span>
                      <strong>{formatRupee(refund.amount)}</strong>
                    </p>
                  ) : null}
                  {refund.method ? (
                    <p className="or-info-row">
                      <span>{T.refundMethod}</span>
                      <strong>{String(refund.method).replace(/_/g, ' ')}</strong>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="or-card">
                <h2>{T.bill}</h2>
                <p className="or-info-row">
                  <span>{T.itemsTotal}</span>
                  <strong>{formatRupee(payment.itemsTotal)}</strong>
                </p>
                {payment.discount > 0 ? (
                  <p className="or-info-row">
                    <span>{T.discount}</span>
                    <strong>- {formatRupee(payment.discount)}</strong>
                  </p>
                ) : null}
                {payment.giftWrap > 0 ? (
                  <p className="or-info-row">
                    <span>{T.giftWrap}</span>
                    <strong>{formatRupee(payment.giftWrap)}</strong>
                  </p>
                ) : null}
                {payment.platformFee > 0 ? (
                  <p className="or-info-row">
                    <span>{T.platformFee}</span>
                    <strong>{formatRupee(payment.platformFee)}</strong>
                  </p>
                ) : null}
                {payment.gst > 0 ? (
                  <p className="or-info-row">
                    <span>{T.gst}</span>
                    <strong>{formatRupee(payment.gst)}</strong>
                  </p>
                ) : null}
                <p className="or-info-row">
                  <span>{T.shipping}</span>
                  <strong>{payment.shipping > 0 ? formatRupee(payment.shipping) : T.free}</strong>
                </p>
                {payment.cod > 0 ? (
                  <p className="or-info-row">
                    <span>{T.cod}</span>
                    <strong>{formatRupee(payment.cod)}</strong>
                  </p>
                ) : null}
                <p className="or-total">
                  <span>{T.total}</span>
                  <span>{formatRupee(order.total_amount ?? order.payable_amount)}</span>
                </p>
              </div>
            </aside>
          </div>
        )}

        <Modal
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          title={T.cancelTitle}
          description={T.cancelText}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCancelOpen(false)}>
                {T.keepOrder}
              </Button>
              <Button variant="danger" loading={cancelLoading} disabled={!finalReason} onClick={handleCancel}>
                {T.confirmCancel}
              </Button>
            </>
          }
        >
          <div className="or-reason-list">
            {CANCELLATION_REASONS.map((reason) => (
              <Chip key={reason} selected={cancelReason === reason} onClick={() => setCancelReason(reason)}>
                {reason}
              </Chip>
            ))}
          </div>
          {cancelReason === 'Other' ? (
            <Textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={T.otherReason}
              rows={3}
            />
          ) : null}
        </Modal>

        <Modal
          open={returnOpen}
          onClose={() => setReturnOpen(false)}
          title={T.returnTitle}
          description={T.returnText}
          footer={
            <>
              <Button variant="secondary" onClick={() => setReturnOpen(false)}>
                {T.keepOrder}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setReturnOpen(false);
                  contactSupport(`Return request for order ${formatOrderId(orderCode)}`);
                }}
              >
                {T.contactSupport}
              </Button>
            </>
          }
        />

        <Disclaimer />
      </section>
    </AppShell>
  );
}
