import { useEffect, useMemo, useState } from 'react';
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
import { doctorDisplayName, doctorImage, getDoctorId, normalizeDoctorList } from '../consult/doctors';
import { resolveAppointmentLookupId } from '../consult/appointmentUtils';
import { mapAppointment } from '../profile/map';
import { isAuthenticated } from '../services/guestAuth';
import {
  Button,
  ConcernCarousel,
  EmptyState,
  Rail,
  RailItem,
  Reveal,
  SkeletonGrid,
  Tile,
} from '../components/ui';
import { CONSULT_COPY as T } from '../content/consult';
import { HOME_COPY as H } from '../content/home';
// import { DUMMY_LAB_TESTS } from '../data/homeDummySections'; // Health Lab disabled per Rohit
import '../design/pages/consult.css';
import '../design/pages/dummy-offers.css';
import '../design/pages/orange-lab.css';

const PromiseIcon = ({ children }) => (
  <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

const PROMISE_ICONS = {
  talk: (
    <PromiseIcon>
      <circle cx="24" cy="20" r="11.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24 20.2V12" className="cs-promises__accent" strokeWidth="1.85" strokeLinecap="round" />
      <path d="M24 20.2 30.6 15.4" className="cs-promises__accent" strokeWidth="1.85" strokeLinecap="round" />
      <path d="M16.4 31.2 13.6 37.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.4 37.4h5.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M31.6 31.2 34.4 37.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M30.2 37.4h5.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </PromiseIcon>
  ),
  follow: (
    <PromiseIcon>
      <path
        d="M8.5 11.5h16a4.5 4.5 0 0 1 4.5 4.5v7.5a4.5 4.5 0 0 1-4.5 4.5h-3.2L16 32.2V28H8.5A4.5 4.5 0 0 1 4 23.5V16a4.5 4.5 0 0 1 4.5-4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        className="cs-promises__accent"
        d="M20 19.5h18.2a4.5 4.5 0 0 1 4.5 4.5v8.2a4.5 4.5 0 0 1-4.5 4.5H33l-4.6 4.1v-4.1h-8.4a4.5 4.5 0 0 1-4.5-4.5v-8.2a4.5 4.5 0 0 1 4.5-4.5Z"
      />
      <path d="M25.2 26.2h12.2M25.2 30.1h8.4M25.2 34h10.4" stroke="#fff" strokeWidth="1.45" strokeLinecap="round" />
    </PromiseIcon>
  ),
  rx: (
    <PromiseIcon>
      <path
        d="M14 8h13.2L37 17.6V38a3.5 3.5 0 0 1-3.5 3.5h-19.5A3.5 3.5 0 0 1 10.5 38V11.5A3.5 3.5 0 0 1 14 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M27 8.4V17.4H36.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <text className="cs-promises__accent" x="15.2" y="30" fontSize="12" fontWeight="700" fontFamily="Satoshi, system-ui, sans-serif">
        Rx
      </text>
      <path d="M15.5 35.2h14.2M15.5 39h9.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </PromiseIcon>
  ),
};

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
  const [search] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const productFilter = useMemo(() => (debounced ? { search: debounced } : {}), [debounced]);
  const { products, loading: productsLoading, loadingMore, hasMore, loadMore } = useCategoryProducts(
    productFilter,
    [],
    { pageSize: 8 },
  );
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
    const doctorsList = Array.isArray(allDoctors) ? allDoctors : [];
    const suggestedList = normalizeDoctorList(suggestedRes, { approvedOnly: true });
    const photoByDoctorId = new Map();
    const indexPhoto = (doc) => {
      const id = getDoctorId(doc);
      const url = doctorImage(doc);
      if (id && url && !photoByDoctorId.has(String(id))) {
        photoByDoctorId.set(String(id), url);
      }
    };
    doctorsList.forEach(indexPhoto);
    suggestedList.forEach(indexPhoto);
    if (photoByDoctorId.size) {
      hist = hist.map((entry) => {
        if (entry.image) return entry;
        const url = photoByDoctorId.get(String(entry.doctorId || ''));
        return url ? { ...entry, image: url } : entry;
      });
    }
    setConcerns(normalizeApiList(catRes).map(mapProductCategory).filter((item) => item.id));
    setDoctors(doctorsList);
    setSuggestedDoctors(suggestedList);
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
  // Prefer Suggested while loading; after load, Suggested if it has items, else Our doctors.
  const showSuggestedDoctors = loading || filteredSuggestedDoctors.length > 0;
  const showOurDoctors = !loading && filteredSuggestedDoctors.length === 0;

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


          {loading && !concerns.length && !doctors.length ? (
            <SkeletonGrid variant="doctor" count={4} label={T.loadingDoctors} />
          ) : (
            <>
              {showSuggestedDoctors ? (
                <Reveal
                  as="section"
                  className="hm-section hm-panel"
                  delay={120}
                  aria-labelledby="cs-suggested-doctors-title"
                >
                  <SectionHead
                    id="cs-suggested-doctors-title"
                    // eyebrow={T.topDoctorsEyebrow}
                    title={T.topDoctorsTitle}
                    description={T.suggestedDoctorsText}
                    action={
                      <ViewAll label={T.topDoctorsTitle} onClick={() => navigate('/consult/doctors')} />
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
                      aria-label={T.topDoctorsTitle}
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

              {showOurDoctors ? (
                <Reveal as="section" className="hm-section hm-panel" aria-labelledby="cs-doctors-title">
                  <SectionHead
                    id="cs-doctors-title"
                    // eyebrow={T.topDoctorsEyebrow}
                    title={T.topDoctorsTitle}
                    // description={T.doctorsText}
                    action={
                      <div className="am-head-tools">
                        {headActions}
                        <ViewAll label={T.topDoctorsTitle} onClick={() => navigate('/consult/doctors')} />
                      </div>
                    }
                  />
                  {filteredDoctors.length === 0 ? (
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
                    <ul className="am-doctor-grid am-doctor-grid--premium" aria-label={T.topDoctorsTitle}>
                      {filteredDoctors.slice(0, suggestedDoctorLimit).map((item) => (
                        <li key={getDoctorId(item) || item.full_name}>
                          <SuggestedDoctorCard item={item} fallbackSpeciality={H.ayurvedicDoctor} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Reveal>
              ) : null}
              <section className="hm-section hm-panel cs-promises" aria-label={T.promisesLabel}>
                <ul className="cs-promises__list">
                  {T.promises.map((item) => (
                    <li key={item.id} className="cs-promises__item">
                      <span className="cs-promises__icon">{PROMISE_ICONS[item.id]}</span>
                      <span className="cs-promises__label">{item.label}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {filteredHistory.length > 0 ? (
                <div className="hm-product-row">
                  <section className="hm-section hm-panel svc-rail-section" aria-labelledby="cs-recent-title">
                    <SectionHead
                      id="cs-recent-title"
                      title={T.recentTitle}
                      description="Consultations you booked recently."
                      action={<ViewAll label={T.recentTitle} onClick={() => navigate('/consult/history')} />}
                    />
                    <div className="svc-consult-grid">
                      {filteredHistory.map((item) => (
                        <ConsultationCard
                          key={item.consultationId || item.appointmentId || item.id}
                          item={item}
                          onOpen={openDetails}
                          onReceipt={(entry) => navigate(`/profile/receipts/${entry.consultationId}`)}
                          onBook={openSlots}
                        />
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}

              {concerns.length > 0 ? (
                <Reveal as="section" className="hm-section hm-panel hm-concerns-panel" aria-labelledby="cs-concerns-title">
                  <SectionHead
                    id="cs-concerns-title"
                    title={T.concernsTitle}
                    description={T.concernsText}
                  />
                  <ConcernCarousel label={T.concernsTitle}>
                    {concerns.map((item) => (
                      <Tile
                        cutout
                        key={item.id}
                        image={item.image_url}
                        icon={Stethoscope}
                        label={item.name}
                        onClick={() =>
                          navigate(
                            `/consult/concern/${item.id}?name=${encodeURIComponent(item.name)}${item.description ? `&desc=${encodeURIComponent(item.description)}` : ''
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
                    {/* {hasMore && products.length > 0 ? (
                      <div className="st-more">
                        <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                          {loadingMore ? T.loadingMore : T.loadMore}
                        </Button>
                      </div>
                    ) : null} */}
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
