import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Flower2,
  Leaf,
  LockKeyhole,
  Pill,
  RefreshCw,
  Salad,
  Search,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Users,
  Heart,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import DiseaseSelectionModal from '../components/DiseaseSelectionModal';
import { Utils } from '../common/utils';
import { getBannerImageUri } from '../home/catalog';
import {
  mapAppScreenToPath,
  resolveBannerNavigation,
  resolveServiceCategoryKey,
} from '../home/serviceCategories';
import useHomeData from '../hooks/useHomeData';
import SuggestedDoctorCard from '../components/SuggestedDoctorCard';
import DummyOfferCard from '../components/DummyOfferCard';
import ProductCard from '../components/ProductCard';
import HomeJoinAppointments from '../components/HomeJoinAppointments';
import { getDoctorId } from '../consult/doctors';
import { requireAuth } from '../services/guestAuth';
import useActiveDietHome from '../hooks/useActiveDietHome';
import useRecentVisitedDoctors from '../hooks/useRecentVisitedDoctors';
import useUpcomingAppointments from '../hooks/useUpcomingAppointments';
import BannerCarousel from '../components/BannerCarousel';
import {
  Button,
  Disclaimer,
  EmptyState,
  MediaCard,
  Modal,
  Rail,
  RailItem,
  RailSkeleton,
  Reveal,
  SectionHeader,
  Tile,
  ConcernCarousel,
} from '../components/ui';
import { HOME_COPY as T } from '../content/home';
import { DUMMY_CONSULT_PACKAGES, DUMMY_LAB_TESTS } from '../data/homeDummySections';
import '../design/pages/home.css';
import '../design/pages/dummy-offers.css';

let prakritiModalShownThisSession = false;
let diseaseModalShownThisSession = false;

const SERVICE_ICONS = {
  consult: Stethoscope,
  doctor: Stethoscope,
  medicine: Pill,
  medicines: Pill,
  products: ShoppingBag,
  yoga: Flower2,
  diet: Salad,
  diets: Salad,
  prakriti: Sparkles,
  packages: Heart,
  'care plan': Heart,
};

const HERO_TRUST = [
  { icon: BadgeCheck, label: T.trustDoctors },
  { icon: LockKeyhole, label: T.trustPayments },
  { icon: Leaf, label: T.trustAuthentic },
];

const PRAKRITI_BENEFITS = [
  { icon: Sparkles, label: 'Personalised recommendations' },
  { icon: Heart, label: 'Better health outcomes' },
  { icon: Users, label: 'Trusted by thousands' },
];

function CategoryRow({ items, renderItem }) {
  return (
    <ul className="hm-services__grid">
      {items.length
        ? items.map((item) => renderItem(item))
        : Array.from({ length: 7 }).map((_, index) => (
            <li key={`service-skel-${index}`}>
              <div className="hm-service is-skeleton" aria-hidden>
                <span className="hm-service__tile" />
                <span className="hm-service__label" />
              </div>
            </li>
          ))}
    </ul>
  );
}

