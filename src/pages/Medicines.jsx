import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileUp, Search, ShoppingBag } from 'lucide-react';
import AppShell from '../components/AppShell';
import BannerCarousel from '../components/BannerCarousel';
import ProductCard from '../components/ProductCard';
import { getBanners } from '../services/bannerService';
import {
  getBannerImageUri,
  mapProductCategory,
  normalizeApiList,
  resolveImageUrl,
} from '../home/catalog';
import { getServiceCategoryId } from '../home/serviceCategories';
import useDashboardCategories from '../hooks/useDashboardCategories';
import useCategoryProducts from '../hooks/useCategoryProducts';
import { useCart } from '../hooks/useCart';
import { getHealthCategories } from '../services/productService';
import { getBrands, listBrands, mapBrandItem } from '../services/medicineService';
import { getOrders, normalizeOrdersList } from '../services/orderService';
import { mapOrdersToRecentProducts } from '../profile/map';
import { requireAuth } from '../services/guestAuth';
import {
  Button,
  Disclaimer,
  EmptyState,
  MediaCard,
  Rail,
  RailItem,
  RailSkeleton,
  Reveal,
  SearchField,
  SectionHeader,
  SkeletonGrid,
  Tile,
  TileGrid,
} from '../components/ui';
import { STORE_COPY as T } from '../content/store';
import '../design/pages/store.css';

