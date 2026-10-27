import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Flower2,
  Leaf,
  LockKeyhole,
  Pill,
  Play,
  RefreshCw,
  Salad,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
  Users,
  Heart,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import DiseaseSelectionModal from '../components/DiseaseSelectionModal';
// TEMP hidden per Rohit — Health Lab section commented out below
// import LabHomeBanner from '../components/LabHomeBanner';
import { Utils } from '../common/utils';
import { getBannerImageUri, resolveImageUrl } from '../home/catalog';
import useBrands from '../hooks/useBrands';
import {
  mapAppScreenToPath,
  resolveBannerNavigation,
  resolveServiceCategoryKey,
} from '../home/serviceCategories';
import useHomeData from '../hooks/useHomeData';
import { useLazySection, useSectionQueue } from '../hooks/useLazySection';
import { getDoctors } from '../services/consultService';
import { isAuthenticated, requireAuth } from '../services/guestAuth';
import {
  doctorDisplayName,
  doctorExperience,
  doctorFeeLabel,
  doctorImage,
  doctorQualification,
  doctorRating,
  getDoctorId,
  normalizeDoctorList,
  resolveDoctorSpecializations,
} from '../consult/doctors';
import DoctorTable from '../components/DoctorTable';
import VisitedDoctorList from '../components/VisitedDoctorList';
import '../components/visited-doctors.css';
import DummyOfferCard from '../components/DummyOfferCard';
import ProductCard from '../components/ProductCard';
import HomeJoinAppointments from '../components/HomeJoinAppointments';
import '../design/pages/home-pair.css';

import useRecentVisitedDoctors from '../hooks/useRecentVisitedDoctors';
import useUpcomingAppointments from '../hooks/useUpcomingAppointments';
import BannerCarousel from '../components/BannerCarousel';
import { ActiveDietCard, ActiveDietToast } from '../components/ActiveDietPlan';
import useActiveDietHome from '../hooks/useActiveDietHome';
import {
  Button,
  EmptyState,
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
// TEMP hidden per Rohit — DUMMY_LAB_TESTS, DUMMY_PANCHAKARMA unused while Lab/Panchakarma are hidden
import { DUMMY_CONSULT_PACKAGES } from '../data/homeDummySections';
import { loadConsultPackages } from '../services/packageService';
import '../design/pages/home.css';
import '../design/pages/dummy-offers.css';
import '../design/pages/orange-lab.css';

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

const HERO_VIDEO = '/videos/hero-herbal-wellness.mp4';

function HeroBackgroundVideo() {
  const videoRef = useRef(null);
  const [src, setSrc] = useState('');
  const [reduced] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  );

  // Desktop only: phones and tablets never request the video.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => setSrc(media.matches ? HERO_VIDEO : '');
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    video.muted = true;
    if (reduced) video.pause();
    else video.play?.().catch(() => {});
  }, [src, reduced]);

  return (
    <div className="hm-hero__bg" aria-hidden>
      {src ? (
        <video
          ref={videoRef}
          className="hm-hero__bg-video"
          src={reduced ? `${src}#t=0.1` : src}
          autoPlay={!reduced}
          muted
          loop
          playsInline
          preload={reduced ? 'metadata' : 'auto'}
          disablePictureInPicture
          tabIndex={-1}
        />
      ) : null}
    </div>
  );
}

