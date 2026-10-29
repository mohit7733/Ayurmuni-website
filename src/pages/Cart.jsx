import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Leaf,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { formatRupee } from "../home/catalog";
import { useCart } from "../hooks/useCart";
import { buildCartSections, CHECKOUT_KEY } from "../cart/mapCart";
import {
  buildDoctorDetailRoute,
  buildUploadVerifyRoute,
  groupRxLines,
  groupSubtotal,
  toggleGroupSelection,
} from "../cart/rxGroups";
import {
  getAddQtyBlockMessage,
  isPrescriptionRequired,
} from "../product/stock";
import { showPrescriptionRequired } from "../services/prescriptionGate";
import { getOrderFeeQuote } from "../services/orderService";
import { invalidateApiCache } from "../services/apiClient";
import {
  getStatusLabel,
  isPrescriptionApproved,
  isPrescriptionRejected,
} from "../services/prescriptionService";
import { requireAuth } from "../services/guestAuth";
import { showSuccessToast } from "../config/key";
import {
  Badge,
  Button,
  Modal,
  SectionHold,
  Tabs,
} from "../components/ui";
import { CART_COPY as T } from "../content/cart";
import "../design/pages/cart.css";
import "../design/pages/cart-premium.css";

const rxTone = (item) => {
  if (isPrescriptionApproved(item))
    return { label: T.rxApproved, tone: "success" };
  if (isPrescriptionRejected(item))
    return { label: T.rxRejected, tone: "danger" };
  return { label: getStatusLabel(item) || T.rxWaiting, tone: "warning" };
};

const formatRxDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function Cart() {
  const navigate = useNavigate();
  const { cartData, loading, fetchCart, syncCartQuantity, addingVariantId } =
    useCart();
  const [tab, setTab] = useState("cart");
  const [selected, setSelected] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [fees, setFees] = useState(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [qtyConfirm, setQtyConfirm] = useState(null);
  const [collapsedRx, setCollapsedRx] = useState({});
  const doctorQtyRef = useRef({});

  useEffect(() => {
    (async () => {
      if (!(await requireAuth("Please login to view your cart"))) return;
      fetchCart();
    })();
  }, [fetchCart]);

  const sections = useMemo(() => buildCartSections(cartData), [cartData]);
  const cartSection = sections.find((s) => s.type === "cart");
  const prescribedSection = sections.find((s) => s.type === "prescribed");
  const cartCount = cartSection?.items.length ?? 0;
  const prescribedCount = prescribedSection?.items.length ?? 0;
  const visible =
    (tab === "prescribed" ? prescribedSection : cartSection)?.items || [];
  const outOfStockCount = visible.filter((item) => item._isOutOfStock).length;

  const idKey = sections
    .flatMap((s) => s.items.map((item) => item.id))
    .join(",");

  useEffect(() => {
    if (!sections.length) {
      setSelected([]);
      return;
    }
    if (prescribedSection?.items?.length && !cartSection?.items?.length) {
      setTab("prescribed");
    }
    const selectable = sections
      .flatMap((s) => s.items)
      .filter((item) => !item._isOutOfStock)
      .map((item) => item.id);
    setSelected(selectable);
  }, [
    idKey,
    sections,
    cartSection?.items?.length,
    prescribedSection?.items?.length,
  ]);

  useEffect(() => {
    if (tab === "cart" && !cartCount && prescribedCount) setTab("prescribed");
    if (tab === "prescribed" && !prescribedCount && cartCount) setTab("cart");
  }, [tab, cartCount, prescribedCount]);

  const selectedProducts = visible.filter(
    (item) => selected.includes(item.id) && !item._isOutOfStock,
  );
  const subtotal = selectedProducts.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity),
    0,
  );
  const cartItemIds = selectedProducts
    .map((item) => String(item.cart_item_id || item.id || "").trim())
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
          shipping:
            Number(summary.shipping_charges ?? summary.delivery_charge ?? 0) ||
            0,
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
  }, [cartItemIds.join(",")]);

  const shipping = Number(fees?.shipping) || 0;
  const gst = Number(fees?.gst) || 0;
  const platform = Number(fees?.platform) || 0;
  const payable = fees
    ? Math.round(subtotal + shipping + gst + platform)
    : Math.round(subtotal);

  // Doctor vs uploaded-prescription groups (uploads grouped by prescription_request_id).
  const rxGroups = useMemo(
    () => (tab === "prescribed" ? groupRxLines(visible) : []),
    [tab, visible],
  );

  const toggle = (id, disabled) => {
    if (disabled) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    const ids = visible
      .filter((item) => !item._isOutOfStock)
      .map((item) => item.id);
    const allOn = ids.length > 0 && ids.every((id) => selected.includes(id));
    setSelected(
      allOn
        ? selected.filter((id) => !ids.includes(id))
        : [...new Set([...selected, ...ids])],
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    doctorQtyRef.current = {};
    invalidateApiCache("cart/"); // manual refresh must hit the network, not the 10s GET cache
    await fetchCart();
    setRefreshing(false);
  };

  const changeQty = async (item, action) => {
    const isPrescribed = item.source === "prescribed";
    const rxRequired =
      isPrescriptionRequired(item) || item.prescription_required;
    const oldQty = Math.max(0, Number(item.quantity) || 0);

    if (isPrescribed && action === "remove") return;

    if (rxRequired && (isPrescribed || action === "plus")) {
      showPrescriptionRequired({
        variantId: item.variant_id,
        productName: item.name,
      });
      return;
    }

    if (isPrescribed && action === "minus" && oldQty <= 1) return;

    const nextQty =
      action === "minus"
        ? Math.max(isPrescribed ? 1 : 0, oldQty - 1)
        : oldQty + 1;
    const stockMsg = getAddQtyBlockMessage(item, nextQty, { cartLine: true });
    if (stockMsg) {
      showSuccessToast(stockMsg, "error");
      return;
    }

    if (isPrescribed && action === "plus") {
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
    const { item } = qtyConfirm;
    setQtyConfirm(null);
    // App confirmPrescribedQtyIncrease: never send a line without variant + cart item ids.
    const safeVariantId = String(item?.variant_id || "").trim();
    const safeCartItemId = String(item?.cart_item_id || item?.id || "").trim();
    if (!safeVariantId || !safeCartItemId) {
      showSuccessToast("Unable to update this item. Please refresh cart.", "error");
      return;
    }
    await syncCartQuantity(item, qtyConfirm.nextQty);
  };

  const goCheckout = () => {
    const checkoutProducts = selectedProducts.filter(
      (item) => !item._isOutOfStock,
    );
    if (!checkoutProducts.length) {
      showSuccessToast(
        "Out of stock. Remove it and continue with in-stock items.",
        "error",
      );
      return;
    }
    const overStock = checkoutProducts.find((item) =>
      Boolean(
        getAddQtyBlockMessage(item, Number(item.quantity) || 0, {
          cartLine: true,
        }),
      ),
    );
    if (overStock) {
      showSuccessToast(
        getAddQtyBlockMessage(overStock, Number(overStock.quantity) || 0, {
          cartLine: true,
        }) || "Some items are out of stock. Please update quantities.",
        "error",
      );
      return;
    }
    sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(checkoutProducts));
    navigate("/checkout", { state: { selectedProducts: checkoutProducts } });
  };

  const mrpOf = (item) => {
    const mrp = Number(item.mrp) || 0;
    const price = Number(item.price) || 0;
    return mrp > price ? mrp : 0;
  };
  const mrpSavings = selectedProducts.reduce((sum, item) => {
    const mrp = mrpOf(item);
    return mrp ? sum + (mrp - Number(item.price)) * Number(item.quantity) : sum;
  }, 0);

  const renderLine = (item) => {
    const adding = addingVariantId === item.variant_id;
    const isPrescribed = item.source === "prescribed";
    const mrp = mrpOf(item);
    const off = mrp ? Math.round(((mrp - Number(item.price)) / mrp) * 100) : 0;
    return (
      <article
        key={item.id}
        className={`cp-line${item._isOutOfStock ? " is-oos" : ""}`}
      >
        <input
          type="checkbox"
          className="cp-check"
          checked={selected.includes(item.id)}
          disabled={item._isOutOfStock}
          aria-label={T.selectItem}
          onChange={() => toggle(item.id, item._isOutOfStock)}
        />
        <button
          type="button"
          className="cp-line__thumb"
          onClick={() => navigate(`/products/${item.variant_id}`)}
          aria-label={item.name || "View product"}
        >
          {item.image ? (
            <img src={item.image} alt="" loading="lazy" decoding="async" />
          ) : (
            <Leaf size={22} aria-hidden />
          )}
        </button>
        <div className="cp-line__body">
          <p className="cp-line__name">{item.name}</p>
          {item.size || item._isOutOfStock ? (
            <p className="cp-line__meta">
              {item.size ? <span>{item.size}</span> : null}
              {item._isOutOfStock ? (
                <span className="cp-line__oos">{T.outOfStock}</span>
              ) : null}
            </p>
          ) : null}
          <p className="cp-line__price">
            <strong>{formatRupee(item.price)}</strong>
            {mrp ? <s>{formatRupee(mrp)}</s> : null}
            {off > 0 ? <span className="cp-off">{off}% off</span> : null}
          </p>
          {isPrescribed && (item.appointment_id || item.consultation_id) ? (
            <button
              type="button"
              className="cp-line__rx"
              onClick={() =>
                navigate(
                  `/profile/prescriptions/${item.consultation_id || item.appointment_id}`,
                  {
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
                  },
                )
              }
            >
              <FileText size={13} aria-hidden /> {T.viewPrescription}
            </button>
          ) : null}
        </div>
        <div className="cp-line__side">
          <div
            className="cp-stepper"
            role="group"
            aria-label={`Quantity of ${item.name || "item"}`}
          >
            <button
              type="button"
              aria-label={T.decreaseQty}
              disabled={adding || (isPrescribed && item.quantity <= 1)}
              onClick={() => changeQty(item, "minus")}
            >
              {!isPrescribed && Number(item.quantity) <= 1 ? (
                <Trash2 size={14} aria-hidden />
              ) : (
                <Minus size={14} aria-hidden />
              )}
            </button>
            <span aria-live="polite">{adding ? "…" : item.quantity}</span>
            <button
              type="button"
              aria-label={T.increaseQty}
              disabled={adding || item._isOutOfStock}
              onClick={() => changeQty(item, "plus")}
            >
              <Plus size={14} aria-hidden />
            </button>
          </div>
          <span className="cp-line__total">
            {formatRupee(Number(item.price) * Number(item.quantity))}
          </span>
        </div>
      </article>
    );
  };

  const showTabs = cartCount + prescribedCount > 0;
  const isEmpty = !visible.length;
  const allSelected =
    visible.filter((i) => !i._isOutOfStock).every((i) => selected.includes(i.id)) &&
    visible.some((i) => !i._isOutOfStock);
  const busy = refreshing || loading;
  const totalLabel = feeLoading ? "…" : formatRupee(payable);

  return (
    <AppShell tab="cart">
      <section className="cp-page">
        <header className="cp-head">
          <button
            type="button"
            className="cp-iconbtn"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
          <div className="cp-head__copy">
            <h1 className="cp-head__title">{T.title}</h1>
            <p className="cp-head__desc">
              {visible.length ? T.itemsCount(visible.length) : T.subtitleEmpty}
            </p>
          </div>
          <div className="cp-head__actions">
            <button
              type="button"
              className="cp-iconbtn"
              onClick={() => navigate("/search")}
              aria-label={T.search}
              title={T.search}
            >
              <Search size={17} aria-hidden />
            </button>
            <button
              type="button"
              className="cp-iconbtn"
              onClick={onRefresh}
              disabled={busy}
              aria-label={busy ? T.refreshing : T.refresh}
              title={T.refresh}
            >
              <RefreshCw size={17} aria-hidden className={busy ? "ct-spin" : undefined} />
            </button>
          </div>
        </header>

        {loading && !sections.length ? (
          <SectionHold label={T.loading} minHeight={280} />
        ) : isEmpty && !showTabs ? (
          <div className="cp-empty">
            <span className="cp-empty__icon" aria-hidden>
              <ShoppingBag size={26} />
            </span>
            <h2>{tab === "prescribed" ? T.emptyRxTitle : T.emptyTitle}</h2>
            <p>{tab === "prescribed" ? T.emptyRxText : T.emptyText}</p>
            <div className="cp-empty__actions">
              <button type="button" className="cp-btn cp-btn--ghost" onClick={() => navigate("/search")}>
                {T.search}
              </button>
              <button type="button" className="cp-btn" onClick={() => navigate("/products")}>
                {T.shopProducts}
              </button>
            </div>
          </div>
        ) : (
          <div className="cp-layout">
            <div className="cp-card cp-items">
              <div className="cp-items__bar">
                {showTabs ? (
                  <Tabs
                    className="cp-tabs"
                    label={T.tabsLabel}
                    value={tab}
                    onChange={setTab}
                    items={[
                      { id: "cart", label: T.tabCart, count: cartCount || undefined },
                      { id: "prescribed", label: T.tabPrescribed, count: prescribedCount || undefined },
                    ]}
                  />
                ) : null}
                {!isEmpty ? (
                  <label className="cp-selectall">
                    <input type="checkbox" className="cp-check" checked={allSelected} onChange={toggleAll} />
                    {T.selectAll}
                  </label>
                ) : null}
              </div>

              {outOfStockCount > 0 ? (
                <p className="cp-notice" role="status">
                  {outOfStockCount === 1
                    ? T.outOfStockBannerOne
                    : T.outOfStockBannerMany(outOfStockCount)}
                </p>
              ) : null}

              {isEmpty ? (
                <div className="cp-empty cp-empty--inline">
                  <h2>{tab === "prescribed" ? T.emptyRxTitle : T.emptyTitle}</h2>
                  <p>{tab === "prescribed" ? T.emptyRxText : T.emptyText}</p>
                </div>
              ) : tab === "prescribed" ? (
                rxGroups.map((group) => {
                  const meta = group.meta || {};
                  const tone = rxTone(meta);
                  const isUpload = group.kind === "upload";
                  const groupIds = group.items
                    .filter((line) => !line._isOutOfStock)
                    .map((line) => line.id);
                  const groupSelected =
                    groupIds.length > 0 && groupIds.every((id) => selected.includes(id));
                  const groupTotal = groupSubtotal(group);
                  const open = collapsedRx[group.key] !== true;
                  const detailsRoute = isUpload
                    ? buildUploadVerifyRoute(group)
                    : buildDoctorDetailRoute(group);
                  return (
                    <div
                      key={group.key}
                      className={`cp-rx${isUpload ? " cp-rx--upload" : ""}`}
                    >
                      <header className="cp-rx__head">
                        <label className="cp-rx__label">
                          <input
                            type="checkbox"
                            className="cp-check"
                            checked={groupSelected}
                            disabled={!groupIds.length}
                            onChange={() => setSelected((prev) => toggleGroupSelection(prev, group))}
                          />
                          <span className="cp-rx__copy">
                            <span className="cp-rx__kicker">
                              {isUpload ? T.uploadedRx : T.doctorRx}
                            </span>
                            <strong>
                              {isUpload
                                ? [
                                    T.itemsCount(group.items.length),
                                    groupTotal != null ? formatRupee(groupTotal, { decimals: 2 }) : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")
                                : meta.doctor_name || group.items[0]?.doctorName || "Doctor"}
                            </strong>
                            <span className="cp-rx__meta">
                              {[
                                meta.patient_name,
                                formatRxDate(meta.created_at || group.items[0]?.rx_created_at),
                                T.itemsCount(group.items.length),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                        </label>
                        <Badge tone={tone.tone}>{tone.label}</Badge>
                      </header>
                      {open ? group.items.map(renderLine) : null}
                      <footer className="cp-rx__foot">
                        <button
                          type="button"
                          className="cp-rx__link"
                          aria-expanded={open}
                          onClick={() =>
                            setCollapsedRx((prev) => ({ ...prev, [group.key]: open }))
                          }
                        >
                          {open ? T.hideItems : T.showItems}
                          {open ? (
                            <ChevronUp size={14} aria-hidden />
                          ) : (
                            <ChevronDown size={14} aria-hidden />
                          )}
                        </button>
                        {detailsRoute ? (
                          <button
                            type="button"
                            className="cp-rx__link cp-rx__link--primary"
                            onClick={() => navigate(detailsRoute.path, { state: detailsRoute.state })}
                          >
                            {T.rxDetails}
                            <ChevronRight size={14} aria-hidden />
                          </button>
                        ) : null}
                      </footer>
                    </div>
                  );
                })
              ) : (
                visible.map(renderLine)
              )}
            </div>

            {!isEmpty ? (
              <aside className="cp-card cp-summary" aria-label="Order summary">
                <h2 className="cp-summary__title">
                  Order summary
                  <span>{T.itemsCount(selectedProducts.length)}</span>
                </h2>
                <dl className="cp-bill">
                  <div>
                    <dt>{T.itemTotal}</dt>
                    <dd>{formatRupee(subtotal)}</dd>
                  </div>
                  <div>
                    <dt>{T.delivery}</dt>
                    <dd>{feeLoading ? "…" : fees && !shipping ? <span className="cp-free">Free</span> : formatRupee(shipping)}</dd>
                  </div>
                  <div>
                    <dt>{T.gst}</dt>
                    <dd>{feeLoading ? "…" : formatRupee(gst)}</dd>
                  </div>
                  <div>
                    <dt>{T.platformFee}</dt>
                    <dd>{feeLoading ? "…" : formatRupee(platform)}</dd>
                  </div>
                  <div className="cp-bill__total">
                    <dt>{T.toPay}</dt>
                    <dd>{totalLabel}</dd>
                  </div>
                </dl>
                {mrpSavings > 0 ? (
                  <p className="cp-savings">
                    <BadgePercent size={15} aria-hidden />
                    You save {formatRupee(Math.round(mrpSavings))} on MRP
                  </p>
                ) : null}
                <button
                  type="button"
                  className="cp-btn cp-btn--checkout"
                  disabled={!selectedProducts.length}
                  onClick={goCheckout}
                >
                  {T.checkout}
                  {selectedProducts.length ? ` (${selectedProducts.length})` : ""}
                  <ArrowRight size={16} aria-hidden />
                </button>
              </aside>
            ) : null}
          </div>
        )}

        {!isEmpty ? (
          <div className="cp-bar">
            <div className="cp-bar__meta">
              <small>{T.toPay}</small>
              <strong>{totalLabel}</strong>
              {mrpSavings > 0 ? <span>Saving {formatRupee(Math.round(mrpSavings))}</span> : null}
            </div>
            <button
              type="button"
              className="cp-btn cp-btn--checkout"
              disabled={!selectedProducts.length}
              onClick={goCheckout}
            >
              {T.checkout}
              {selectedProducts.length ? ` (${selectedProducts.length})` : ""}
              <ArrowRight size={16} aria-hidden />
            </button>
          </div>
        ) : null}
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
