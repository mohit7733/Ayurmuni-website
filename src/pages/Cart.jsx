import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Minus, Plus, RefreshCw, Search } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { formatRupee } from '../home/catalog';
import { useCart } from '../hooks/useCart';
import { buildCartSections, CHECKOUT_KEY } from '../cart/mapCart';
import { getAddQtyBlockMessage, isPrescriptionRequired } from '../product/stock';
import { getOrderFeeQuote } from '../services/orderService';
import { getStatusLabel, isPrescriptionApproved, isPrescriptionRejected } from '../services/prescriptionService';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import {
  Badge,
  Button,
  Disclaimer,
  EmptyState,
  IconButton,
  Modal,
  Skeleton,
  SkeletonText,
  Tabs,
} from '../components/ui';
import { CART_COPY as T } from '../content/cart';
import '../design/pages/cart.css';

const rxTone = (item) => {
  if (isPrescriptionApproved(item)) return { label: T.rxApproved, tone: 'success' };
  if (isPrescriptionRejected(item)) return { label: T.rxRejected, tone: 'danger' };
  return { label: getStatusLabel(item) || T.rxWaiting, tone: 'warning' };
};

const formatRxDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Cart() {
  const navigate = useNavigate();
  const { cartData, loading, fetchCart, syncCartQuantity, addingVariantId } = useCart();
  const [tab, setTab] = useState('cart');
  const [selected, setSelected] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [fees, setFees] = useState(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [qtyConfirm, setQtyConfirm] = useState(null);
  const doctorQtyRef = useRef({});

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view your cart'))) return;
      fetchCart();
    })();
  }, [fetchCart]);

  const sections = useMemo(() => buildCartSections(cartData), [cartData]);
  const cartSection = sections.find((s) => s.type === 'cart');
  const prescribedSection = sections.find((s) => s.type === 'prescribed');
  const cartCount = cartSection?.items.length ?? 0;
  const prescribedCount = prescribedSection?.items.length ?? 0;
  const visible = (tab === 'prescribed' ? prescribedSection : cartSection)?.items || [];
  const outOfStockCount = visible.filter((item) => item._isOutOfStock).length;

  const idKey = sections.flatMap((s) => s.items.map((item) => item.id)).join(',');

  useEffect(() => {
    if (!sections.length) {
      setSelected([]);
      return;
    }
    if (prescribedSection?.items?.length && !cartSection?.items?.length) {
      setTab('prescribed');
    }
    const selectable = sections
      .flatMap((s) => s.items)
      .filter((item) => !item._isOutOfStock)
      .map((item) => item.id);
    setSelected(selectable);
  }, [idKey, sections, cartSection?.items?.length, prescribedSection?.items?.length]);

  useEffect(() => {
    if (tab === 'cart' && !cartCount && prescribedCount) setTab('prescribed');
    if (tab === 'prescribed' && !prescribedCount && cartCount) setTab('cart');
  }, [tab, cartCount, prescribedCount]);

  const selectedProducts = visible.filter(
    (item) => selected.includes(item.id) && !item._isOutOfStock,
  );
  const subtotal = selectedProducts.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity),
    0,
  );
  const cartItemIds = selectedProducts
    .map((item) => String(item.cart_item_id || item.id || '').trim())
    .filter(Boolean);

  useEffect(() => {
    if (!cartItemIds.length) {
      setFees(null);
      return undefined;
    }
    let alive = true;
    setFeeLoading(true);
    (async () => {
      try {
        const res = await getOrderFeeQuote({ cart_item_ids: cartItemIds });
        if (!alive) return;
        const data = res?.data ?? res;
        const summary = data?.summary ?? {};
        setFees({
          shipping: Number(summary.shipping_charges ?? summary.delivery_charge ?? 0) || 0,
          gst: Number(summary.gst ?? summary.product_gst ?? 0) || 0,
          platform: Number(summary.platform_fee ?? 0) || 0,
          total: Number(summary.total ?? summary.payable ?? 0) || 0,
        });
      } catch {
        if (alive) setFees(null);
      } finally {
        if (alive) setFeeLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cartItemIds.join(',')]);

  const shipping = Number(fees?.shipping) || 0;
  const gst = Number(fees?.gst) || 0;
  const platform = Number(fees?.platform) || 0;
  const payable = fees ? Math.round(subtotal + shipping + gst + platform) : Math.round(subtotal);

  const rxGroups = useMemo(() => {
    if (tab !== 'prescribed') return [];
    const groups = new Map();
    visible.forEach((item) => {
      const key = String(item.rx_group_id || item.id);
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
        return;
      }
      groups.set(key, { meta: item.rx_group || item, items: [item] });
    });
    return [...groups.values()];
  }, [tab, visible]);

  const toggle = (id, disabled) => {
    if (disabled) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    const ids = visible.filter((item) => !item._isOutOfStock).map((item) => item.id);
    const allOn = ids.length > 0 && ids.every((id) => selected.includes(id));
    setSelected(allOn ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    doctorQtyRef.current = {};
    await fetchCart();
    setRefreshing(false);
  };

  const changeQty = async (item, action) => {
    const isPrescribed = item.source === 'prescribed';
    const rxRequired = isPrescriptionRequired(item) || item.prescription_required;
    const oldQty = Math.max(0, Number(item.quantity) || 0);

    if (isPrescribed && action === 'remove') return;
    if (isPrescribed && action === 'minus' && oldQty <= 1) return;

    if (isPrescribed && rxRequired && action === 'plus') {
      showSuccessToast('This prescribed medicine cannot be increased from cart.', 'error');
      return;
    }

    if (!isPrescribed && rxRequired && action === 'plus') {
      showSuccessToast(
        'This medicine needs a valid prescription before more can be added.',
        'error',
      );
      navigate(
        `/medicines/prescription?variant=${encodeURIComponent(item.variant_id)}&name=${encodeURIComponent(
          item.name || '',
        )}`,
        { state: { variantIds: [item.variant_id], productName: item.name } },
      );
      return;
    }

    const nextQty = action === 'minus' ? Math.max(isPrescribed ? 1 : 0, oldQty - 1) : oldQty + 1;
    const stockMsg = getAddQtyBlockMessage(item, nextQty, { cartLine: true });
    if (stockMsg) {
      showSuccessToast(stockMsg, 'error');
      return;
    }

    if (isPrescribed && action === 'plus') {
      const doctorQty =
        doctorQtyRef.current[item.id] ??
        (Number(item.prescribed_quantity) || oldQty);
      doctorQtyRef.current[item.id] = doctorQty;
      setQtyConfirm({
        item,
        oldQty,
        nextQty,
        doctorQty,
      });
      return;
    }

    await syncCartQuantity(item, nextQty);
  };

  const confirmPrescribedBump = async () => {
    if (!qtyConfirm) return;
    await syncCartQuantity(qtyConfirm.item, qtyConfirm.nextQty);
    setQtyConfirm(null);
  };

  const goCheckout = () => {
    const checkoutProducts = selectedProducts.filter((item) => !item._isOutOfStock);
    if (!checkoutProducts.length) {
      showSuccessToast('Out of stock. Remove it and continue with in-stock items.', 'error');
      return;
    }
    const overStock = checkoutProducts.find((item) =>
      Boolean(getAddQtyBlockMessage(item, Number(item.quantity) || 0, { cartLine: true })),
    );
    if (overStock) {
      showSuccessToast(
        getAddQtyBlockMessage(overStock, Number(overStock.quantity) || 0, { cartLine: true }) ||
          'Some items are out of stock. Please update quantities.',
        'error',
      );
      return;
    }
    sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(checkoutProducts));
    navigate('/checkout', { state: { selectedProducts: checkoutProducts } });
  };

  const headerActions = (
    <>
      <IconButton label={T.search} variant="soft" onClick={() => navigate('/search')}>
        <Search size={18} aria-hidden />
      </IconButton>
      <IconButton
        label={refreshing || loading ? T.refreshing : T.refresh}
        variant="soft"
        disabled={refreshing || loading}
        onClick={onRefresh}
      >
        <RefreshCw size={18} aria-hidden className={refreshing || loading ? 'ct-spin' : undefined} />
      </IconButton>
    </>
  );

  const renderLine = (item) => {
    const adding = addingVariantId === item.variant_id;
    const isPrescribed = item.source === 'prescribed';
    return (
      <article key={item.id} className={`ct-line${item._isOutOfStock ? ' is-oos' : ''}`}>
        <input
          type="checkbox"
          className="ct-line__check"
          checked={selected.includes(item.id)}
          disabled={item._isOutOfStock}
          aria-label={T.selectItem}
          onChange={() => toggle(item.id, item._isOutOfStock)}
        />
        <button
          type="button"
          className="ct-line__thumb"
          onClick={() => navigate(`/products/${item.variant_id}`)}
        >
          {item.image ? (
            <img src={item.image} alt="" loading="lazy" decoding="async" />
          ) : (
            <span aria-hidden>
              <Leaf size={22} />
            </span>
          )}
        </button>
        <div className="ct-line__body">
          <p className="ct-line__name">{item.name}</p>
          {item.size ? <p className="ct-line__meta">{item.size}</p> : null}
          {item._isOutOfStock ? (
            <Badge tone="neutral">{T.outOfStock}</Badge>
          ) : null}
          <strong className="ct-line__price">{formatRupee(item.price)}</strong>
          {isPrescribed && (item.appointment_id || item.consultation_id) ? (
            <Button
              className="ct-line__rx"
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(`/profile/prescriptions/${item.consultation_id || item.appointment_id}`, {
                  state: {
                    appointment_id: item.appointment_id,
                    consultation_id: item.consultation_id,
                    prescription_id: item.prescription_id,
                    doctorData: {
                      doctor_name: item.doctorName,
                      id: item.doctor_id,
                      doctor_id: item.doctor_id,
                    },
                  },
                })
              }
            >
              {T.viewPrescription}
            </Button>
          ) : null}
          <div className="am-stepper ct-line__qty" role="group" aria-label={`Quantity of ${item.name || 'item'}`}>
            <button
              type="button"
              aria-label={T.decreaseQty}
              disabled={adding || (isPrescribed && item.quantity <= 1)}
              onClick={() => changeQty(item, 'minus')}
            >
              <Minus size={16} aria-hidden />
            </button>
            <span aria-live="polite">{adding ? '…' : item.quantity}</span>
            <button
              type="button"
              aria-label={T.increaseQty}
              disabled={adding || item._isOutOfStock}
              onClick={() => changeQty(item, 'plus')}
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
        </div>
      </article>
    );
  };

  const showTabs = cartCount + prescribedCount > 0;
  const isEmpty = !visible.length;

  return (
    <AppShell tab="cart">
      <section className="ct-page">
        <PageHeader
          title={T.title}
          subtitle={visible.length ? T.itemsCount(visible.length) : T.subtitleEmpty}
          hideBack
          actions={headerActions}
        />

        {showTabs ? (
          <Tabs
            label={T.tabsLabel}
            value={tab}
            onChange={setTab}
            items={[
              { id: 'cart', label: T.tabCart, count: cartCount || undefined },
              { id: 'prescribed', label: T.tabPrescribed, count: prescribedCount || undefined },
            ]}
          />
        ) : null}

        {loading && !sections.length ? (
          <div className="ct-skel" aria-busy="true" aria-label={T.loading}>
            <Skeleton style={{ height: 96, borderRadius: 'var(--am-radius-lg)' }} />
            <Skeleton style={{ height: 96, borderRadius: 'var(--am-radius-lg)' }} />
            <SkeletonText lines={3} />
          </div>
        ) : isEmpty ? (
          <EmptyState
            title={tab === 'prescribed' ? T.emptyRxTitle : T.emptyTitle}
            description={tab === 'prescribed' ? T.emptyRxText : T.emptyText}
            action={
              <>
                <Button variant="secondary" onClick={() => navigate('/search')}>
                  {T.search}
                </Button>
                <Button variant="primary" onClick={() => navigate('/products')}>
                  {T.shopProducts}
                </Button>
              </>
            }
          />
        ) : (
          <>
            {outOfStockCount > 0 ? (
              <p className="ct-banner" role="status">
                {outOfStockCount === 1
                  ? T.outOfStockBannerOne
                  : T.outOfStockBannerMany(outOfStockCount)}
              </p>
            ) : null}

            <label className="ct-select-all">
              <input
                type="checkbox"
                checked={
                  visible.filter((i) => !i._isOutOfStock).every((i) => selected.includes(i.id)) &&
                  visible.some((i) => !i._isOutOfStock)
                }
                onChange={toggleAll}
              />
              {T.selectAll}
            </label>

            <div className="ct-list">
              {tab === 'prescribed'
                ? rxGroups.map((group) => {
                    const meta = group.meta || {};
                    const tone = rxTone(meta);
                    const groupIds = group.items
                      .filter((line) => !line._isOutOfStock)
                      .map((line) => line.id);
                    const groupSelected =
                      groupIds.length > 0 && groupIds.every((id) => selected.includes(id));
                    return (
                      <div
                        key={meta.id || group.items[0]?.rx_group_id}
                        className="ct-rx-group"
                      >
                        <header className="ct-rx-group__head">
                          <label className="ct-rx-group__label">
                            <input
                              type="checkbox"
                              checked={groupSelected}
                              disabled={!groupIds.length}
                              onChange={() => {
                                setSelected((prev) =>
                                  groupSelected
                                    ? prev.filter((id) => !groupIds.includes(id))
                                    : [...new Set([...prev, ...groupIds])],
                                );
                              }}
                            />
                            <div>
                              <p className="ct-rx-group__kicker">{T.doctorRx}</p>
                              <p className="ct-rx-group__name">
                                {meta.doctor_name || group.items[0]?.doctorName || 'Doctor'}
                              </p>
                              <p className="ct-rx-group__meta">
                                {[
                                  meta.patient_name,
                                  formatRxDate(meta.created_at || group.items[0]?.rx_created_at),
                                  T.itemsCount(group.items.length),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                          </label>
                          <Badge tone={tone.tone}>{tone.label}</Badge>
                        </header>
                        {group.items.map(renderLine)}
                      </div>
                    );
                  })
                : visible.map(renderLine)}
            </div>

            <div className="ct-sticky">
              {showDetails ? (
                <div className="ct-bill">
                  <p className="ct-bill__row">
                    <span>{T.itemTotal}</span>
                    <strong>{formatRupee(subtotal)}</strong>
                  </p>
                  <p className="ct-bill__row">
                    <span>{T.delivery}</span>
                    <strong>{feeLoading ? '…' : formatRupee(shipping)}</strong>
                  </p>
                  <p className="ct-bill__row">
                    <span>{T.gst}</span>
                    <strong>{feeLoading ? '…' : formatRupee(gst)}</strong>
                  </p>
                  <p className="ct-bill__row">
                    <span>{T.platformFee}</span>
                    <strong>{feeLoading ? '…' : formatRupee(platform)}</strong>
                  </p>
                </div>
              ) : null}
              <div className="ct-sticky__row">
                <div className="ct-sticky__meta">
                  <small>{T.toPay}</small>
                  <strong>{feeLoading ? '…' : formatRupee(payable)}</strong>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowDetails((open) => !open)}>
                  {showDetails ? T.hideBill : T.viewBill}
                </Button>
                <Button
                  variant="primary"
                  disabled={!selectedProducts.length}
                  onClick={goCheckout}
                >
                  {T.checkout}
                  {selectedProducts.length ? ` (${selectedProducts.length})` : ''}
                </Button>
              </div>
            </div>

            <Disclaimer />
          </>
        )}
      </section>

      <Modal
        open={Boolean(qtyConfirm)}
        onClose={() => setQtyConfirm(null)}
        title={T.qtyConfirmTitle}
        description={
          qtyConfirm
            ? T.qtyConfirmBody(qtyConfirm.doctorQty, qtyConfirm.item.name)
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setQtyConfirm(null)}>
              {T.qtyConfirmKeep}
            </Button>
            <Button variant="primary" onClick={confirmPrescribedBump}>
              {T.qtyConfirmAdd}
            </Button>
          </>
        }
      />
    </AppShell>
  );
}
