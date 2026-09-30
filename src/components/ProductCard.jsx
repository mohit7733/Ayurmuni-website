import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Heart, Leaf, Minus, Plus } from 'lucide-react';
import { formatRupee, resolveImageUrl } from '../home/catalog';
import { useCart } from '../hooks/useCart';
import {
  getAddQtyBlockMessage,
  isPrescriptionRequired,
  isProductOutOfStock,
} from '../product/stock';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import { toggleWishlistProduct } from '../services/productService';
import Badge from './ui/Badge';

export default function ProductCard({ item, onWishlistChange }) {
  const navigate = useNavigate();
  const { variantQuantities, addingVariantId, syncCartQuantity } = useCart();
  const variantId = String(item?.variant_id || '');
  const cartQty = variantQuantities[variantId] ?? 0;
  const adding = addingVariantId === variantId;
  const image = resolveImageUrl(item);
  const price = formatRupee(item.selling_price ?? item.price);
  const mrp =
    item.mrp && Number(item.mrp) > Number(item.selling_price || 0)
      ? formatRupee(item.mrp)
      : '';
  const discount =
    item?.mrp > item?.selling_price
      ? Math.round(((item.mrp - item.selling_price) / item.mrp) * 100)
      : 0;
  const out = isProductOutOfStock(item);
  const rx = isPrescriptionRequired(item);
  const [wish, setWish] = useState(Boolean(item?.is_wishlist_item));

  const updateQty = async (nextQty) => {
    if (!(await requireAuth('Please login to add items to cart'))) return;
    const block = getAddQtyBlockMessage(item, nextQty);
    if (block) {
      showSuccessToast(block, 'error');
      return;
    }
    if (nextQty > cartQty && isPrescriptionRequired(item)) {
      showSuccessToast(
        'This medicine needs a valid prescription before it can be added to cart.',
        'error',
      );
      navigate(
        `/medicines/prescription?variant=${encodeURIComponent(variantId)}&name=${encodeURIComponent(
          item.name || '',
        )}`,
        { state: { variantIds: [variantId], productName: item.name } },
      );
      return;
    }
    await syncCartQuantity(item, nextQty);
  };

  const toggleWish = async (e) => {
    e.stopPropagation();
    if (!(await requireAuth('Please login to save wishlist items'))) return;
    if (!variantId) return;
    const res = await toggleWishlistProduct(variantId);
    if (res?.success === false) {
      showSuccessToast(res?.message || 'Unable to update wishlist', 'error');
      return;
    }
    setWish((prev) => !prev);
    onWishlistChange?.(item, !wish);
  };

  return (
    <article className={`am-product-card ${out ? 'is-out' : ''}`}>
      <div className="am-product-card__media">
        {image ? (
          <img src={image} alt={item.name || ''} loading="lazy" decoding="async" />
        ) : (
          <span className="am-product-card__placeholder" aria-hidden>
            <Leaf size={32} />
          </span>
        )}
        <div className="am-product-card__badges">
          {discount > 0 ? <Badge tone="accent">{discount}% off</Badge> : null}
          {rx ? (
            <Badge tone="info" icon={<FileText size={12} aria-hidden />}>
              Rx
              <span className="am-sr-only"> — prescription required</span>
            </Badge>
          ) : null}
        </div>
        {out ? <span className="am-product-card__oos">Out of stock</span> : null}
      </div>

      <button
        type="button"
        className={`am-product-card__wish ${wish ? 'is-on' : ''}`}
        onClick={toggleWish}
        aria-pressed={wish}
        aria-label={wish ? `Remove ${item.name || 'item'} from wishlist` : `Add ${item.name || 'item'} to wishlist`}
      >
        <Heart size={18} aria-hidden />
      </button>

      <div className="am-product-card__body">
        <h3 className="am-product-card__name">
          <button
            type="button"
            className="am-stretched"
            onClick={() => variantId && navigate(`/products/${variantId}`)}
          >
            {item.name}
          </button>
        </h3>
        <p className="am-product-card__price">
          <strong>{price}</strong>
          {mrp ? (
            <s>
              <span className="am-sr-only">MRP </span>
              {mrp}
            </s>
          ) : null}
        </p>
      </div>

      <div className="am-product-card__action">
        {out ? (
          <button type="button" className="am-product-card__add" disabled>
            Unavailable
          </button>
        ) : cartQty > 0 ? (
          <div className="am-stepper" role="group" aria-label={`Quantity of ${item.name || 'item'}`}>
            <button
              type="button"
              onClick={() => updateQty(Math.max(0, cartQty - 1))}
              disabled={adding}
              aria-label="Decrease quantity"
            >
              <Minus size={16} aria-hidden />
            </button>
            <span aria-live="polite">{adding ? '…' : cartQty}</span>
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
            {adding ? 'Adding…' : rx ? 'Add (Rx)' : 'Add to cart'}
          </button>
        )}
      </div>
    </article>
  );
}
