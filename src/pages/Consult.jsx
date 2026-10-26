import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchX, Stethoscope } from 'lucide-react';
import AppShell from '../components/AppShell';
import SuggestedDoctorCard from '../components/SuggestedDoctorCard';
// import DummyOfferCard from '../components/DummyOfferCard'; // Health Lab disabled per Rohit
// import LabHomeBanner from '../components/LabHomeBanner'; // Health Lab disabled per Rohit
import ProductCard from '../components/ProductCard';
import ConsultationCard from '../components/consult/ConsultationCard';
import { SectionHead, ViewAll } from '../components/ServiceHome';
import { mapProductCategory, normalizeApiList } from '../home/catalog';
import { getServiceCategoryId } from '../home/serviceCategories';
import useDashboardCategories from '../hooks/useDashboardCategories';
import useCategoryProducts from '../hooks/useCategoryProducts';
import { getAllApprovedDoctors, getConsultHistory, getSuggestedDoctors } from '../services/consultService';
import { getHealthCategories } from '../services/productService';
import { doctorDisplayName, getDoctorId, normalizeDoctorList } from '../consult/doctors';
import { resolveAppointmentLookupId } from '../consult/appointmentUtils';
import { mapAppointment } from '../profile/map';
import { isAuthenticated } from '../services/guestAuth';
import {
  Button,
  ConcernCarousel,
  EmptyState,
  PageBar,
  Rail,
  RailItem,
  Reveal,
  SearchField,
  searchSuggestions,
  SkeletonGrid,
  Tile,
} from '../components/ui';
import { CONSULT_COPY as T } from '../content/consult';
import { HOME_COPY as H } from '../content/home';
// import { DUMMY_LAB_TESTS } from '../data/homeDummySections'; // Health Lab disabled per Rohit
import '../design/pages/dummy-offers.css';
import '../design/pages/orange-lab.css';

const matchesSearch = (q, ...values) => {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => String(value || '').toLowerCase().includes(needle));
};

const doctorMatchesSearch = (doctor, needle) =>
  matchesSearch(
    needle,
    doctorDisplayName(doctor),
    doctor?.qualification,
    doctor?.specialization_name,
    doctor?.full_name,
  );

