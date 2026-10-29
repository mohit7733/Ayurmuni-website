import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CreditCard,
  Download,
  Headphones,
  Leaf,
  MapPin,
  Package,
  Phone,
  ReceiptText,
  RefreshCw,
  Share2,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  ActionStack,
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  InfoGrid,
  MetaChip,
  PersonCard,
  StatusPill,
  SummaryRows,
  Timeline,
} from '../components/detail/Detail';
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
import {
  getOrderReturns,
  getReturnStatusMeta,
  normalizeReturnList,
  sortReturnsNewestFirst,
} from '../services/returnService';
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
  RETURN_LIST_STATUSES,
  SUPPORT_EMAIL,
  TRACKING_ALLOWED,
} from '../utils/orderDetailUtils';
import { Button, Chip, Modal, Textarea } from '../components/ui';
import { ORDERS_COPY as T, orderStatusLabel } from '../content/orders';
import '../design/pages/orders.css';
import '../design/pages/returns.css';

export default function OrderDetails() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { variantQuantities, syncCartQuantity } = useCart();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localReviews, setLocalReviews] = useState({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [orderReturns, setOrderReturns] = useState([]);
  const [returnsChecked, setReturnsChecked] = useState(false);
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
  const canListReturns = RETURN_LIST_STATUSES.includes(status);
  // One return request per order: once raised, its status replaces the "Return" action.
  const latestReturn = orderReturns[0] ?? null;
  const canReturn = RETURN_ALLOWED.includes(status) && returnsChecked && orderReturns.length === 0;
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

  useEffect(() => {
    if (!order?.id || !canListReturns) return undefined;
    let active = true;
    getOrderReturns(order.id)
      .then((res) => {
        if (active) setOrderReturns(sortReturnsNewestFirst(normalizeReturnList(res)));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReturnsChecked(true);
      });
    return () => {
      active = false;
    };
  }, [order?.id, canListReturns, location.key]);

  const openReturnDetails = (ret) =>
    navigate(`/profile/returns/${ret.id}`, { state: { returnRequest: ret.raw, order } });

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

  const trackingTimeline = trackingSteps.map((step) => ({
    key: step.key,
    title: step.label,
    text: step.subtitle,
    time: step.date,
    state:
      step.key === 'cancelled' || step.key === 'returned'
        ? 'failed'
        : step.active
          ? 'current'
          : step.completed
            ? 'done'
            : 'pending',
  }));
  const itemCount = items.reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0);
  const words = (value) => (value ? String(value).replace(/_/g, ' ') : '');
  const method = (value) => (/^(upi|cod|emi|nb)$/i.test(String(value || '')) ? String(value).toUpperCase() : words(value));
  const paymentMethod = method(order?.payment_method || order?.payment_type);

  return (
    <AppShell tab="profile">
      <DetailPage>
        <DetailTop
          backTo="/profile/orders"
          backLabel="My orders"
          actions={
            order ? (
              <Button variant="ghost" size="sm" leadingIcon={<Share2 size={14} />} onClick={handleShare}>
                {T.shareOrder}
              </Button>
            ) : null
          }
        />

        {loading ? (
          <DetailSkeleton media={false} label={T.detailLoading} />
        ) : !order ? (
          <DetailEmpty
            icon={Package}
            title={T.notFoundTitle}
            text={T.notFoundText}
            action={<Button onClick={() => navigate('/profile/orders')}>{T.backToOrders}</Button>}
          />
        ) : (
          <>
            <DetailHero
              variant="band"
              titleId="order-title"
              eyebrow={T.detailTitle}
              title={`#${formatOrderId(orderCode)}`}
              lede={order?.created_at ? `Placed on ${formatOrderDateTime(order.created_at)}` : undefined}
              chips={
                <>
                  <MetaChip icon={Package} tone="gold">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </MetaChip>
                  {paymentMethod ? <MetaChip icon={CreditCard}>{paymentMethod}</MetaChip> : null}
                  {eta ? <MetaChip icon={Truck}>{T.arrivingBy(eta)}</MetaChip> : null}
                </>
              }
              aside={
                <>
                  <StatusPill status={status}>{orderStatusLabel(status)}</StatusPill>
                  <div className="dx-figure">
                    <small>{T.total}</small>
                    <strong>{formatRupee(order.total_amount ?? order.payable_amount)}</strong>
                  </div>
                </>
              }
            >
              <div className="dx-actions dx-actions--row">
                <Button
                  variant="accent"
                  size="sm"
                  leadingIcon={<ShoppingBag size={14} />}
                  loading={reorderLoading}
                  onClick={handleReorder}
                >
                  {T.reorder}
                </Button>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<RefreshCw size={14} />}
                    onClick={() => navigate(`/profile/orders/${order.id}/return`, { state: { order } })}
                  >
                    {T.returnOrder}
                  </Button>
                ) : null}
                {latestReturn ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<RefreshCw size={14} />}
                    onClick={() => openReturnDetails(latestReturn)}
                  >
                    {`${T.returnOrder} · ${getReturnStatusMeta(latestReturn.status).label}`}
                  </Button>
                ) : null}
                {canCancel ? (
                  <Button variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>
                    {T.cancelOrder}
                  </Button>
                ) : null}
              </div>
            </DetailHero>

            <DetailLayout
              aside={
                <>
                  <DetailCard id="order-bill" title={T.bill} icon={ReceiptText}>
                    <SummaryRows
                      rows={[
                        { label: T.itemsTotal, value: formatRupee(payment.itemsTotal) },
                        {
                          label: T.discount,
                          value: payment.discount > 0 ? `- ${formatRupee(payment.discount)}` : '',
                          tone: 'success',
                        },
                        { label: T.giftWrap, value: payment.giftWrap > 0 ? formatRupee(payment.giftWrap) : '' },
                        {
                          label: T.platformFee,
                          value: payment.platformFee > 0 ? formatRupee(payment.platformFee) : '',
                        },
                        { label: T.gst, value: payment.gst > 0 ? formatRupee(payment.gst) : '' },
                        { label: T.shipping, value: payment.shipping > 0 ? formatRupee(payment.shipping) : T.free },
                        { label: T.cod, value: payment.cod > 0 ? formatRupee(payment.cod) : '' },
                      ]}
                      total={{ label: T.total, value: formatRupee(order.total_amount ?? order.payable_amount) }}
                    />
                  </DetailCard>

                  {address ? (
                    <DetailCard id="order-address" title={T.delivery} icon={MapPin}>
                      <p className="dx-prose">{address}</p>
                    </DetailCard>
                  ) : null}

                  <DetailCard id="order-info" title={T.orderInfo} icon={Package}>
                    <InfoGrid
                      items={[
                        { label: T.placedOn, value: formatOrderDateTime(order.created_at) },
                        { label: T.paymentMethod, value: paymentMethod },
                        { label: T.paymentStatus, value: words(order.payment_status) },
                        { label: T.shippingMethod, value: words(order.shipping_method) },
                      ]}
                    />
                  </DetailCard>

                  {refund ? (
                    <DetailCard id="order-refund" title={T.refund} icon={RefreshCw} tone="accent">
                      <InfoGrid
                        columns={2}
                        items={[
                          { label: T.refundStatus, value: words(refund.status) },
                          { label: T.refundAmount, value: refund.amount != null ? formatRupee(refund.amount) : '' },
                          { label: T.refundMethod, value: words(refund.method), wide: true },
                        ]}
                      />
                    </DetailCard>
                  ) : null}

                  <DetailCard id="order-help" title="Need help with this order?" icon={Headphones}>
                    <ActionStack>
                      <Button
                        variant="secondary"
                        leadingIcon={<Headphones size={16} />}
                        onClick={() => contactSupport(`Help with order ${formatOrderId(orderCode)}`)}
                      >
                        {T.contactSupport}
                      </Button>
                    </ActionStack>
                  </DetailCard>
                </>
              }
            >
              <DetailCard
                id="order-items"
                title={T.itemsTitle}
                icon={ShoppingBag}
                meta={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
              >
                <ul className="dx-items">
                  {items.map((item) => {
                    const variantId = resolveOrderItemVariantId(item);
                    const local = localReviews[variantId];
                    const rated = isOrderItemRated(item) || Boolean(local);
                    const image = resolveImageUrl(item?.variant || item);
                    const name = item?.variant?.variant_title || item?.product_name || item?.name;
                    const unit = Number(item.selling_price ?? item.price ?? item.unit_price) || 0;
                    const qty = Number(item.quantity) || 1;
                    const lineTotal = Number(item.total_price ?? item.subtotal) || unit * qty;
                    const rating = local?.rating || item?.review?.rating;
                    return (
                      <li key={item.id || item.variant_id} className="dx-item">
                        <span className="dx-item__media">
                          {image ? (
                            <img src={image} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <Leaf size={20} aria-hidden />
                          )}
                        </span>
                        <span className="dx-item__copy">
                          <strong>{name}</strong>
                          <small>{T.qty(qty)}</small>
                          {rated ? (
                            <small className="dx-item__rated">
                              <Star size={12} aria-hidden />
                              {rating ? T.youRated(rating) : T.reviewSubmitted}
                            </small>
                          ) : null}
                        </span>
                        <span className="dx-item__end">
                          <strong>{formatRupee(lineTotal)}</strong>
                          {unit * qty > lineTotal ? <s className="dx-item__was">{formatRupee(unit * qty)}</s> : null}
                          {!rated && variantId && canReview ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              leadingIcon={<Star size={14} aria-hidden />}
                              onClick={() => openProductReview(item)}
                            >
                              {T.rate}
                            </Button>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </DetailCard>

              {orderReturns.length > 0 ? (
                <DetailCard
                  id="order-returns"
                  title={`Return requests (${orderReturns.length})`}
                  icon={RefreshCw}
                >
                  {orderReturns.map((ret) => {
                    const retMeta = getReturnStatusMeta(ret.status);
                    const qty = ret.items.reduce((sum, line) => sum + line.quantity, 0);
                    return (
                      <button
                        key={ret.id}
                        type="button"
                        className="rt-order-return"
                        onClick={() => openReturnDetails(ret)}
                      >
                        <span>
                          <strong>
                            {qty} item{qty === 1 ? '' : 's'} · {formatOrderDateTime(ret.createdAt)}
                          </strong>
                          <small>{ret.reason || 'Return request'}</small>
                        </span>
                        <StatusPill status={ret.status} tone={retMeta.tone === 'neutral' ? undefined : retMeta.tone}>
                          {retMeta.label}
                        </StatusPill>
                      </button>
                    );
                  })}
                </DetailCard>
              ) : null}

              <DetailCard
                id="order-track"
                title={T.trackOrder}
                icon={Truck}
                action={
                  canTrackLive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={trackingLoading}
                      leadingIcon={<RefreshCw size={14} />}
                      onClick={refreshTracking}
                    >
                      {T.refresh}
                    </Button>
                  ) : null
                }
              >
                {eta || currentLocation ? (
                  <div className="dx-link dx-link--static">
                    <span className="dx-link__icon" aria-hidden>
                      <MapPin size={18} />
                    </span>
                    <span className="dx-link__copy">
                      {eta ? <strong>{T.arrivingBy(eta)}</strong> : <strong>{currentLocation}</strong>}
                      {eta && currentLocation ? <span>{currentLocation}</span> : null}
                    </span>
                  </div>
                ) : null}
                <Timeline items={trackingTimeline} />
                {liveTracking?.trackingNumber ? (
                  <p className="dx-note">
                    {liveTracking.carrier ? `${liveTracking.carrier} · ` : ''}
                    AWB {liveTracking.trackingNumber}
                    {liveTracking.lastUpdated ? ` · Updated ${liveTracking.lastUpdated}` : ''}
                  </p>
                ) : null}
                {agent ? (
                  <PersonCard
                    fallback={<Truck size={18} />}
                    name={agent.name}
                    role="Delivery partner"
                    meta={agent.phone}
                    action={
                      agent.phone ? (
                        <Button
                          href={`tel:${agent.phone}`}
                          variant="secondary"
                          size="sm"
                          leadingIcon={<Phone size={14} />}
                        >
                          {T.call}
                        </Button>
                      ) : null
                    }
                  />
                ) : null}
              </DetailCard>
            </DetailLayout>
          </>
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

      </DetailPage>
    </AppShell>
  );
}
