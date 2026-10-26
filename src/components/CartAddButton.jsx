import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "../hooks/useCart";
import {
  getAddQtyBlockMessage,
  isPrescriptionRequired,
  isProductOutOfStock,
} from "../product/stock";
import { requireAuth } from "../services/guestAuth";
import { showPrescriptionRequired } from "../services/prescriptionGate";
import { showSuccessToast } from "../config/key";
import "../design/cart-button.css";

/**
 * Premium in-card cart control: Add → Adding… → Added ✓ → quantity stepper.
 * Uses the same cart context + stock/Rx rules as the product detail page.
 * Every click stops propagation so the parent card never navigates.
 */
export default function CartAddButton({ item, className = "", compact = false }) {
  const { variantQuantities, addingVariantId, syncCartQuantity } = useCart();
  const variantId = String(item?.variant_id ?? item?.variantId ?? "");
  const cartQty = variantQuantities[variantId] ?? 0;
  const [busy, setBusy] = useState(false);
  // Own busy flag: the cart context tracks only one in-flight variant at a time.
  const adding = busy || (Boolean(variantId) && addingVariantId === variantId);
  const out = isProductOutOfStock(item);
  const rx = isPrescriptionRequired(item);
  const name = item?.name || "item";
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef(0);
  const [firstAdd, setFirstAdd] = useState(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const updateQty = async (nextQty) => {
    if (!variantId) return false;
    if (!(await requireAuth("Please login to add items to cart"))) return false;
    const block = getAddQtyBlockMessage(item, nextQty);
    if (block) {
      showSuccessToast(block, "error");
      return false;
    }
    if (nextQty > cartQty && rx) {
      showPrescriptionRequired({ variantId, productName: item?.name });
      return false;
    }
    setBusy(true);
    let ok = false;
    try {
      ok = await syncCartQuantity({ ...item, variant_id: variantId }, nextQty);
    } finally {
      setBusy(false);
    }
    if (ok === false) showSuccessToast("Try again to add into cart", "error");
    return ok !== false;
  };

  const onAdd = async (event) => {
    stop(event);
    setFirstAdd(true);
    const ok = await updateQty(1);
    setFirstAdd(false);
    if (!ok) return;
    setJustAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setJustAdded(false), 1100);
  };

  const base = `am-cart-btn ${className}`.trim();

  if (out) {
    return (
      <button type="button" className={`${base} is-out`} disabled onClick={stop}>
        Out of stock
      </button>
    );
  }

  if (justAdded) {
    return (
      <span className={`${base} is-added`} role="status">
        <Check size={16} aria-hidden strokeWidth={2.6} />
        Added
      </span>
    );
  }

  if (cartQty > 0 && !(firstAdd && !justAdded)) {
    return (
      <div
        className={`${base} is-qty`}
        role="group"
        aria-label={`Quantity of ${name}`}
        onClick={stop}
      >
        <button
          type="button"
          disabled={adding}
          aria-label={`Decrease quantity of ${name}`}
          onClick={(e) => {
            stop(e);
            updateQty(Math.max(0, cartQty - 1));
          }}
        >
          <Minus size={15} aria-hidden />
        </button>
        <span aria-live="polite">
          {adding ? <Loader2 size={14} className="am-cart-btn__spin" aria-label="Updating" /> : cartQty}
        </span>
        <button
          type="button"
          disabled={adding}
          aria-label={`Increase quantity of ${name}`}
          onClick={(e) => {
            stop(e);
            updateQty(cartQty + 1);
          }}
        >
          <Plus size={15} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${base}${adding ? " is-loading" : ""}`}
      disabled={adding}
      aria-busy={adding || undefined}
      aria-label={`${rx ? "Add with prescription" : "Add to cart"}: ${name}`}
      onClick={onAdd}
    >
      {adding ? (
        <Loader2 size={16} className="am-cart-btn__spin" aria-hidden />
      ) : compact ? null : (
        <ShoppingBag size={15} aria-hidden />
      )}
      {adding ? (compact ? "…" : "Adding…") : compact ? "ADD" : rx ? "Add (Rx)" : "Add to cart"}
    </button>
  );
}