function CategoryRow({ items, renderItem }) {
  const listRef = useRef(null);
  const [carousel, setCarousel] = useState(false);
  const [revealed, setRevealed] = useState(
    () =>
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const measure = () => {
      setCarousel(list.scrollWidth > list.clientWidth + 4);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [items]);

  // Start at the first item (no auto-advance) and reveal tiles on scroll.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    list.scrollLeft = 0;
    if (revealed) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(list);
    return () => io.disconnect();
  }, [items, revealed]);

  return (
    <ul
      ref={listRef}
      className={[
        'hm-services__grid',
        carousel && 'is-carousel',
        revealed && 'is-revealed',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-roledescription={carousel ? 'carousel' : undefined}
    >
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

function ViewAll({ onClick, label, plain = false, className }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={[plain ? 'hm-doctor-head__link' : '', className].filter(Boolean).join(' ') || undefined}
      onClick={onClick}
      trailingIcon={<ArrowRight size={16} aria-hidden />}
    >
      {T.viewAll}
      <span className="am-sr-only"> {label}</span>
    </Button>
  );
}

function shortLabel(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 28) return '';
  return text;
}

const OUR_DOCTORS_LIMIT = 10;

/** "Our doctors" rail — customers/doctors/ (needs a token; shown for guests and full users, hidden when logged out, empty or failed (401/403)). */
function useOurDoctors(enabled) {
  const [items, setItems] = useState([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    (async () => {
      try {
        // Guests are OTP-verified and hold a token; only logged-out visitors skip the call.
        if (!(await isAuthenticated())) return;
        const res = await getDoctors({ page: 1, page_size: OUR_DOCTORS_LIMIT });
        if (!alive || !res || res.success === false) return;
        const list = normalizeDoctorList(res, { approvedOnly: true }).filter((d) => getDoctorId(d));
        setItems(list.slice(0, OUR_DOCTORS_LIMIT));
      } catch {
        // section stays hidden
      } finally {
        if (alive) setDone(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);
  return [items, done];
}

/** Explicit approval flag from the API (not the permissive list filter default). */
const hasApprovalFlag = (d) => {
  const status = String(d?.approval_status ?? d?.verification_status ?? '').trim().toLowerCase();
  if (['approved', 'verified'].includes(status)) return true;
  const flag = d?.is_approved ?? d?.is_verified;
  return flag === true || flag === 'true' || flag === 1 || flag === '1';
};

function OurDoctorCard({ item, index, onOpen }) {
  const name = doctorDisplayName(item);
  const image = doctorImage(item);
  const qualification = doctorQualification(item);
  const specs = resolveDoctorSpecializations(item).slice(0, 2).join(', ');
  const experience = doctorExperience(item);
  const rating = doctorRating(item);
  const fee = doctorFeeLabel(item);
  const verified = hasApprovalFlag(item);
  const line = [qualification, specs && specs !== qualification ? specs : ''].filter(Boolean);

  return (
    <article className="hm-odoc" style={{ '--hm-odoc-i': Math.min(index, 6) }}>
      <span className="hm-odoc__photo">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" width="52" height="52" />
        ) : (
          <span aria-hidden>{name.charAt(0)}</span>
        )}
      </span>
      <div className="hm-odoc__id">
        <h3 className="hm-odoc__name">
          <span>{name}</span>
          {verified ? <BadgeCheck className="hm-odoc__tick" size={15} aria-label="Verified" /> : null}
        </h3>
        {line.length ? (
          <p className="hm-odoc__line">
            {line.map((part, i) => (
              <span key={part} className={i ? 'hm-odoc__spec' : 'hm-odoc__qual'}>
                {part}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <div className="hm-odoc__foot">
        {experience || rating || fee ? (
          <ul className="hm-odoc__meta">
            {experience ? <li>{experience}</li> : null}
            {rating ? (
              <li>
                <Star size={11} aria-hidden /> {rating}
              </li>
            ) : null}
            {fee ? (
              <li className="hm-odoc__fee">
                <strong>{fee}</strong>
              </li>
            ) : null}
          </ul>
        ) : null}
        <button type="button" className="hm-odoc__cta am-stretched" onClick={onOpen}>
          Consult
          <ArrowRight size={13} aria-hidden />
        </button>
      </div>
    </article>
  );
}

function YogaSessionCard({ item, onClick }) {
  const level = shortLabel(item.difficulty);
  const duration = shortLabel(item.duration);

  return (
    <article className="hm-pose">
      <div className="hm-pose__media">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" loading="lazy" decoding="async" />
        ) : (
          <Flower2 size={28} aria-hidden />
        )}
        <span className="hm-pose__play" aria-hidden>
          <Play size={16} fill="currentColor" />
        </span>
        {level ? <span className="hm-pose__level">{level}</span> : null}
      </div>
      <div className="hm-pose__copy">
        <h3>
          <button type="button" className="am-stretched" onClick={onClick}>
            {item.title}
          </button>
        </h3>
        {duration ? <p>{duration}</p> : null}
      </div>
    </article>
  );
}

function DietPlanCard({ item, onClick }) {
  const season = shortLabel(item.season) || shortLabel(item.short_description);
  const prakriti = shortLabel(item.prakriti);

  return (
    <article className="hm-meal">
      <div className="hm-meal__media">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" loading="lazy" decoding="async" />
        ) : (
          <Salad size={28} aria-hidden />
        )}
      </div>
      <div className="hm-meal__copy">
        {season ? <p className="hm-meal__season">{season}</p> : null}
        <h3>
          <button type="button" className="am-stretched" onClick={onClick}>
            {item.title}
          </button>
        </h3>
        {prakriti ? <p>{prakriti}</p> : null}
      </div>
    </article>
  );
}

function DoctorRailHeader({ id, eyebrow, title, description, onViewAll, reserveEyebrow = false }) {
  return (
    <div className="hm-doctor-head">
      {eyebrow ? (
        <p className="am-eyebrow">{eyebrow}</p>
      ) : reserveEyebrow ? (
        <p className="am-eyebrow" aria-hidden="true">
          &nbsp;
        </p>
      ) : null}
      <div className="hm-doctor-head__row">
        <h2 id={id} className="hm-doctor-head__title">
          {title}
        </h2>
        <ViewAll plain label={title} onClick={onViewAll} />
      </div>
      {description ? <p className="hm-doctor-head__desc">{description}</p> : null}
    </div>
  );
}

/** Below-the-fold wrapper: a fixed-height placeholder until its data has loaded, then it
 *  disappears from layout (display: contents) so the section renders exactly as before. */
/** Home sections in visual order; each starts after the previous one finishes (or times out). */
const HOME_SECTION_ORDER = [
  'critical', // profile + service categories (hero, services row)
  'pair', // upcoming appointment + active diet
  'banners',
  'concerns',
  'ourDoctors',
  'brands',
  'doctors', // visited + suggested
  'products',
  'yoga',
  'diet',
];
const SECTION_STEP_TIMEOUT_MS = 3000;
// Scrolling bumps a section only after the user actually scrolls; initial load stays strictly ordered.
const BUMP_AFTER_SCROLL = { requireScroll: true };
const DATA_SECTIONS = ['banners', 'concerns', 'doctors', 'products', 'yoga', 'diet'];

function LazyBlock({ blockRef, done, minHeight, skeleton = null, children }) {
  return (
    <div
      ref={blockRef}
      className="hm-lazy"
      style={done ? { display: 'contents' } : { minHeight }}
      aria-busy={done ? undefined : true}
    >
      {done ? children : skeleton}
    </div>
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
    bannersLoading,
    allSectionsDone,
    isSectionDone,
    loadSection,
    refreshing,
    loadingCustomer,
    medicineCategoryId,
    refreshHomeData,
    fetchCustomerData,
  } = useHomeData();
  const secondaryReady = !loading;
  const [consultPackages, setConsultPackages] = useState(DUMMY_CONSULT_PACKAGES);
  useEffect(() => {
    let cancelled = false;
    loadConsultPackages()
      .then((rows) => {
        if (!cancelled && rows.length) setConsultPackages(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  // All Home APIs load on mount, one section after another in visual order (top to bottom).
  // Scrolling to a section that has not started yet bumps it to load immediately.
  const queue = useSectionQueue(HOME_SECTION_ORDER, { timeout: SECTION_STEP_TIMEOUT_MS });
  const { isStarted, markDone, bump } = queue;
  const [concernsRef] = useLazySection(() => bump('concerns'), BUMP_AFTER_SCROLL);
  const [ourDocsRef] = useLazySection(() => bump('ourDoctors'), BUMP_AFTER_SCROLL);
  const [brandsRef] = useLazySection(() => bump('brands'), BUMP_AFTER_SCROLL);
  const [doctorRowRef] = useLazySection(() => bump('doctors'), BUMP_AFTER_SCROLL);
  const [productsRef] = useLazySection(() => bump('products'), BUMP_AFTER_SCROLL);
  const [wellnessRef] = useLazySection(() => {
    bump('yoga');
    bump('diet');
  }, BUMP_AFTER_SCROLL);
  const pairStarted = isStarted('pair');
  const ourDocsSeen = isStarted('ourDoctors');
  const brandsSeen = isStarted('brands');
  const doctorRowSeen = isStarted('doctors');
  const { doctors: visitedDoctors, loading: loadingVisitedDoctors } =
    useRecentVisitedDoctors(secondaryReady && doctorRowSeen);
  const [ourDoctors, ourDoctorsDone] = useOurDoctors(secondaryReady && ourDocsSeen);
  const { appointments: upcomingAppointments, loading: loadingAppointments } =
    useUpcomingAppointments(50, pairStarted);
  const { preview: activeDiet } = useActiveDietHome(pairStarted);
  const { brands, loading: brandsLoading } = useBrands(brandsSeen);

  // Drive the section queue: start useHomeData sections when their turn comes, report completion.
  useEffect(() => {
    DATA_SECTIONS.forEach((key) => {
      if (isStarted(key)) loadSection(key);
      if (isSectionDone(key)) markDone(key);
    });
  }, [isStarted, isSectionDone, loadSection, markDone]);
  useEffect(() => {
    if (!loading) markDone('critical');
  }, [loading, markDone]);
  const pairWasLoading = useRef(false);
  useEffect(() => {
    if (!pairStarted) return;
    if (loadingAppointments) pairWasLoading.current = true;
    else if (pairWasLoading.current) markDone('pair');
  }, [pairStarted, loadingAppointments, markDone]);
  useEffect(() => {
    if (ourDoctorsDone) markDone('ourDoctors');
  }, [ourDoctorsDone, markDone]);
  useEffect(() => {
    if (brandsSeen && !brandsLoading) markDone('brands');
  }, [brandsSeen, brandsLoading, markDone]);

  const [name, setName] = useState('');
  const [activeHomeModal, setActiveHomeModal] = useState('none');
  const [showDiseaseModal, setShowDiseaseModal] = useState(false);
  const [showPrakritiModal, setShowPrakritiModal] = useState(false);

  const serviceList = useMemo(() => {
    const list = Array.isArray(categories) ? categories.filter(Boolean) : [];
    const isLab = (item) =>
      /lab/i.test(`${item?.name || ''} ${item?.redirect_url || item?.app_screen || ''}`);
    // Health Lab disabled per Rohit: lab service tiles hidden (was: [...nonLab, ...lab]).
    return list.filter((item) => !isLab(item));
  }, [categories]);

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
    const nameKey = item?.name?.trim().toLowerCase() ?? '';
    // Health Lab disabled per Rohit
    // if (/lab/i.test(`${nameKey} ${item?.redirect_url || item?.app_screen || item?.screen || ''}`)) {
    //   navigate('/labs');
    //   return;
    // }
    if (/panchakarma|panchkarma/i.test(`${nameKey} ${item?.redirect_url || item?.app_screen || item?.screen || ''}`)) {
      navigate('/panchakarma');
      return;
    }
    const fromRedirect = resolveBannerNavigation({
      redirect_url: item?.redirect_url || item?.app_screen || item?.screen,
    });
    if (fromRedirect?.path && fromRedirect.path !== '/home') {
      navigate(fromRedirect.path);
      return;
    }
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
  // Rohit: homepage shows max 2 visited and 3 suggested doctors; View all opens the full list.
  const recentDoctors = visitedDoctors.slice(0, 2);
  const suggestedDoctors = doctors.slice(0, 3);
  const featuredProducts = sections.featured || [];
  const recentProducts = sections.recently_viewed || [];

  // Product-type panels pack two per row; an odd last panel spans the row.
  const productPanels = [
    { key: 'medicines', title: T.medicinesTitle, items: medicineProducts, to: '/medicines' },
    { key: 'products', title: T.productsTitle, items: storeProducts, to: '/products' },
    { key: 'recently_viewed', title: sectionLabels.recently_viewed, items: recentProducts, to: '/products' },
    { key: 'trending', title: sectionLabels.trending, description: T.trendingText, items: sections.trending || [], to: '/products' },
    { key: 'featured', title: sectionLabels.featured, description: T.featuredText, items: featuredProducts, to: '/products' },
  ].filter((panel) => panel.items?.length > 0);

  const renderProductRail = (items, label, auto = false) => (
    <Rail label={label} auto={auto}>
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
          <HeroBackgroundVideo />
          <div className="hm-hero__inner">
            
            
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

            {/* Empty slot keeps the original 3-column hero geometry. */}
            <div className="hm-hero__artwork" aria-hidden>
              <span className="hm-hero__spacer" />
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
                {prakritiComplete ? prakritiName || T.prakritiDoneFallback : T.prakritiTitle}
              </h2>
              <p className="hm-prakriti__text">
                {prakritiComplete ? T.prakritiDoneText : T.prakritiText}
              </p>
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

          {/* Upcoming appointment + active diet plan share one row (stacks on mobile). */}
          <div className="hm-pair">
            <HomeJoinAppointments appointments={upcomingAppointments} loading={loadingAppointments} />
            <ActiveDietCard plan={activeDiet} />
          </div>
          <ActiveDietToast plan={activeDiet} />

          {bannersLoading || bannerItems.length ? (
          <div className="hm-dash">
            <div className="hm-dash__main">
              <BannerCarousel
                items={bannerItems}
                initialIndex={0}
                interval={6000}
                onSelect={handleBannerPress}
                loading={bannersLoading}
                copy={bannerCopy}
              />
            </div>
          </div>
          ) : null}

          <LazyBlock blockRef={concernsRef} done={isSectionDone('concerns')} minHeight={240} skeleton={<RailSkeleton />}>
          {healthConcerns.length > 0 ? (
            <Reveal as="section" className="hm-section hm-panel hm-concerns-panel" aria-labelledby="hm-concerns-title">
              <SectionHeader
                id="hm-concerns-title"
                className="hm-concerns-head"
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
          </LazyBlock>

          <LazyBlock blockRef={ourDocsRef} done={ourDoctorsDone} minHeight={320} skeleton={<RailSkeleton variant="doctor" />}>
          {ourDoctors.length > 0 ? (
            <Reveal as="section" className="hm-section hm-panel hm-odocs" aria-labelledby="hm-odocs-title">
              <SectionHeader
                className="hm-head-inline"
                id="hm-odocs-title"
                title="Our doctors"
                description="Certified Ayurvedic experts, ready to consult."
                action={<ViewAll label="Our doctors" onClick={() => navigate('/consult/doctors')} />}
              />
              <Rail label="Our doctors">
                {ourDoctors.map((item, index) => {
                  const id = getDoctorId(item);
                  return (
                    <RailItem key={id}>
                      <OurDoctorCard
                        item={item}
                        index={index}
                        onOpen={() => navigate(`/consult/doctors/${id}`)}
                      />
                    </RailItem>
                  );
                })}
              </Rail>
            </Reveal>
          ) : null}
          </LazyBlock>

          <LazyBlock blockRef={brandsRef} done={brandsSeen && !brandsLoading} minHeight={180} skeleton={<RailSkeleton />}>
          {brands.length > 0 ? (
            <Reveal as="section" className="hm-section hm-panel hm-brands-panel" aria-labelledby="hm-brands-title">
              <SectionHeader
                className="hm-head-inline"
                id="hm-brands-title"
                title={T.brandsTitle}
                description={T.brandsText}
              />
              <ConcernCarousel label={T.brandsTitle}>
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
                        )}${medicineCategoryId ? `&service=${medicineCategoryId}` : ''}`,
                      )
                    }
                  />
                ))}
              </ConcernCarousel>
            </Reveal>
          ) : null}
          </LazyBlock>

          <LazyBlock blockRef={doctorRowRef} done={doctorRowSeen} minHeight={360}>
          {showVisitedDoctors || showSuggestedDoctors ? (
            <div className={splitDoctorRow ? 'hm-doctor-row hm-doctor-row--split' : 'hm-doctor-row'}>
              {loadingVisitedDoctors && visitedDoctors.length === 0 ? (
                <section className="hm-section" aria-busy="true">
                  <DoctorRailHeader
                    title={T.visitedTitle}
                    description={T.visitedText}
                    onViewAll={() => navigate('/consult')}
                  />
                  <RailSkeleton variant="doctor" />
                </section>
              ) : null}

              {visitedDoctors.length > 0 ? (
                <Reveal as="section" className="hm-section hm-visited" aria-labelledby="hm-visited-title">
                  <DoctorRailHeader
                    id="hm-visited-title"
                    title={T.visitedTitle}
                    description={T.visitedText}
                    reserveEyebrow={splitDoctorRow}
                    onViewAll={() => navigate('/consult')}
                  />
                  <VisitedDoctorList
                    items={recentDoctors}
                    label={T.visitedTitle}
                    fallbackSpeciality={T.ayurvedicDoctor}
                  />
                </Reveal>
              ) : null}

              {!isSectionDone('doctors') && !doctors.length ? (
                <section className="hm-section" aria-busy="true">
                  <DoctorRailHeader
                    eyebrow={T.doctorsEyebrow}
                    title={T.doctorsTitle}
                    description={T.doctorsText}
                    onViewAll={() => navigate('/consult/doctors')}
                  />
                  <RailSkeleton variant="doctor" />
                </section>
              ) : null}

              {doctors.length > 0 ? (
                <Reveal as="section" className="hm-section" delay={120} aria-labelledby="hm-doctors-title">
                  <DoctorRailHeader
                    id="hm-doctors-title"
                    eyebrow={T.doctorsEyebrow}
                    title={T.doctorsTitle}
                    description={T.doctorsText}
                    onViewAll={() => navigate('/consult/doctors')}
                  />
                  <DoctorTable items={suggestedDoctors} label={T.doctorsTitle} />
                </Reveal>
              ) : null}
            </div>
          ) : null}
          </LazyBlock>

          <LazyBlock blockRef={productsRef} done={isSectionDone('products')} minHeight={420} skeleton={<div className="hm-product-row hm-product-grid"><section className="hm-section hm-products" aria-busy="true"><DoctorRailHeader title={T.medicinesTitle} onViewAll={() => navigate('/medicines')} /><RailSkeleton /></section><section className="hm-section hm-products" aria-busy="true"><DoctorRailHeader title={T.productsTitle} onViewAll={() => navigate('/products')} /><RailSkeleton /></section></div>}>
          {productPanels.length ? (
            <div className="hm-product-row hm-product-grid">
              {productPanels.map((panel) => (
                <Reveal
                  as="section"
                  key={panel.key}
                  className="hm-section hm-products"
                  aria-labelledby={`hm-panel-${panel.key}`}
                >
                  <DoctorRailHeader
                    id={`hm-panel-${panel.key}`}
                    title={panel.title}
                    description={panel.description}
                    onViewAll={() => navigate(panel.to)}
                  />
                  {renderProductRail(panel.items, panel.title, true)}
                </Reveal>
              ))}
            </div>
          ) : null}
          </LazyBlock>

          <LazyBlock blockRef={wellnessRef} done={isSectionDone('yoga') && isSectionDone('diet')} minHeight={360} skeleton={<section className="hm-section hm-panel" aria-busy="true"><RailSkeleton /></section>}>

          {yogaSessions.length > 0 || dietProducts.length > 0 ? (
            <div
              className={`hm-wellness${yogaSessions.length > 0 && dietProducts.length > 0 ? ' hm-wellness--pair' : ''}`}
            >
              {yogaSessions.length > 0 ? (
                <Reveal as="section" className="hm-well hm-well--move" aria-labelledby="hm-yoga-title">
                  <div className="hm-well__head">
                    <div className="hm-well__lead">
                      <h2 id="hm-yoga-title" className="hm-well__title">
                        {T.yogaTitle}
                      </h2>
                      <p className="hm-well__text">{T.yogaText}</p>
                    </div>
                    {yogaSessions.length > 1 ? (
                      <ViewAll label={T.yogaTitle} onClick={() => navigate('/yoga')} />
                    ) : null}
                  </div>
                  <Rail label={T.yogaTitle} auto interval={3000} motionOverride className="hm-yoga-rail">
                    {yogaSessions.map((item) => (
                      <RailItem key={item.id}>
                        <YogaSessionCard
                          item={item}
                          onClick={() => navigate(`/yoga/${item.id}`, { state: { item } })}
                        />
                      </RailItem>
                    ))}
                  </Rail>
                </Reveal>
              ) : null}

              {dietProducts.length > 0 ? (
                <Reveal as="section" className="hm-well hm-well--nourish" aria-labelledby="hm-diet-title">
                  <div className="hm-well__head">
                    <div className="hm-well__lead">
                      <h2 id="hm-diet-title" className="hm-well__title">
                        {T.dietTitle}
                      </h2>
                      <p className="hm-well__text">{T.dietText}</p>
                    </div>
                    <ViewAll label={T.dietTitle} onClick={() => navigate('/diet?view=all')} />
                  </div>
                  <Rail label={T.dietTitle} auto>
                    {dietProducts.filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i).map((item) => (
                      <RailItem key={item.id}>
                        <DietPlanCard
                          item={item}
                          onClick={() => navigate(`/diet/${item.id}`, { state: { item } })}
                        />
                      </RailItem>
                    ))}
                  </Rail>
                </Reveal>
              ) : null}
            </div>
          ) : null}
          </LazyBlock>

          <Reveal as="section" className="hm-section hm-panel" aria-labelledby="hm-packages-title">
            <SectionHeader
              id="hm-packages-title"
              title={T.packagesTitle}
              action={<ViewAll label={T.packagesTitle} onClick={() => navigate('/packages')} />}
            />
            <Rail label={T.packagesTitle}>
              {consultPackages.slice(0, 6).map((item) => (
                <RailItem key={item.id} size="product">
                  <DummyOfferCard item={item} kind="package" onClick={() => navigate('/packages')} />
                </RailItem>
              ))}
            </Rail>
          </Reveal>

          {/* TEMP hidden per Rohit — Health Lab (Home collection) + Panchakarma (Classical therapies) sections
          <Reveal as="section" className="hm-section hm-panel hm-lab" aria-labelledby="hm-lab-title">
            <SectionHeader
              id="hm-lab-title"
              eyebrow={T.labEyebrow}
              title={T.labTitle}
              description={T.labText}
              action={<ViewAll label={T.labTitle} onClick={() => navigate('/labs')} />}
            />
            <LabHomeBanner
              title={T.labBannerTitle}
              subtitle={T.labBannerSub}
              onClick={() => navigate('/labs')}
            />
            <Rail label={T.labTitle}>
              {DUMMY_LAB_TESTS.map((item) => (
                <RailItem key={item.id} size="product">
                  <DummyOfferCard item={item} kind="lab" onClick={() => navigate('/labs')} />
                </RailItem>
              ))}
            </Rail>
          </Reveal>

          <Reveal as="section" className="hm-section hm-panel" aria-labelledby="hm-panchakarma-title">
            <SectionHeader
              id="hm-panchakarma-title"
              eyebrow={T.panchakarmaEyebrow}
              title={T.panchakarmaTitle}
              description={T.panchakarmaText}
              action={<ViewAll label={T.panchakarmaTitle} onClick={() => navigate('/panchakarma')} />}
            />
            <Rail label={T.panchakarmaTitle}>
              {DUMMY_PANCHAKARMA.map((item) => (
                <RailItem key={item.id} size="product">
                  <DummyOfferCard item={item} kind="therapy" onClick={() => navigate('/panchakarma')} />
                </RailItem>
              ))}
            </Rail>
          </Reveal> */}

          {!loading && allSectionsDone && !hasAnyContent ? (
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
