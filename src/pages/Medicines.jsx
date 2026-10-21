import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Pill, ShoppingBag } from 'lucide-react';
import AppShell from '../components/AppShell';
import BannerCarousel from '../components/BannerCarousel';
import ProductCard from '../components/ProductCard';
import { DietPlanCard, SectionHead, ViewAll } from '../components/ServiceHome';
import { getBanners } from '../services/bannerService';
import {
  formatRupee,
  getBannerImageUri,
  mapProductCategory,
  normalizeApiList,
  resolveImageUrl,
} from '../home/catalog';
import { getServiceCategoryId, resolveBannerNavigation } from '../home/serviceCategories';
import useDashboardCategories from '../hooks/useDashboardCategories';
import useCategoryProducts from '../hooks/useCategoryProducts';
import { useCart } from '../hooks/useCart';
import { getHealthCategories } from '../services/productService';
import { getBrands, listBrands, mapBrandItem } from '../services/medicineService';
import { getOrders, normalizeOrdersList } from '../services/orderService';
import { mapOrdersToRecentProducts } from '../profile/map';
import {
  Button,
  ConcernCarousel,
  EmptyState,
  PageBar,
  Rail,
  RailItem,
  RailSkeleton,
  Reveal,
  SearchField,
  SkeletonGrid,
  Tile,
} from '../components/ui';
import { HOME_COPY as H } from '../content/home';

export default function Medicines() {
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { categories: dashboardCategories, loading: homeLoading } = useDashboardCategories();
  const medicineCategoryId = useMemo(
    () => getServiceCategoryId(dashboardCategories, 'medicine'),
    [dashboardCategories],
  );
  const productFilter = useMemo(
    () => (medicineCategoryId ? { service_category_id: medicineCategoryId } : {}),
    [medicineCategoryId],
  );
  const { products, loading, loadingMore, hasMore, loadMore } = useCategoryProducts(
    productFilter,
    [],
    { enabled: Boolean(medicineCategoryId) || !homeLoading },
  );

  const [banners, setBanners] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [brands, setBrands] = useState([]);
  const [recent, setRecent] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const moreRef = useRef(null);

  const goSearch = (value) => {
    const query = String(value || search || '').trim();
    navigate(`/search?mode=product${query ? `&q=${encodeURIComponent(query)}` : ''}`);
  };

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

  useEffect(() => {
    const node = moreRef.current;
    if (!node || !hasMore) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '240px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, products.length]);

  const showSkeleton = loading && products.length === 0;
  const concernQuery = medicineCategoryId ? `&service=${medicineCategoryId}` : '';
  const concernBrowse = `/products/category?mode=health&name=${encodeURIComponent(
    'Shop by Concern',
  )}${concernQuery}`;

  const openBanner = (item) => {
    const target = resolveBannerNavigation(item);
    if (!target) return;
    if (target.external) {
      window.open(target.href, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(target.path);
  };

  return (
    <AppShell tab="medicines">
      <div className="hm-page svc-page">
        <div className="hm-body">
          {banners.length ? (
            <BannerCarousel
              items={banners}
              interval={6000}
              onSelect={openBanner}
              copy={{
                label: H.offersLabel,
                open: H.openOffer,
                of: H.of,
                show: H.showOffer,
                pause: H.pauseOffers,
                play: H.playOffers,
              }}
            />
          ) : null}

          <PageBar id="med-hero" title="Shop medicines">
            <SearchField
              value={search}
              onChange={setSearch}
              onSubmit={goSearch}
              placeholder={H.searchPlaceholder}
              label="Search medicines"
            />
            <Button
              variant="secondary"
              onClick={() => navigate('/cart')}
              leadingIcon={<ShoppingBag size={18} aria-hidden />}
            >
              Cart
              {itemCount ? (
                <span className="am-page-bar__count">{itemCount > 99 ? '99+' : itemCount}</span>
              ) : null}
            </Button>
          </PageBar>

          {showSkeleton ? (
            <SkeletonGrid count={8} className="svc-catalog" label="Loading medicines" />
          ) : (
            <>
              {ordersLoading || recent.length > 0 ? (
                <div className="hm-doctor-row">
                  <Reveal as="section" className="hm-section" aria-labelledby="med-recent">
                    <SectionHead
                      id="med-recent"
                      title="Recent orders"
                      description="Medicines you ordered recently."
                      action={<ViewAll label="Recent orders" onClick={() => navigate('/profile/orders')} />}
                    />
                    {ordersLoading && recent.length === 0 ? (
                      <RailSkeleton count={4} />
                    ) : (
                      <Rail label="Recent orders">
                        {recent.map((item) => (
                          <RailItem key={`${item.id}-${item.variantId}`}>
                            <DietPlanCard
                              item={{
                                title: item.name,
                                thumbnail_url: item.image,
                                season: item.lastOrdered ? `Ordered ${item.lastOrdered}` : 'Recent order',
                                prakriti: formatRupee(item.price, { decimals: 0 }),
                              }}
                              onClick={() => item.variantId && navigate(`/products/${item.variantId}`)}
                            />
                          </RailItem>
                        ))}
                      </Rail>
                    )}
                  </Reveal>
                </div>
              ) : null}

              {concerns.length > 0 ? (
                <Reveal as="section" className="hm-section hm-panel hm-concerns-panel" aria-labelledby="med-concerns">
                  <SectionHead
                    id="med-concerns"
                    title={H.concernsTitle}
                    description="Shop remedies for the concern you want to improve."
                    action={
                      concerns.length > 1 ? (
                        <ViewAll label={H.concernsTitle} onClick={() => navigate(concernBrowse)} />
                      ) : null
                    }
                  />
                  <ConcernCarousel label={H.concernsTitle}>
                    {concerns.map((item) => (
                      <Tile
                        cutout
                        key={item.id}
                        image={item.image_url}
                        icon={Pill}
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
                  </ConcernCarousel>
                </Reveal>
              ) : null}

              {brands.length > 0 ? (
                <Reveal as="section" className="hm-section hm-panel hm-brands-panel" aria-labelledby="med-brands">
                  <SectionHead
                    id="med-brands"
                    eyebrow="Trusted"
                    title="Brands"
                    description="Formulas from houses we stock."
                  />
                  <ConcernCarousel label="Trusted brands">
                    {brands.map((item) => (
                      <Tile
                        key={item.id}
                        className="hm-brand-tile"
                        image={item.image_url || resolveImageUrl(item)}
                        icon={Pill}
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
                  </ConcernCarousel>
                </Reveal>
              ) : null}

              <div className="hm-doctor-row">
                <section className="hm-section" aria-labelledby="med-all">
                  <SectionHead
                    id="med-all"
                    title={H.medicinesTitle}
                    description={H.featuredText}
                    action={<ViewAll label={H.medicinesTitle} onClick={() => navigate(concernBrowse)} />}
                  />
                  {products.length === 0 ? (
                    <EmptyState
                      icon={<Leaf size={28} />}
                      title="No medicines available"
                      description="Try another concern, or search by medicine name."
                    />
                  ) : (
                    <ul className="svc-catalog">
                      {products.map((item) => (
                        <li key={item.variant_id || item.id}>
                          <ProductCard item={item} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {hasMore ? (
                    <div ref={moreRef} className="svc-more" aria-live="polite">
                      {loadingMore ? 'Loading…' : ''}
                    </div>
                  ) : null}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
