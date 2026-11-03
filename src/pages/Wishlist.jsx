import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import AdvanceLoad from '../components/ui/AdvanceLoad';
import ProductCard from '../components/ProductCard';
import { mapCatalogProductItem, normalizeApiList } from '../home/catalog';
import { requireAuth } from '../services/guestAuth';
import { getWishlistProducts } from '../services/productService';

export default function Wishlist() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Only the first load shows the loading state; later refreshes are silent (as in the app).
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getWishlistProducts();
      const list = normalizeApiList(res)
        .map(mapCatalogProductItem)
        .filter(Boolean)
        .map((item) => ({ ...item, is_wishlist_item: true }));
      setItems(list);
    } catch {
      /* keep what is already shown */
    } finally {
      setLoading(false);
    }
  };

  // Removing a heart drops the card right away (the app's removeWhenUnwishlisted); adding refetches silently.
  const handleWishlistChange = (item, nextWishlisted) => {
    if (nextWishlisted === false) {
      const key = String(item?.variant_id || item?.id || '');
      setItems((prev) => prev.filter((entry) => String(entry.variant_id || entry.id || '') !== key));
      return;
    }
    load(true);
  };

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view wishlist'))) return;
      load();
    })();
  }, []);

  return (
    <AppShell tab="profile">
      <section className="catalog-page wishlist-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate('/profile')}>
            ← Back
          </button>
          <div>
            <h1>My wishlist</h1>
            <p>Saved products</p>
          </div>
        </header>
        {loading ? (
          <AdvanceLoad variant="cards" label="Loading wishlist" onRetry={() => load()} />
        ) : items.length === 0 ? (
          <div className="empty-copy">
            <strong>Wishlist is Empty</strong>
            <p>No products added to wishlist yet.</p>
          </div>
        ) : (
          <div className="catalog-grid">
            {items.map((item) => (
              <ProductCard
                key={item.variant_id || item.id}
                item={item}
                onWishlistChange={handleWishlistChange}
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
