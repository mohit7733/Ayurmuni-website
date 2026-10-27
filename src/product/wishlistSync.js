/**
 * Shared wishlist state. Port of app hooks/useWishlistSync.ts (without redux):
 * a module cache survives list refetches, and a tiny event bus keeps every
 * visible heart (cards, rails, wishlist page) in sync after any toggle.
 */
import { useEffect, useState } from 'react';
import { subscribeApiSession } from '../services/apiClient';
import { toggleWishlistProduct } from '../services/productService';

const wishlistCache = new Map();
const listeners = new Set();

/** Coerce API / local wishlist flags (bool, 0/1, "true"/"false"). */
export const readWishlistFlag = (value) => {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0' || value == null) return false;
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === 'no' || s === 'off' || s === '') return false;
  return Boolean(value);
};

export const resolveVariantId = (item) =>
  String(item?.variant_id ?? item?.variant?.variant_id ?? item?.variant?.id ?? item?.id ?? '').trim();

const itemFlag = (item) => readWishlistFlag(item?.is_wishlist_item ?? item?.is_wishlisted ?? item?.wishlisted);

/** Prefer the live cache, then the product's own fields. */
export const isItemWishlisted = (item) => {
  const id = resolveVariantId(item);
  if (id && wishlistCache.has(id)) return wishlistCache.get(id);
  return itemFlag(item);
};

/** Apply cached hearts onto a product list after an API fetch. */
export const applyWishlistCache = (products) => {
  if (!Array.isArray(products) || products.length === 0) return products;
  return products.map((item) => {
    const id = resolveVariantId(item);
    if (!id) return item;
    if (wishlistCache.has(id)) return { ...item, is_wishlist_item: wishlistCache.get(id) };
    const flag = itemFlag(item);
    return flag === readWishlistFlag(item?.is_wishlist_item) ? item : { ...item, is_wishlist_item: flag };
  });
};

export const seedWishlistCacheFromList = (products) => {
  if (!Array.isArray(products)) return;
  products.forEach((item) => {
    const id = resolveVariantId(item);
    if (!id || wishlistCache.has(id)) return;
    wishlistCache.set(id, itemFlag(item));
  });
};

export const subscribeWishlist = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = (variantId, isWishlisted) => {
  listeners.forEach((listener) => listener({ variantId, isWishlisted }));
};

/** Test/logout helper. */
export const resetWishlistCache = () => {
  wishlistCache.clear();
};

/** Optimistic toggle + broadcast. Returns 'ok' | 'error' (auth is handled by the caller). */
export async function toggleWishlistItem(item) {
  const variantId = resolveVariantId(item);
  if (!variantId) return 'error';
  const current = isItemWishlisted(item);
  const next = !current;
  wishlistCache.set(variantId, next);
  emit(variantId, next);
  try {
    const response = await toggleWishlistProduct(variantId);
    if (response?.success === false) throw new Error(response?.message || 'Wishlist update failed');
    const serverFlag = response?.data?.is_wishlist_item ?? response?.data?.is_wishlisted ?? response?.is_wishlist_item;
    if (serverFlag != null) {
      const resolved = readWishlistFlag(serverFlag);
      wishlistCache.set(variantId, resolved);
      if (resolved !== next) emit(variantId, resolved);
    }
    return 'ok';
  } catch {
    wishlistCache.set(variantId, current);
    emit(variantId, current);
    return 'error';
  }
}

// A different account must never inherit another account's hearts.
subscribeApiSession(() => {
  wishlistCache.clear();
});

/** Live heart state for one product; follows toggles made anywhere. */
export function useWishlistFlag(item) {
  const id = resolveVariantId(item);
  const [flag, setFlag] = useState(() => isItemWishlisted(item));
  const propFlag = itemFlag(item);
  useEffect(() => {
    setFlag(isItemWishlisted(item));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, propFlag]);
  useEffect(
    () =>
      subscribeWishlist((payload) => {
        if (payload.variantId === id) setFlag(payload.isWishlisted);
      }),
    [id],
  );
  return flag;
}