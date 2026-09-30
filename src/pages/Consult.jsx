import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, History, RefreshCw, SearchX, Stethoscope } from 'lucide-react';
import AppShell from '../components/AppShell';
import BannerCarousel from '../components/BannerCarousel';
import DoctorCard from '../components/DoctorCard';
import DummyOfferCard from '../components/DummyOfferCard';
import ProductCard from '../components/ProductCard';
import ConsultationCard from '../components/consult/ConsultationCard';
import { getBanners } from '../services/bannerService';
import {
  getBannerImageUri,
  mapProductCategory,
  normalizeApiList,
} from '../home/catalog';
import { getServiceCategoryId, resolveBannerNavigation } from '../home/serviceCategories';
import useDashboardCategories from '../hooks/useDashboardCategories';
import useCategoryProducts from '../hooks/useCategoryProducts';
import { getConsultHistory, getDoctors } from '../services/consultService';
import { getHealthCategories } from '../services/productService';
import { doctorDisplayName, getDoctorId, listDoctors } from '../consult/doctors';
import { resolveAppointmentLookupId } from '../consult/appointmentUtils';
import { mapAppointment } from '../profile/map';
import { isAuthenticated } from '../services/guestAuth';
import {
  Button,
  Disclaimer,
  EmptyState,
  Rail,
  RailItem,
  Reveal,
  SearchField,
  SectionHeader,
  SkeletonGrid,
  Tile,
  TileGrid,
} from '../components/ui';
import { CONSULT_COPY as T } from '../content/consult';
import { DUMMY_LAB_TESTS } from '../data/homeDummySections';
import '../design/pages/consult.css';
import '../design/pages/dummy-offers.css';

const matchesSearch = (q, ...values) => {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => String(value || '').toLowerCase().includes(needle));
};

