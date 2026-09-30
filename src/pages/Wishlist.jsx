import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ProductCard from '../components/ProductCard';
import { mapCatalogProductItem, normalizeApiList } from '../home/catalog';
import { requireAuth } from '../services/guestAuth';
import { getProducts } from '../services/productService';

export default function Wishlist() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await getProducts({ page: 1, page_size: 60 });
    const list = normalizeApiList(res)
      .map(mapCatalogProductItem)
      .filter((item) => item && item.is_wishlist_item);
    setItems(list);
    setLoading(false);
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
          <p className="muted">Loading wishlist…</p>
        ) : items.length === 0 ? (
          <p className="empty-copy">No wishlist items</p>
        ) : (
          <div className="catalog-grid">
            {items.map((item) => (
              <ProductCard
                key={item.variant_id || item.id}
                item={item}
                onWishlistChange={() => load()}
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