export default function Medicines() {
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { categories: dashboardCategories, loading: homeLoading } =
    useDashboardCategories();
  const medicineCategoryId = useMemo(
    () => getServiceCategoryId(dashboardCategories, 'medicine'),
    [dashboardCategories],
  );
  const productFilter = useMemo(
    () => (medicineCategoryId ? { service_category_id: medicineCategoryId } : {}),
    [medicineCategoryId],
  );
  const {
    products,
    loading,
    loadingMore,
    hasMore,
    loadMore,
  } = useCategoryProducts(productFilter, [], {
    enabled: Boolean(medicineCategoryId) || !homeLoading,
  });

  const [banners, setBanners] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [brands, setBrands] = useState([]);
  const [recent, setRecent] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const [bannerRes, catRes, brandRes] = await Promise.all([
        getBanners('medicine', medicineCategoryId),
        getHealthCategories(
          medicineCategoryId ? { service_category_id: medicineCategoryId } : undefined,
        ),
        getBrands(),
      ]);
      if (!alive) return;
      setBanners(
        (bannerRes?.data || [])
          .map((item) => ({ ...item, image: getBannerImageUri(item) }))
          .filter((item) => item.image),
      );
      setConcerns(
        normalizeApiList(catRes)
          .map(mapProductCategory)
          .filter((item) => item.id),
      );
      setBrands(listBrands(brandRes).map(mapBrandItem).filter((item) => item.id));
    })();
    return () => {
      alive = false;
    };
  }, [medicineCategoryId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setOrdersLoading(true);
      try {
        const res = await getOrders({ page: 1, page_size: 5 });
        if (!alive) return;
        setRecent(mapOrdersToRecentProducts(normalizeOrdersList(res), 8));
      } catch {
        if (alive) setRecent([]);
      } finally {
        if (alive) setOrdersLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const showSkeleton = loading && products.length === 0;
  const concernQuery = medicineCategoryId ? `&service=${medicineCategoryId}` : '';

  const goSearch = (value) => {
    const query = String(value || search || '').trim();
    navigate(`/search?mode=health${query ? `&q=${encodeURIComponent(query)}` : ''}`);
  };

  return (
    <AppShell tab="medicines">
      <div className="st-page">
        <section className="st-hero" aria-labelledby="st-med-title">
          <div className="st-hero__copy">
            <p className="am-eyebrow">Pharmacy</p>
            <h1 id="st-med-title">{T.medicinesTitle}</h1>
            <p className="st-hero__lede">{T.medicinesLede}</p>
          </div>
          <div className="st-hero__row">
            <SearchField
              value={search}
              onChange={setSearch}
              onSubmit={goSearch}
              placeholder={T.medicinesSearch}
              label={T.medicinesSearch}
            />
            <Button
              variant="secondary"
              onClick={() => navigate('/cart')}
              leadingIcon={<ShoppingBag size={18} aria-hidden />}
            >
              {T.cart}
              {itemCount ? ` (${itemCount})` : ''}
            </Button>
          </div>
        </section>

        <div className="st-actions">
          <button
            type="button"
            className="st-action st-action--accent"
            onClick={async () => {
              if (!(await requireAuth('Please login to upload a prescription'))) return;
              navigate('/medicines/prescription');
            }}
          >
            <span className="st-action__icon" aria-hidden>
              <FileUp size={20} />
            </span>
            <span className="st-action__copy">
              <strong>{T.rxTitle}</strong>
              <small>{T.rxText}</small>
            </span>
          </button>
          <button
            type="button"
            className="st-action"
            onClick={() => navigate('/search?mode=health')}
          >
            <span className="st-action__icon" aria-hidden>
              <Search size={20} />
            </span>
            <span className="st-action__copy">
              <strong>{T.browseTitle}</strong>
              <small>{T.browseText}</small>
            </span>
          </button>
        </div>

        {showSkeleton ? (
          <SkeletonGrid count={6} className="am-product-grid" label="Loading medicines" />
        ) : (
          <>
            <BannerCarousel items={banners} interval={4000} />

            {ordersLoading || recent.length > 0 ? (
              <Reveal as="section" className="st-section" aria-labelledby="st-med-recent">
                <SectionHeader
                  id="st-med-recent"
                  title={T.recentOrders}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/profile/orders')}
                      trailingIcon={<ArrowRight size={16} aria-hidden />}
                    >
                      {T.viewHistory}
                    </Button>
                  }
                />
                {ordersLoading && recent.length === 0 ? (
                  <RailSkeleton count={4} size="wide" />
                ) : (
                  <Rail label={T.recentOrders}>
                    {recent.map((item) => (
                      <RailItem key={`${item.id}-${item.variantId}`} size="wide">
                        <MediaCard
                          image={item.image}
                          title={item.name}
                          subtitle={
                            item.lastOrdered ? `Ordered ${item.lastOrdered}` : 'Recent order'
                          }
                          onClick={() =>
                            item.variantId && navigate(`/products/${item.variantId}`)
                          }
                        />
                      </RailItem>
                    ))}
                  </Rail>
                )}
              </Reveal>
            ) : null}

            {concerns.length > 0 ? (
              <Reveal as="section" className="st-section" aria-labelledby="st-concerns">
                <SectionHeader
                  id="st-concerns"
                  title={T.shopByConcern}
                  description={T.shopByConcernText}
                  action={
                    concerns.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/products/category?mode=health&name=${encodeURIComponent(
                              'Shop by Concern',
                            )}${concernQuery}`,
                          )
                        }
                        trailingIcon={<ArrowRight size={16} aria-hidden />}
                      >
                        {T.viewAll}
                      </Button>
                    ) : null
                  }
                />
                <TileGrid label={T.shopByConcern}>
                  {concerns.map((item) => (
                    <Tile
                      key={item.id}
                      image={item.image_url}
                      label={item.name}
                      onClick={() =>
                        navigate(
                          `/products/category?mode=health&category=${item.id}&name=${encodeURIComponent(
                            item.name,
                          )}${concernQuery}`,
                        )
                      }
                    />
                  ))}
                </TileGrid>
              </Reveal>
            ) : null}

            {brands.length > 0 ? (
              <Reveal as="section" className="st-section" aria-labelledby="st-brands">
                <SectionHeader id="st-brands" title={T.trustedBrands} />
                <TileGrid label={T.trustedBrands}>
                  {brands.map((item) => (
                    <Tile
                      key={item.id}
                      image={item.image_url || resolveImageUrl(item)}
                      label={item.name}
                      onClick={() =>
                        navigate(
                          `/products/category?mode=product&brand=${item.id}&name=${encodeURIComponent(
                            item.name,
                          )}${concernQuery}`,
                        )
                      }
                    />
                  ))}
                </TileGrid>
              </Reveal>
            ) : null}

            <section className="st-section" aria-labelledby="st-all-med">
              <SectionHeader
                id="st-all-med"
                title={T.allMedicines}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/products/category?mode=health&name=${encodeURIComponent(
                          'Shop by Concern',
                        )}${concernQuery}`,
                      )
                    }
                    trailingIcon={<ArrowRight size={16} aria-hidden />}
                  >
                    {T.viewAll}
                  </Button>
                }
              />
              {products.length === 0 ? (
                <EmptyState title={T.noMedicines} description={T.noMedicinesText} />
              ) : (
                <ul className="am-product-grid">
                  {products.map((item) => (
                    <li key={item.variant_id || item.id}>
                      <ProductCard item={item} />
                    </li>
                  ))}
                </ul>
              )}
              {hasMore ? (
                <div className="st-more">
                  <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                    {loadingMore ? T.loadingMore : T.loadMore}
                  </Button>
                </div>
              ) : null}
            </section>

            <footer className="st-foot">
              <Disclaimer variant="banner" />
            </footer>
          </>
        )}
      </div>
    </AppShell>
  );
}