export default function Consult() {
  const navigate = useNavigate();
  const { categories: dashboardCategories } = useDashboardCategories();
  const consultCategoryId = useMemo(
    () => getServiceCategoryId(dashboardCategories, 'consult'),
    [dashboardCategories],
  );
  const [concerns, setConcerns] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [suggestedDoctors, setSuggestedDoctors] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const productFilter = useMemo(() => (debounced ? { search: debounced } : {}), [debounced]);
  const { products, loading: productsLoading, loadingMore, hasMore, loadMore } = useCategoryProducts(
    productFilter,
    [],
    { pageSize: 8 },
  );
  const moreRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadHome = async () => {
    setLoading(true);
    const [catRes, allDoctors, suggestedRes] = await Promise.all([
      getHealthCategories(),
      getAllApprovedDoctors(),
      getSuggestedDoctors(),
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
    setConcerns(normalizeApiList(catRes).map(mapProductCategory).filter((item) => item.id));
    setDoctors(Array.isArray(allDoctors) ? allDoctors : []);
    setSuggestedDoctors(normalizeDoctorList(suggestedRes, { approvedOnly: true }));
    setHistory(hist);
    setLoading(false);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadHome();
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, [consultCategoryId]);

  const filteredHistory = useMemo(
    () =>
      history.filter((item) =>
        matchesSearch(debounced, item.doctorName, item.concern, item.status, item.specialty),
      ),
    [history, debounced],
  );

  const filteredDoctors = useMemo(
    () => doctors.filter((doctor) => doctorMatchesSearch(doctor, debounced)),
    [doctors, debounced],
  );

  const filteredSuggestedDoctors = useMemo(
    () => suggestedDoctors.filter((doctor) => doctorMatchesSearch(doctor, debounced)),
    [suggestedDoctors, debounced],
  );

  const suggestedDoctorLimit = 6;
  const showSuggestedDoctors =
    (loading && suggestedDoctors.length === 0 && doctors.length > 0) ||
    filteredSuggestedDoctors.length > 0;

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

  const placeBar = loading && !concerns.length && !doctors.length ? 'top' : 'doctors';
  const searchBar = (
      <PageBar className="am-page-bar--slot" id="cs-hero" title="Consult a doctor">
        <SearchField
          value={search}
          onChange={setSearch}
          onSubmit={(value) => setDebounced(String(value || '').trim())}
          placeholder={T.searchPlaceholder}
          label={T.searchLabel}
          includeRecent
        suggestions={searchSuggestions(concerns)}
        />
      </PageBar>
  );

  const headActions = (
    <>
        <Button
        variant="accent"
        onClick={() => navigate('/consult/doctors')}
        leadingIcon={<Stethoscope size={16} aria-hidden />}
      >
        {T.browseAll}
      </Button>
      <Button variant="secondary" onClick={() => navigate('/consult/history')}>
        {T.history}
      </Button>
    </>
  );

  return (
    <AppShell tab="consult">
      <div className="hm-page svc-page">
        <div className="hm-body">

          {placeBar === 'top' ? <div className="am-head-tools am-head-tools--top">{searchBar}{headActions}</div> : null}

          {loading && !concerns.length && !doctors.length ? (
            <SkeletonGrid variant="doctor" count={4} label={T.loadingDoctors} />
          ) : (
            <>
              <Reveal as="section" className="hm-section hm-panel" aria-labelledby="cs-doctors-title">
                <SectionHead
                  id="cs-doctors-title"
                  eyebrow={T.doctorsEyebrow}
                  title={T.doctorsTitle}
                  description={T.doctorsText}
                  action={
                    <div className="am-head-tools">
                      {placeBar === 'doctors' ? searchBar : null}
                      {headActions}
                      <ViewAll label={T.doctorsTitle} onClick={() => navigate('/consult/doctors')} />
                    </div>
                  }
                />
                {loading && !doctors.length ? (
                  <SkeletonGrid
                    variant="doctor"
                    count={6}
                    label={T.loadingDoctors}
                    className="am-doctor-grid am-doctor-grid--premium"
                  />
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
                  <ul className="am-doctor-grid am-doctor-grid--premium" aria-label={T.doctorsTitle}>
                    {filteredDoctors.map((item) => (
                      <li key={getDoctorId(item) || item.full_name}>
                        <SuggestedDoctorCard item={item} fallbackSpeciality={H.ayurvedicDoctor} />
                      </li>
                    ))}
                  </ul>
                )}
              </Reveal>

            {filteredHistory.length > 0 ? (
              <div className="hm-product-row">
                <section className="hm-section hm-panel svc-rail-section" aria-labelledby="cs-recent-title">
                  <SectionHead
                    id="cs-recent-title"
                    title={H.visitedTitle}
                    description="Consultations you booked recently."
                    action={<ViewAll label={T.recentTitle} onClick={() => navigate('/consult/history')} />}
                  />
                  <Rail label={H.visitedTitle} className="svc-consult-rail">
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
                </section>
              </div>
            ) : null}

              {showSuggestedDoctors ? (
                <Reveal
                  as="section"
                  className="hm-section hm-panel"
                  delay={120}
                  aria-labelledby="cs-suggested-doctors-title"
                >
                  <SectionHead
                    id="cs-suggested-doctors-title"
                    eyebrow={H.doctorsEyebrow}
                    title={T.suggestedDoctorsTitle}
                    description={T.suggestedDoctorsText}
                    action={
                      <ViewAll label={T.suggestedDoctorsTitle} onClick={() => navigate('/consult/doctors')} />
                    }
                  />
                  {loading && !suggestedDoctors.length ? (
                    <SkeletonGrid
                      variant="doctor"
                      count={3}
                      label={T.loadingDoctors}
                      className="am-doctor-grid am-doctor-grid--premium am-doctor-grid--portrait"
                    />
                  ) : (
                    <ul
                      className="am-doctor-grid am-doctor-grid--premium am-doctor-grid--portrait"
                      aria-label={T.suggestedDoctorsTitle}
                    >
                      {filteredSuggestedDoctors.slice(0, suggestedDoctorLimit).map((item) => (
                        <li key={getDoctorId(item) || item.full_name}>
                          <SuggestedDoctorCard item={item} fallbackSpeciality={H.ayurvedicDoctor} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Reveal>
              ) : null}

              {concerns.length > 0 ? (
                <Reveal as="section" className="hm-section hm-panel hm-concerns-panel" aria-labelledby="cs-concerns-title">
                  <SectionHead
                    id="cs-concerns-title"
                    title={H.concernsTitle}
                    description={H.concernsText}
                  />
                  <ConcernCarousel label={H.concernsTitle}>
                    {concerns.map((item) => (
                      <Tile
                        cutout
                        key={item.id}
                        image={item.image_url}
                        icon={Stethoscope}
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
                  </ConcernCarousel>
                </Reveal>
              ) : null}

              {products.length > 0 || productsLoading ? (
                <div className="hm-product-row">
                  <section className="hm-section hm-products svc-rail-section" aria-labelledby="cs-products-title">
                    <SectionHead
                      id="cs-products-title"
                      title={H.productsTitle}
                      description={H.featuredText}
                      action={
                        products.length > 0 ? (
                          <ViewAll label={H.productsTitle} onClick={() => navigate('/products')} />
                        ) : null
                      }
                    />
                    {productsLoading && !products.length ? (
                      <SkeletonGrid count={4} className="svc-catalog" />
                    ) : (
                      <Rail label={H.productsTitle} auto>
                        {products.map((item) => (
                          <RailItem key={item.variant_id || item.id} size="product">
                            <ProductCard item={item} />
                          </RailItem>
                        ))}
                      </Rail>
                    )}
                    {hasMore ? (
                      <div ref={moreRef} className="svc-more" aria-live="polite">
                        {loadingMore ? T.loadingMore : ''}
                      </div>
                    ) : null}
                  </section>
                </div>
              ) : null}

              {/* Health Lab disabled per Rohit
              <Reveal as="section" className="hm-section hm-panel hm-lab" aria-labelledby="cs-lab-title">
                <SectionHead
                  id="cs-lab-title"
                  title={H.labTitle}
                  description={T.labText}
                  action={<ViewAll label={H.labTitle} onClick={() => navigate('/labs')} />}
                />
                <LabHomeBanner
                  title={H.labBannerTitle}
                  subtitle={H.labBannerSub}
                  onClick={() => navigate('/labs')}
                />
                <Rail label={H.labTitle}>
                  {DUMMY_LAB_TESTS.map((item) => (
                    <RailItem key={item.id} size="product">
                      <DummyOfferCard item={item} kind="lab" onClick={() => navigate('/labs')} />
                    </RailItem>
                  ))}
                </Rail>
              </Reveal> */}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