export default function Consult() {
  const navigate = useNavigate();
  const { categories: dashboardCategories } = useDashboardCategories();
  const consultCategoryId = useMemo(
    () => getServiceCategoryId(dashboardCategories, 'consult'),
    [dashboardCategories],
  );
  const [banners, setBanners] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const productFilter = useMemo(
    () => (debounced ? { search: debounced } : {}),
    [debounced],
  );
  const { products, loading: productsLoading, loadingMore, hasMore, refresh: refreshProducts, loadMore } =
    useCategoryProducts(productFilter, [], { pageSize: 6 });

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadHome = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const [bannerRes, catRes, docRes] = await Promise.all([
      getBanners('consult', consultCategoryId),
      getHealthCategories(),
      getDoctors(),
    ]);
    let hist = [];
    try {
      if (await isAuthenticated()) {
        const histRes = await getConsultHistory();
        const list = histRes?.data?.results || histRes?.results || [];
        hist = Array.isArray(list) ? list.map(mapAppointment).slice(0, 3) : [];
      }
    } catch {
      hist = [];
    }
    setBanners(
      (bannerRes?.data || [])
        .map((item) => ({ ...item, image: getBannerImageUri(item) }))
        .filter((item) => item.image),
    );
    setConcerns(normalizeApiList(catRes).map(mapProductCategory).filter((item) => item.id));
    setDoctors(listDoctors(docRes));
    setHistory(hist);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadHome(false);
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultCategoryId]);

  const filteredHistory = useMemo(
    () =>
      history.filter((item) =>
        matchesSearch(debounced, item.doctorName, item.concern, item.status, item.specialty),
      ),
    [history, debounced],
  );

  const filteredDoctors = useMemo(
    () =>
      doctors.filter((doctor) =>
        matchesSearch(
          debounced,
          doctorDisplayName(doctor),
          doctor?.qualification,
          doctor?.specialization_name,
          doctor?.full_name,
        ),
      ),
    [doctors, debounced],
  );

  const openBanner = (item) => {
    const target = resolveBannerNavigation(item);
    if (!target) return;
    if (target.external) {
      window.open(target.href, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(target.path);
  };

  const openSlots = (item) => {
    if (!item.doctorId) return;
    navigate(`/consult/doctors/${item.doctorId}/slots`, {
      state: {
        doctor: item.raw?.doctor || {
          id: item.doctorId,
          full_name: item.doctorName,
          profile_image: item.image,
        },
        appointmentId: item.appointmentId,
      },
    });
  };

  const openDetails = (item) => {
    const lookupId = resolveAppointmentLookupId({ rawData: item.raw, ...item });
    if (lookupId) navigate(`/profile/appointments/${lookupId}`);
    else if (item.doctorId) openSlots(item);
  };

  const onRefresh = () => {
    loadHome(true);
    refreshProducts();
  };

  return (
    <AppShell tab="consult">
      <div className="cs-page">
        <section className="cs-hero" aria-labelledby="cs-hero-title">
          <div className="cs-hero__copy">
            <p className="am-eyebrow">{T.eyebrow}</p>
            <h1 id="cs-hero-title">{T.heroTitle}</h1>
            <p className="cs-hero__lede">{T.heroLede}</p>
            <SearchField
              value={search}
              onChange={setSearch}
              onSubmit={(value) => setDebounced(String(value || '').trim())}
              placeholder={T.searchPlaceholder}
              label={T.searchLabel}
            />
            <div className="cs-hero__ctas">
              <Button
                size="lg"
                onClick={() => navigate('/consult/doctors')}
                leadingIcon={<Stethoscope size={18} aria-hidden />}
              >
                {T.browseAll}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => navigate('/consult/history')}
                leadingIcon={<History size={18} aria-hidden />}
              >
                {T.history}
              </Button>
            </div>
          </div>
          <ol className="cs-steps" aria-label={T.stepsLabel}>
            {T.steps.map((step, index) => (
              <li key={step.title}>
                <span className="cs-steps__num" aria-hidden>
                  {index + 1}
                </span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <BannerCarousel items={banners} onSelect={openBanner} loading={loading} interval={4000} />

        {filteredHistory.length > 0 ? (
          <Reveal as="section" className="cs-section" aria-labelledby="cs-recent-title">
            <SectionHeader
              id="cs-recent-title"
              title={T.recentTitle}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/consult/history')}
                  trailingIcon={<ArrowRight size={16} aria-hidden />}
                >
                  {T.viewHistory}
                </Button>
              }
            />
            <Rail label={T.recentTitle} className="cs-recent">
              {filteredHistory.map((item) => (
                <RailItem key={item.consultationId || item.appointmentId || item.id} size="wide">
                  <ConsultationCard
                    item={item}
                    onOpen={openDetails}
                    onReceipt={(entry) => navigate(`/profile/receipts/${entry.consultationId}`)}
                    onBook={openSlots}
                  />
                </RailItem>
              ))}
            </Rail>
          </Reveal>
        ) : null}

        {concerns.length > 0 ? (
          <Reveal as="section" className="cs-section" aria-labelledby="cs-concerns-title">
            <SectionHeader
              id="cs-concerns-title"
              eyebrow={T.concernsEyebrow}
              title={T.concernsTitle}
              description={T.concernsText}
            />
            <TileGrid label={T.concernsTitle}>
              {concerns.map((item) => (
                <Tile
                  key={item.id}
                  image={item.image_url}
                  label={item.name}
                  onClick={() =>
                    navigate(
                      `/consult/concern/${item.id}?name=${encodeURIComponent(item.name)}${
                        item.description ? `&desc=${encodeURIComponent(item.description)}` : ''
                      }`,
                      { state: { categoryName: item.name, categoryDesc: item.description } },
                    )
                  }
                />
              ))}
            </TileGrid>
          </Reveal>
        ) : null}

        <section className="cs-section" aria-labelledby="cs-doctors-title">
          <SectionHeader
            id="cs-doctors-title"
            eyebrow={T.topDoctorsEyebrow}
            title={T.topDoctorsTitle}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/consult/doctors')}
                trailingIcon={<ArrowRight size={16} aria-hidden />}
              >
                {T.viewAll}
              </Button>
            }
          />
          {loading && !doctors.length ? (
            <SkeletonGrid variant="doctor" count={3} label={T.loadingDoctors} className="am-doctor-grid" />
          ) : filteredDoctors.length === 0 ? (
            <EmptyState
              compact
              icon={<SearchX size={24} />}
              title={debounced ? T.noMatch : T.noDoctors}
              description={debounced ? T.noMatchText : T.noDoctorsText}
              action={
                debounced ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setDebounced('');
                    }}
                  >
                    {T.clearSearch}
                  </Button>
                ) : null
              }
            />
          ) : (
            <ul className="am-doctor-grid">
              {filteredDoctors.slice(0, 6).map((item) => (
                <li key={getDoctorId(item) || item.full_name}>
                  <DoctorCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {products.length > 0 || productsLoading ? (
          <Reveal as="section" className="cs-section" aria-labelledby="cs-products-title">
            <SectionHeader
              id="cs-products-title"
              title={T.productsTitle}
              action={
                products.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/products')}
                    trailingIcon={<ArrowRight size={16} aria-hidden />}
                  >
                    {T.viewAll}
                  </Button>
                ) : null
              }
            />
            {productsLoading && !products.length ? (
              <SkeletonGrid count={4} className="am-product-grid" />
            ) : (
              <>
                <ul className="am-product-grid">
                  {products.map((item) => (
                    <li key={item.variant_id || item.id}>
                      <ProductCard item={item} />
                    </li>
                  ))}
                </ul>
                {hasMore ? (
                  <div className="cs-more">
                    <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                      {loadingMore ? T.loadingMore : T.loadMore}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </Reveal>
        ) : null}

        <Reveal as="section" className="cs-section" aria-labelledby="cs-lab-title">
          <SectionHeader
            id="cs-lab-title"
            title={T.labTitle}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/labs')}
                trailingIcon={<ArrowRight size={16} aria-hidden />}
              >
                {T.viewAll}
              </Button>
            }
          />
          <Rail label={T.labTitle}>
            {DUMMY_LAB_TESTS.map((item) => (
              <RailItem key={item.id} size="product">
                <DummyOfferCard item={item} kind="lab" onClick={() => navigate('/labs')} />
              </RailItem>
            ))}
          </Rail>
        </Reveal>

        <footer className="cs-foot">
          <Disclaimer variant="banner" />
          <Button
            variant="ghost"
            size="sm"
            loading={refreshing}
            disabled={loading}
            onClick={onRefresh}
            leadingIcon={<RefreshCw size={14} aria-hidden />}
          >
            {refreshing ? T.refreshing : T.refresh}
          </Button>
        </footer>
      </div>
    </AppShell>
  );
}