function ViewAll({ onClick, label }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} trailingIcon={<ArrowRight size={16} aria-hidden />}>
      {T.viewAll}
      <span className="am-sr-only"> {label}</span>
    </Button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const {
    categories,
    doctors,
    storeProducts,
    medicineProducts,
    yogaSessions,
    dietProducts,
    customerData,
    banners,
    healthConcerns,
    sections,
    sectionLabels,
    loading,
    refreshing,
    loadingCustomer,
    medicineCategoryId,
    refreshHomeData,
    fetchCustomerData,
  } = useHomeData();
  const { preview: activeDietPreview } = useActiveDietHome();
  const { doctors: visitedDoctors, loading: loadingVisitedDoctors } = useRecentVisitedDoctors();
  const { appointments: upcomingAppointments, loading: loadingAppointments } =
    useUpcomingAppointments();

  const [name, setName] = useState('');
  const [activeHomeModal, setActiveHomeModal] = useState('none');
  const [showDiseaseModal, setShowDiseaseModal] = useState(false);
  const [showPrakritiModal, setShowPrakritiModal] = useState(false);

  const serviceList = useMemo(
    () => (Array.isArray(categories) ? categories.filter(Boolean) : []),
    [categories],
  );

  const bannerItems = useMemo(
    () =>
      (Array.isArray(banners) ? banners : [])
        .map((item) => ({ ...item, image: getBannerImageUri(item) }))
        .filter((item) => item.image),
    [banners],
  );

  useEffect(() => {
    (async () => {
      const info = await Utils.getData('_USER_INFO');
      setName(info?.first_name || customerData?.first_name || 'Guest');
    })();
  }, [customerData]);

  useEffect(() => {
    if (loadingCustomer || !customerData) return;
    if (activeHomeModal !== 'none') return;

    const hasDiseases =
      customerData?.has_health_diseases === true ||
      (Array.isArray(customerData?.health_diseases) &&
        customerData.health_diseases.length > 0) ||
      (Array.isArray(customerData?.health_disease_ids) &&
        customerData.health_disease_ids.length > 0);

    if (!hasDiseases && !diseaseModalShownThisSession) {
      diseaseModalShownThisSession = true;
      setActiveHomeModal('disease');
      setShowDiseaseModal(true);
      return;
    }

    const prakritiIncomplete =
      customerData?.prakriti_progress != null &&
      Number(customerData.prakriti_progress) < 100;

    if (prakritiIncomplete && !prakritiModalShownThisSession) {
      prakritiModalShownThisSession = true;
      setActiveHomeModal('prakriti');
      setShowPrakritiModal(true);
    }
  }, [loadingCustomer, customerData, activeHomeModal]);

  const onDiseaseModalDone = useCallback(
    async (saved) => {
      setShowDiseaseModal(false);
      setActiveHomeModal('none');
      if (saved) {
        try {
          await fetchCustomerData();
        } catch {
          // ignore
        }
      }
    },
    [fetchCustomerData],
  );

  const closePrakritiModal = () => {
    setShowPrakritiModal(false);
    setActiveHomeModal('none');
  };

  const handleCategoryPress = (item) => {
    const fromRedirect = resolveBannerNavigation({
      redirect_url: item?.redirect_url || item?.app_screen || item?.screen,
    });
    if (fromRedirect?.path && fromRedirect.path !== '/home') {
      navigate(fromRedirect.path);
      return;
    }
    const nameKey = item?.name?.trim().toLowerCase() ?? '';
    const serviceKey = resolveServiceCategoryKey(item) ?? nameKey;
    const path = mapAppScreenToPath(serviceKey);
    navigate(path && path !== '/home' ? path : '/products');
  };

  const renderServiceItem = (item) => {
    const key = resolveServiceCategoryKey(item) || String(item.name || '').toLowerCase();
    const image = item.image_url || item.image || item.icon_url;
    const Icon = SERVICE_ICONS[key] || Leaf;
    return (
      <li key={item.id}>
        <button
          type="button"
          className="hm-service"
          onClick={() => handleCategoryPress(item)}
        >
          <span className="hm-service__tile" aria-hidden>
            {image ? <img src={image} alt="" /> : <Icon size={28} />}
          </span>
          <span className="hm-service__label">{item.name}</span>
        </button>
      </li>
    );
  };

  const handleBannerPress = (item) => {
    const target = resolveBannerNavigation(item);
    if (!target) return;
    if (target.external) {
      window.open(target.href, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(target.path);
  };

  const prakritiProgress = Math.round(Number(customerData?.prakriti_progress) || 0);
  const prakritiComplete = prakritiProgress >= 100;

  const openPrakriti = async (allowBack = true) => {
    if (prakritiComplete) {
      navigate('/prakriti-profile');
      return;
    }
    if (!(await requireAuth('Complete your profile to start prakriti assessment'))) return;
    navigate('/patient-faq', { state: { allowBack } });
  };

  const prakritiName = String(
    customerData?.prakriti_type ||
      customerData?.prakriti_result ||
      customerData?.prakriti_name ||
      '',
  ).trim();

  const comingSoonItems = useMemo(() => {
    const items = [];
    if (!yogaSessions?.length && !dietProducts?.length) {
      items.push({ title: 'Diet & Yoga', icon: Salad });
    } else {
      if (!dietProducts?.length) items.push({ title: 'Diet plans', icon: Salad });
      if (!yogaSessions?.length) items.push({ title: 'Yoga', icon: Flower2 });
    }
    items.push({ title: 'Panchakarma', icon: Leaf });
    return items;
  }, [yogaSessions?.length, dietProducts?.length]);

  const hasAnyContent =
    bannerItems.length > 0 ||
    healthConcerns.length > 0 ||
    doctors.length > 0 ||
    medicineProducts.length > 0 ||
    storeProducts.length > 0 ||
    yogaSessions.length > 0 ||
    dietProducts.length > 0 ||
    Object.values(sections).some((items) => items?.length);

  const bannerCopy = {
    label: T.offersLabel,
    open: T.openOffer,
    of: T.of,
    show: T.showOffer,
    pause: T.pauseOffers,
    play: T.playOffers,
  };

  const showVisitedDoctors =
    (loadingVisitedDoctors && visitedDoctors.length === 0) || visitedDoctors.length > 0;
  const showSuggestedDoctors = (loading && !doctors.length) || doctors.length > 0;
  const splitDoctorRow = showVisitedDoctors && showSuggestedDoctors;
  const visitedRowRef = useRef(null);
  const suggestedRowRef = useRef(null);
  const [visitedOverflow, setVisitedOverflow] = useState(false);
  const [suggestedOverflow, setSuggestedOverflow] = useState(false);
  const suggestedDoctors = doctors.slice(0, 4);

  useEffect(() => {
    const measure = () => {
      const overflows = (node) => Boolean(node && node.scrollWidth > node.clientWidth + 1);
      setVisitedOverflow(overflows(visitedRowRef.current));
      setSuggestedOverflow(overflows(suggestedRowRef.current));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (visitedRowRef.current) observer?.observe(visitedRowRef.current);
    if (suggestedRowRef.current) observer?.observe(suggestedRowRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [visitedDoctors.length, suggestedDoctors.length, splitDoctorRow]);

  const renderProductRail = (items, label) => (
    <Rail label={label}>
      {items.map((item) => (
        <RailItem key={`${item.variant_id || item.id}`} size="product">
          <ProductCard item={item} />
        </RailItem>
      ))}
    </Rail>
  );

  return (
    <AppShell tab="home">
      <div className="hm-page">
        <section className="hm-hero" aria-labelledby="hm-hero-title">
          <div className="hm-hero__inner"style={{ marginTop: "20px",padding:"54px", marginBottom: "25px" }}>
            
            
            <div className="hm-hero__copy">
              <p className="hm-hero__hello">
                {name ? `NAMASTE, ${name.toUpperCase()}` : 'NAMASTE'}
              </p>

              <h1 id="hm-hero-title" className="hm-hero__title">
                Ayurveda care,{' '}<br />
                made <span className="hm-hero__gold">personal.</span>
              </h1>
              <p className="hm-hero__lede">{T.heroLede}</p>

              <div className="hm-hero__ctas">
                <Button
                  variant="accent"
                  size="lg"
                  className="hm-hero__primary"
                  onClick={() => navigate('/consult')}
                  leadingIcon={<Stethoscope size={16} aria-hidden />}
                  trailingIcon={<ArrowRight size={16} aria-hidden />}
                >
                  {T.ctaConsult}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="hm-hero__ghost"
                  onClick={() => navigate('/medicines')}
                  leadingIcon={<Leaf size={16} aria-hidden />}
                >
                  {T.ctaMedicines}
                </Button>
              </div>

              <button type="button" className="hm-search" onClick={() => navigate('/search')}>
                <Search size={18} aria-hidden />
                <span>{T.searchPlaceholder}</span>
                <span className="hm-search__go" aria-hidden>
                  <ArrowRight size={16} />
                </span>
              </button>

              <ul className="hm-hero__trust">
                {HERO_TRUST.map(({ icon: Icon, label }) => (
                  <li key={label}>
                    <Icon size={16} aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="hm-hero__artwork" aria-hidden>
              <img src="/home/hero-still-life.png?v=1" alt="" />
            </div>

            <aside className="hm-prakriti" aria-labelledby="hm-prakriti-title">
              <img className="hm-prakriti__art" src="/home/prakriti-meditation.jpg" alt="" />
              <div className="hm-prakriti__head">
                <span className="hm-prakriti__icon" aria-hidden>
                  <Sparkles size={15} />
                </span>
                <p className="hm-prakriti__eyebrow">
                  {prakritiComplete ? T.prakritiDoneEyebrow : 'Your Prakriti'}
                </p>
              </div>
              <h2 id="hm-prakriti-title" className="hm-prakriti__title">
                {prakritiComplete ? (prakritiName || T.prakritiDoneFallback) : T.prakritiDoneFallback}
              </h2>
              <p className="hm-prakriti__text">{T.prakritiDoneText}</p>
              <button
                type="button"
                className="hm-prakriti__cta"
                onClick={() => openPrakriti(true)}
              >
                {prakritiComplete ? T.prakritiView : T.prakritiStart}
                <ArrowRight size={16} aria-hidden />
              </button>
              <ul className="hm-prakriti__benefits">
                {PRAKRITI_BENEFITS.map(({ icon: Icon, label }) => (
                  <li key={label}>
                    <span className="hm-prakriti__benefit-icon" aria-hidden>
                      <Icon size={14} />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <div className="hm-body">
          <section className="hm-section hm-services" aria-labelledby="hm-services-title">
            <h2 id="hm-services-title" className="am-sr-only">
              {T.servicesTitle}
            </h2>
            <CategoryRow items={serviceList} renderItem={renderServiceItem} />
          </section>

          <div className="hm-dash">
            <div className="hm-dash__main">
              <BannerCarousel
                items={bannerItems}
                onSelect={handleBannerPress}
                loading={loading}
                copy={bannerCopy}
              />
            </div>

            {activeDietPreview || loadingAppointments || upcomingAppointments?.length ? (
              <aside className="hm-dash__side" aria-label={T.yourPlan}>
                {activeDietPreview ? (
                  <article className="hm-diet">
                    <div className="hm-diet__img">
                      {activeDietPreview.thumbnailUrl ? (
                        <img src={activeDietPreview.thumbnailUrl} alt="" loading="lazy" />
                      ) : (
                        <Salad size={26} aria-hidden />
                      )}
                    </div>
                    <div className="hm-diet__body">
                      <p className="am-eyebrow">{T.activeDiet}</p>
                      <h2 className="hm-diet__title">
                        <button
                          type="button"
                          className="am-stretched"
                          onClick={() => navigate(`/diet/${activeDietPreview.planId}`)}
                        >
                          {activeDietPreview.title}
                        </button>
                      </h2>
                      <p className="hm-diet__meta">
                        {T.day} {activeDietPreview.currentDay}/{activeDietPreview.totalDays} ·{' '}
                        {activeDietPreview.progressPercent}%
                      </p>
                      <div
                        className="hm-progress hm-progress--sm"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Number(activeDietPreview.progressPercent) || 0}
                        aria-label={T.dietProgressLabel}
                      >
                        <span style={{ '--hm-progress': `${Number(activeDietPreview.progressPercent) || 0}%` }} />
                      </div>
                      {activeDietPreview.focusLabel ? (
                        <p className="hm-diet__focus">{activeDietPreview.focusLabel}</p>
                      ) : null}
                    </div>
                  </article>
                ) : null}
                <HomeJoinAppointments appointments={upcomingAppointments} loading={loadingAppointments} />
              </aside>
            ) : null}
          </div>

          {healthConcerns.length > 0 ? (
            <Reveal as="section" className="hm-section" aria-labelledby="hm-concerns-title">
              <SectionHeader
                id="hm-concerns-title"
                align="center"
                eyebrow={T.concernsEyebrow}
                title={T.concernsTitle}
                description={T.concernsText}
                action={healthConcerns.length > 1 ? <ViewAll label={T.concernsTitle} onClick={() => navigate('/consult')} /> : null}
              />
              <ConcernCarousel label={T.concernsTitle}>
                {healthConcerns.map((item) => (
                  <Tile
                    cutout
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
              </ConcernCarousel>
            </Reveal>
          ) : null}

          {showVisitedDoctors || showSuggestedDoctors ? (
            <div className={splitDoctorRow ? 'hm-doctor-row hm-doctor-row--split' : 'hm-doctor-row'}>
              {loadingVisitedDoctors && visitedDoctors.length === 0 ? (
                <section className="hm-section" aria-busy="true">
                  <SectionHeader title={T.visitedTitle} />
                  <RailSkeleton variant="doctor" />
                </section>
              ) : null}

              {visitedDoctors.length > 0 ? (
                <Reveal as="section" className="hm-section" aria-labelledby="hm-visited-title">
                  <SectionHeader
                    id="hm-visited-title"
                    title={T.visitedTitle}
                    action={
                      visitedOverflow ? (
                        <ViewAll label={T.visitedTitle} onClick={() => navigate('/consult')} />
                      ) : null
                    }
                  />
                  <ul
                    ref={visitedRowRef}
                    className="am-doctor-grid am-doctor-grid--portrait"
                    aria-label={T.visitedTitle}
                  >
                    {visitedDoctors.map((item) => (
                      <li key={item.doctor_id || item.id}>
                        <SuggestedDoctorCard item={item} fallbackSpeciality={T.ayurvedicDoctor} />
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ) : null}

              {loading && !doctors.length ? (
                <section className="hm-section" aria-busy="true">
                  <SectionHeader title={T.doctorsTitle} />
                  <RailSkeleton variant="doctor" />
                </section>
              ) : null}

              {doctors.length > 0 ? (
                <Reveal as="section" className="hm-section" aria-labelledby="hm-doctors-title">
                  <SectionHeader
                    id="hm-doctors-title"
                    title={T.doctorsTitle}
                    action={
                      doctors.length > suggestedDoctors.length || suggestedOverflow ? (
                        <ViewAll label={T.doctorsTitle} onClick={() => navigate('/consult/doctors')} />
                      ) : null
                    }
                  />
                  <ul
                    ref={suggestedRowRef}
                    className="am-doctor-grid am-doctor-grid--portrait"
                    aria-label={T.doctorsTitle}
                  >
                    {suggestedDoctors.map((item) => (
                      <li key={getDoctorId(item) || item.id}>
                        <SuggestedDoctorCard item={item} />
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ) : null}
            </div>
          ) : null}

          {loading && !medicineProducts.length ? (
            <section className="hm-section" aria-busy="true">
              <SectionHeader title={T.medicinesTitle} />
              <RailSkeleton />
            </section>
          ) : null}

          {medicineProducts.length > 0 ? (
            <Reveal as="section" className="hm-section" aria-labelledby="hm-medicines-title">
              <SectionHeader
                id="hm-medicines-title"
                title={T.medicinesTitle}
                action={medicineProducts.length > 1 ? <ViewAll label={T.medicinesTitle} onClick={() => navigate('/medicines')} /> : null}
              />
              {renderProductRail(medicineProducts, T.medicinesTitle)}
            </Reveal>
          ) : null}

          {loading && !storeProducts.length ? (
            <section className="hm-section" aria-busy="true">
              <SectionHeader title={T.productsTitle} />
              <RailSkeleton />
            </section>
          ) : null}

          {storeProducts.length > 0 ? (
            <Reveal as="section" className="hm-section" aria-labelledby="hm-products-title">
              <SectionHeader
                id="hm-products-title"
                title={T.productsTitle}
                action={storeProducts.length > 1 ? <ViewAll label={T.productsTitle} onClick={() => navigate('/products')} /> : null}
              />
              {renderProductRail(storeProducts, T.productsTitle)}
            </Reveal>
          ) : null}

          {Object.entries(sections).map(([key, items]) =>
            items?.length ? (
              <Reveal as="section" className="hm-section" key={key} aria-labelledby={`hm-sec-${key}`}>
                <SectionHeader
                  id={`hm-sec-${key}`}
                  title={sectionLabels[key] || key}
                  action={items.length > 1 ? <ViewAll label={sectionLabels[key] || key} onClick={() => navigate('/products')} /> : null}
                />
                {renderProductRail(items, sectionLabels[key] || key)}
              </Reveal>
            ) : null,
          )}

          {yogaSessions.length > 0 ? (
            <Reveal as="section" className="hm-section" aria-labelledby="hm-yoga-title">
              <SectionHeader
                id="hm-yoga-title"
                eyebrow={T.yogaEyebrow}
                title={T.yogaTitle}
                action={yogaSessions.length > 1 ? <ViewAll label={T.yogaTitle} onClick={() => navigate('/yoga')} /> : null}
              />
              <Rail label={T.yogaTitle}>
                {yogaSessions.map((item) => (
                  <RailItem key={item.id} size="wide">
                    <MediaCard
                      image={item.thumbnail_url}
                      title={item.title}
                      subtitle={item.short_description}
                      fallbackIcon={Flower2}
                      onClick={() => navigate(`/yoga/${item.id}`, { state: { item } })}
                    />
                  </RailItem>
                ))}
              </Rail>
            </Reveal>
          ) : null}

          {dietProducts.length > 0 ? (
            <Reveal as="section" className="hm-section" aria-labelledby="hm-diet-title">
              <SectionHeader
                id="hm-diet-title"
                eyebrow={T.dietEyebrow}
                title={T.dietTitle}
                action={<ViewAll label={T.dietTitle} onClick={() => navigate('/diet?view=all')} />}
              />
              <Rail label={T.dietTitle}>
                {dietProducts.map((item) => (
                  <RailItem key={item.id} size="wide">
                    <MediaCard
                      image={item.thumbnail_url}
                      title={item.title}
                      subtitle={item.short_description}
                      fallbackIcon={Salad}
                      onClick={() => navigate(`/diet/${item.id}`, { state: { item } })}
                    />
                  </RailItem>
                ))}
              </Rail>
            </Reveal>
          ) : null}

          <Reveal as="section" className="hm-section" aria-labelledby="hm-packages-title">
            <SectionHeader
              id="hm-packages-title"
              title={T.packagesTitle}
              action={<ViewAll label={T.packagesTitle} onClick={() => navigate('/packages')} />}
            />
            <Rail label={T.packagesTitle}>
              {DUMMY_CONSULT_PACKAGES.slice(0, 6).map((item) => (
                <RailItem key={item.id} size="product">
                  <DummyOfferCard item={item} kind="package" onClick={() => navigate('/packages')} />
                </RailItem>
              ))}
            </Rail>
          </Reveal>

          <Reveal as="section" className="hm-section" aria-labelledby="hm-lab-title">
            <SectionHeader
              id="hm-lab-title"
              title={T.labTitle}
              action={<ViewAll label={T.labTitle} onClick={() => navigate('/labs')} />}
            />
            <Rail label={T.labTitle}>
              {DUMMY_LAB_TESTS.map((item) => (
                <RailItem key={item.id} size="product">
                  <DummyOfferCard item={item} kind="lab" onClick={() => navigate('/labs')} />
                </RailItem>
              ))}
            </Rail>
          </Reveal>

          {!loading && !hasAnyContent ? (
            <EmptyState
              icon={<Leaf size={28} />}
              title={T.emptyTitle}
              description={T.emptyText}
              action={
                <Button
                  variant="secondary"
                  loading={refreshing}
                  onClick={refreshHomeData}
                  leadingIcon={<RefreshCw size={16} aria-hidden />}
                >
                  {T.refresh}
                </Button>
              }
            />
          ) : null}

          {comingSoonItems.length > 0 ? (
            <section className="hm-section hm-soon" aria-labelledby="hm-soon-title">
              <h2 id="hm-soon-title" className="hm-soon__title">
                {T.soonTitle}
              </h2>
              <ul className="hm-soon__list">
                {comingSoonItems.map(({ title, icon: Icon }) => (
                  <li key={title}>
                    <Icon size={16} aria-hidden />
                    {title}
                    <span className="am-badge am-badge--accent">{T.soon}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <footer className="hm-foot">
            <Disclaimer variant="banner" />
            {hasAnyContent ? (
              <Button
                variant="ghost"
                size="sm"
                loading={refreshing}
                onClick={refreshHomeData}
                leadingIcon={<RefreshCw size={14} aria-hidden />}
              >
                {refreshing ? T.refreshing : T.refresh}
              </Button>
            ) : null}
          </footer>
        </div>
      </div>

      <DiseaseSelectionModal
        visible={showDiseaseModal && activeHomeModal === 'disease'}
        serviceCategoryId={medicineCategoryId}
        onDone={onDiseaseModalDone}
      />

      <Modal
        open={Boolean(showPrakritiModal && activeHomeModal === 'prakriti' && customerData && !loadingCustomer)}
        onClose={closePrakritiModal}
        size="sm"
        title={T.prakritiModalTitle}
        description={T.prakritiModalText}
        footer={
          <>
            <Button variant="secondary" onClick={closePrakritiModal}>
              {T.later}
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={async () => {
                closePrakritiModal();
                await openPrakriti(false);
              }}
            >
              {T.completeNow}
            </Button>
          </>
        }
      >
        <div
          className="hm-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={prakritiProgress}
          aria-label={T.prakritiProgressLabel}
        >
          <span style={{ '--hm-progress': `${prakritiProgress}%` }} />
        </div>
        <p className="hm-prakriti__meta">
          {prakritiProgress}% {T.complete}
        </p>
      </Modal>
    </AppShell>
  );
}
