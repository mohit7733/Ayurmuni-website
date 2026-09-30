import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addUpdateCart, cartMetrics, getAllCart } from '../services/cartService';
import { isAuthenticated, requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [variantQuantities, setVariantQuantities] = useState({});
  const [itemCount, setItemCount] = useState(0);
  const [cartData, setCartData] = useState(null);
  const [addingVariantId, setAddingVariantId] = useState('');
  const [loading, setLoading] = useState(false);

  const applyMetrics = useCallback((response) => {
    const metrics = cartMetrics(response);
    setVariantQuantities(metrics.variantQuantities);
    setItemCount(metrics.itemCount);
    setCartData(metrics.cartData);
    return metrics;
  }, []);

  const fetchCart = useCallback(async () => {
    if (!(await isAuthenticated())) {
      setVariantQuantities({});
      setItemCount(0);
      setCartData(null);
      return null;
    }
    setLoading(true);
    try {
      const res = await getAllCart();
      if (res?.success === false) return null;
      return applyMetrics(res);
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyMetrics]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

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

  const value = useMemo(
    () => ({
      variantQuantities,
      itemCount,
      cartData,
      addingVariantId,
      loading,
      fetchCart,
      syncCartQuantity,
    }),
    [variantQuantities, itemCount, cartData, addingVariantId, loading, fetchCart, syncCartQuantity],
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
    };
  }
  return ctx;
}
