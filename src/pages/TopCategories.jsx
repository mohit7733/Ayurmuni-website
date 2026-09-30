import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import ProductCard from '../components/ProductCard';
import useCategoryProducts from '../hooks/useCategoryProducts';

export default function TopCategories() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const categoryName = params.get('name') || location.state?.categoryName || 'Category';
  const categoryId = params.get('category') || location.state?.categoryId || '';
  const serviceId = params.get('service') || location.state?.serviceId || '';

  const filter = useMemo(() => {
    const next = {};
    if (categoryId) next.id = categoryId;
    if (serviceId) next.service_category_id = serviceId;
    return next;
  }, [categoryId, serviceId]);

  const { products, loading, refreshing, refresh } = useCategoryProducts(filter, [], {
    enabled: true,
  });

  return (
    <AppShell tab="products">
      <section className="catalog-page top-categories">
        <PageHeader
          title={categoryName}
          subtitle="Shop this collection"
          actions={
            <>
              <button type="button" onClick={() => navigate('/search?mode=product')}>
                Search
              </button>
              <button type="button" onClick={refresh} disabled={refreshing}>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </>
          }
        />
        {loading && products.length === 0 ? (
          <div className="catalog-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skel skel-card" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="empty-copy">No products in this category yet</p>
        ) : (
          <div className="catalog-grid">
            {products.map((item) => (
              <ProductCard key={item.variant_id || item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
