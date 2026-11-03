import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Leaf, Minus, Plus, Star } from "lucide-react";
import { formatRupee, resolveImageUrl } from "../home/catalog";
import { useCart } from "../hooks/useCart";
import {
  getAddQtyBlockMessage,
  getProductStockQty,
  isPrescriptionRequired,
  isProductOutOfStock,
  LOW_STOCK_THRESHOLD,
} from "../product/stock";
import { requireAuth } from "../services/guestAuth";
import { showPrescriptionRequired } from "../services/prescriptionGate";
import { showSuccessToast } from "../config/key";
import { toggleWishlistItem, useWishlistFlag } from "../product/wishlistSync";
import Badge from "./ui/Badge";
import FavButton from "./ui/FavButton";
import CartAddButton from "./CartAddButton";

export default function ProductCard({
  item,
  onWishlistChange,
  cartButton = false,
  layout = "default",
  detailBase = "/products",
}) {
  const app = layout === "app";
  const navigate = useNavigate();
  const { variantQuantities, addingVariantId, syncCartQuantity } = useCart();
  const variantId = String(item?.variant_id || "");
  const cartQty = variantQuantities[variantId] ?? 0;
  const adding = addingVariantId === variantId;
  const image = resolveImageUrl(item);
  const price = formatRupee(item.selling_price ?? item.price);
  const mrp =
    item.mrp && Number(item.mrp) > Number(item.selling_price || 0)
      ? formatRupee(item.mrp)
      : "";
  const discount =
    item?.mrp > item?.selling_price
      ? Math.round(((item.mrp - item.selling_price) / item.mrp) * 100)
      : 0;
  const out = isProductOutOfStock(item);
  const rx = isPrescriptionRequired(item);
  const stockQty = getProductStockQty(item);
  const lowStockNote =
    app &&
    !out &&
    stockQty != null &&
    stockQty > 0 &&
    stockQty <= LOW_STOCK_THRESHOLD
      ? stockQty === 1
        ? "Only 1 item available."
        : `Only ${stockQty} items available.`
      : "";
  const subtitle =
    lowStockNote || item?.brand_name || item?.variant_title || "";
  const rating = item?.avg_rating ?? "0";
  const wish = useWishlistFlag(item);
  const [wishBusy, setWishBusy] = useState(false);

  const updateQty = async (nextQty) => {
    if (!(await requireAuth("Please login to add items to cart"))) return;
    const block = getAddQtyBlockMessage(item, nextQty);
    if (block) {
      showSuccessToast(block, "error");
      return;
    }
    if (nextQty > cartQty && isPrescriptionRequired(item)) {
      showPrescriptionRequired({ variantId, productName: item.name });
      return;
    }
    await syncCartQuantity(item, nextQty);
  };

  const toggleWish = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (wishBusy) return;
    if (!(await requireAuth("Please login to save wishlist items"))) return;
    if (!variantId) return;
    const prev = wish;
    setWishBusy(true);
    try {
      const result = await toggleWishlistItem(item);
      if (result === "error") {
        showSuccessToast("Unable to update wishlist", "error");
        return;
      }
      onWishlistChange?.(item, !prev);
    } finally {
      setWishBusy(false);
    }
  };

  return (
    <article className={`am-product-card ${app ? "am-product-card--app" : ""} ${out ? "is-out" : ""}`}>
      <div className="am-product-card__media">
        {image ? (
          <img
            src={image}
            alt={item.name || ""}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="am-product-card__placeholder" aria-hidden>
            <Leaf size={32} />
          </span>
        )}
        {app && out ? (
          <span className="am-product-card__corner is-oos">Out of Stock</span>
        ) : app && discount > 0 ? (
          <span className="am-product-card__corner">{discount}% OFF</span>
        ) : (
          <div className="am-product-card__badges">
            {discount > 0 ? <Badge tone="accent">{discount}% off</Badge> : null}
            {rx ? (
              <Badge tone="info" icon={<FileText size={12} aria-hidden />}>
                Rx
                <span className="am-sr-only"> — prescription required</span>
              </Badge>
            ) : null}
          </div>
        )}
        {!app && out ? (
          <span className="am-product-card__oos">Out of stock</span>
        ) : null}
        <FavButton
          corner
          on={wish}
          onClick={toggleWish}
          label={
            wish
              ? `Remove ${item.name || "item"} from wishlist`
              : `Add ${item.name || "item"} to wishlist`
          }
        />
      </div>

      <div className="am-product-card__body">
        <h3 className="am-product-card__name">
          <button
            type="button"
            className="am-stretched"
            onClick={() => variantId && navigate(`${detailBase}/${variantId}`)}
          >
            {item.name}
          </button>
        </h3>
        {app ? (
          <p className={`am-product-card__sub ${lowStockNote ? "is-low" : ""}`}>
            {subtitle || "\u00a0"}
          </p>
        ) : null}
        <p className="am-product-card__price">
          <strong>{price}</strong>
          {mrp ? (
            <s>
              {app ? null : <span className="am-sr-only">MRP </span>}
              {app ? "MRP " : null}
              {mrp}
            </s>
          ) : null}
          {!app && discount > 0 ? (
            <span className="am-product-card__off">{discount}% off</span>
          ) : null}
          {app ? (
            <span className="am-product-card__rate">
              <Star size={11} aria-hidden />
              {rating || "0"}
            </span>
          ) : null}
        </p>
      </div>

      <div className={`am-product-card__action ${app ? "is-overlay" : ""}`}>
        {cartButton || app ? (
          <CartAddButton item={item} compact={app} className={app ? "am-cart-btn--sm" : ""} />
        ) : out ? (
          <button type="button" className="am-product-card__add" disabled>
            Unavailable
          </button>
        ) : cartQty > 0 ? (
          <div
            className="am-stepper"
            role="group"
            aria-label={`Quantity of ${item.name || "item"}`}
          >
            <button
              type="button"
              onClick={() => updateQty(Math.max(0, cartQty - 1))}
              disabled={adding}
              aria-label="Decrease quantity"
            >
              <Minus size={16} aria-hidden />
            </button>
            <span aria-live="polite">{adding ? "…" : cartQty}</span>
            <button
              type="button"
              onClick={() => updateQty(cartQty + 1)}
              disabled={adding}
              aria-label="Increase quantity"
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="am-product-card__add"
            disabled={adding}
            onClick={() => updateQty(1)}
          >
            {adding ? "Adding…" : rx ? "Add (Rx)" : "Add to cart"}
          </button>
        )}
      </div>
    </article>
  );
}
