import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { addUpdateCart, cartMetrics, getAllCart } from '../services/cartService';
import { isAuthenticated, requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import { invalidateApiCache, subscribeApiSession } from '../services/apiClient';
import { pickOrderedCartLines } from '../cart/clearOrdered';

const CartContext = createContext(null);
const apiFreshCart = () => getAllCart({ cache: false });

export function CartProvider({ children }) {
  const [variantQuantities, setVariantQuantities] = useState({});
  const [itemCount, setItemCount] = useState(0);
  const [cartData, setCartData] = useState(null);
  const [addingVariantId, setAddingVariantId] = useState('');
  const [loading, setLoading] = useState(false);
  // Only the newest cart read may write state: rapid qty changes each call fetchCart.
  const cartRequestRef = useRef(0);

  const applyMetrics = useCallback((response) => {
    const metrics = cartMetrics(response);
    setVariantQuantities(metrics.variantQuantities);
    setItemCount(metrics.itemCount);
    setCartData(metrics.cartData);
    return metrics;
  }, []);

  const fetchCart = useCallback(async () => {
    const requestId = ++cartRequestRef.current;
    if (!(await isAuthenticated())) {
      if (requestId !== cartRequestRef.current) return null;
      setVariantQuantities({});
      setItemCount(0);
      setCartData(null);
      return null;
    }
    setLoading(true);
    try {
      const res = await getAllCart();
      if (requestId !== cartRequestRef.current) return null;
      if (res?.success === false) return null;
      return applyMetrics(res);
    } catch {
      return null;
    } finally {
      if (requestId === cartRequestRef.current) setLoading(false);
    }
  }, [applyMetrics]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // The provider lives for the whole app: reload the badge/cart when the account changes
  // (login, logout, patient switch) instead of showing the previous account's cart.
  useEffect(() => subscribeApiSession(() => fetchCart()), [fetchCart]);

  const syncCartQuantity = useCallback(
    async (item, newQty) => {
      if (!(await requireAuth('Please login to add items to cart'))) return false;
      const variantId = String(item?.variant_id || item?.id || '').trim();
      if (!variantId) return false;
      setAddingVariantId(variantId);
      try {
        const response = await addUpdateCart({
          variant_id: variantId,
          quantity: Math.max(0, Number(newQty) || 0),
          cart_item_id: item?.cart_item_id || item?.id,
          ...(item?.source === 'prescribed' ? { source: 'prescribed' } : {}),
        });
        if (response?.success === false) {
          showSuccessToast(response?.message || 'Failed to update cart', 'error');
          return false;
        }
        setVariantQuantities((prev) => {
          const next = { ...prev };
          if (newQty <= 0) delete next[variantId];
          else next[variantId] = Number(newQty) || 0;
          return next;
        });
        await fetchCart();
        return true;
      } catch (error) {
        showSuccessToast(error?.message || 'Failed to update cart', 'error');
        return false;
      } finally {
        setAddingVariantId('');
      }
    },
    [fetchCart],
  );

  /**
   * After a confirmed order: remove the ordered lines from the server cart (if the backend has not
   * already), then reload. Uses the existing cart endpoint with quantity 0; other lines are kept.
   */
  const clearOrderedItems = useCallback(
    async (orderedItems) => {
      if (!(await isAuthenticated())) return null;
      invalidateApiCache(['cart/']);
      try {
        const fresh = await apiFreshCart();
        const leftovers = pickOrderedCartLines(fresh, orderedItems);
        for (const line of leftovers) {
          const variantId = String(line?.variant_id ?? line?.variant?.variant_id ?? line?.variant?.id ?? '').trim();
          if (!variantId) continue;
          try {
            await addUpdateCart({ variant_id: variantId, quantity: 0, cart_item_id: line?.id ?? line?.cart_item_id });
          } catch {
            /* keep going: the reload below shows whatever is really left */
          }
        }
      } catch {
        /* fall through to a plain reload */
      }
      invalidateApiCache(['cart/']);
      return fetchCart();
    },
    [fetchCart],
  );

  const value = useMemo(
    () => ({
      variantQuantities,
      itemCount,
      cartData,
      addingVariantId,
      loading,
      fetchCart,
      syncCartQuantity,
      clearOrderedItems,
    }),
    [variantQuantities, itemCount, cartData, addingVariantId, loading, fetchCart, syncCartQuantity, clearOrderedItems],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    return {
      variantQuantities: {},
      itemCount: 0,
      cartData: null,
      addingVariantId: '',
      loading: false,
      fetchCart: async () => null,
      syncCartQuantity: async () => false,
      clearOrderedItems: async () => null,
    };
  }
  return ctx;
}
