import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flower2,
  Leaf,
  LockKeyhole,
  MapPin,
  Pill,
  RefreshCw,
  Salad,
  Search,
  ShoppingBag,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import AppShell from "../components/AppShell";
import DiseaseSelectionModal from "../components/DiseaseSelectionModal";
import { Utils } from "../common/utils";
import { getBannerImageUri } from "../home/catalog";
import {
  mapAppScreenToPath,
  resolveBannerNavigation,
  resolveServiceCategoryKey,
} from "../home/serviceCategories";
import useHomeData from "../hooks/useHomeData";
import DoctorCard from "../components/DoctorCard";
import DummyOfferCard from "../components/DummyOfferCard";
import ProductCard from "../components/ProductCard";
import HomeJoinAppointments from "../components/HomeJoinAppointments";
import { getDoctorId } from "../consult/doctors";
import { requireAuth } from "../services/guestAuth";
import { useLocation } from "../context/LocationContext";
import LocationSheet from "../components/LocationSheet";
import useActiveDietHome from "../hooks/useActiveDietHome";
import useRecentVisitedDoctors from "../hooks/useRecentVisitedDoctors";
import useUpcomingAppointments from "../hooks/useUpcomingAppointments";
import {
  getAddresses,
  listAddresses,
  updateAddress,
} from "../services/profileService";
import { savedAddressToParsed } from "../services/locationService";
import BannerCarousel from "../components/BannerCarousel";
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
  TileGrid,
} from "../components/ui";
import { HOME_COPY as T } from "../content/home";
import {
  DUMMY_CONSULT_PACKAGES,
  DUMMY_LAB_TESTS,
} from "../data/homeDummySections";
import "../design/pages/home.css";
import "../design/pages/dummy-offers.css";

let prakritiModalShownThisSession = false;
let diseaseModalShownThisSession = false;

function AutoScrollRail({ label, children }) {
  const railRef = useRef(null);
  const [paused, setPaused] = useState(false);

  const moveRail = useCallback((direction, wrap = false) => {
    const rail = railRef.current;
    if (!rail) return;

    const items = Array.from(rail.children);
    if (items.length < 2 || rail.scrollWidth <= rail.clientWidth + 1) return;

    const firstItem = items[0];
    const gap = Number.parseFloat(window.getComputedStyle(rail).columnGap) || 0;
    const distance = firstItem.getBoundingClientRect().width + gap;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    const nextScroll = rail.scrollLeft + direction * distance;
    const target = wrap && nextScroll > maxScroll ? 0 : Math.max(0, Math.min(nextScroll, maxScroll));

    rail.scrollTo({ left: target, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const timer = window.setInterval(() => moveRail(1, true), 3000);
    return () => window.clearInterval(timer);
  }, [moveRail, paused]);

  return (
    <div
      className="hm-auto-rail"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <button
        type="button"
        className="hm-auto-rail__control"
        aria-label={`Scroll ${label} left`}
        onClick={() => moveRail(-1)}
      >
        <ChevronLeft size={20} aria-hidden />
      </button>
      <ul ref={railRef} className="am-rail hm-auto-rail__track" aria-label={label}>
        {children}
      </ul>
      <button
        type="button"
        className="hm-auto-rail__control"
        aria-label={`Scroll ${label} right`}
        onClick={() => moveRail(1)}
      >
        <ChevronRight size={20} aria-hidden />
      </button>
    </div>
  );
}

const SERVICE_ICONS = {
  consult: Stethoscope,
  medicine: Pill,
  medicines: Pill,
  products: ShoppingBag,
  yoga: Flower2,
  diet: Salad,
  prakriti: Sparkles,
};

const HERO_TRUST = [
  { icon: BadgeCheck, label: T.trustDoctors },
  { icon: LockKeyhole, label: T.trustPayments },
  { icon: Leaf, label: T.trustAuthentic },
];

function ViewAll({ onClick, label }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      trailingIcon={<ArrowRight size={16} aria-hidden />}
    >
      {T.viewAll}
      <span className="am-sr-only"> {label}</span>
    </Button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const {
    currentAddress,
    deliveryLocation,
    loadingLocation,
    locationEnabled,
    setDeliveryLocation,
  } = useLocation();
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
  const { doctors: visitedDoctors, loading: loadingVisitedDoctors } =
    useRecentVisitedDoctors();
  const { appointments: upcomingAppointments, loading: loadingAppointments } =
    useUpcomingAppointments();

  const [name, setName] = useState("");
  const [activeHomeModal, setActiveHomeModal] = useState("none");
  const [showDiseaseModal, setShowDiseaseModal] = useState(false);
  const [showPrakritiModal, setShowPrakritiModal] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);

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
      const info = await Utils.getData("_USER_INFO");
      setName(info?.first_name || customerData?.first_name || "Guest");
    })();
  }, [customerData]);

  useEffect(() => {
    if (Array.isArray(customerData?.addresses)) {
      setSavedAddresses(customerData.addresses);
      return;
    }
    setSavedAddresses([]);
  }, [customerData]);

  useEffect(() => {
    if (loadingCustomer || !customerData) return;
    if (activeHomeModal !== "none") return;

    const hasDiseases =
      customerData?.has_health_diseases === true ||
      (Array.isArray(customerData?.health_diseases) &&
        customerData.health_diseases.length > 0) ||
      (Array.isArray(customerData?.health_disease_ids) &&
        customerData.health_disease_ids.length > 0);

    if (!hasDiseases && !diseaseModalShownThisSession) {
      diseaseModalShownThisSession = true;
      setActiveHomeModal("disease");
      setShowDiseaseModal(true);
      return;
    }

    const prakritiIncomplete =
      customerData?.prakriti_progress != null &&
      Number(customerData.prakriti_progress) < 100;

    if (prakritiIncomplete && !prakritiModalShownThisSession) {
      prakritiModalShownThisSession = true;
      setActiveHomeModal("prakriti");
      setShowPrakritiModal(true);
    }
  }, [loadingCustomer, customerData, activeHomeModal]);

  const onDiseaseModalDone = useCallback(
    async (saved) => {
      setShowDiseaseModal(false);
      setActiveHomeModal("none");
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
    setActiveHomeModal("none");
  };

  const handleCategoryPress = (item) => {
    const nameKey = item?.name?.trim().toLowerCase() ?? "";
    const serviceKey = resolveServiceCategoryKey(item) ?? nameKey;
    const path = mapAppScreenToPath(serviceKey);
    navigate(path && path !== "/home" ? path : "/products");
  };

  const handleBannerPress = (item) => {
    const target = resolveBannerNavigation(item);
    if (!target) return;
    if (target.external) {
      window.open(target.href, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(target.path);
  };

  const prakritiProgress = Math.round(
    Number(customerData?.prakriti_progress) || 0,
  );
  const prakritiComplete = prakritiProgress >= 100;

  const openPrakriti = async (allowBack = true) => {
    if (prakritiComplete) {
      navigate("/prakriti-profile");
      return;
    }
    if (
      !(await requireAuth("Complete your profile to start prakriti assessment"))
    )
      return;
    navigate("/patient-faq", { state: { allowBack } });
  };

  const prakritiName = String(
    customerData?.prakriti_type ||
      customerData?.prakriti_result ||
      customerData?.prakriti_name ||
      "",
  ).trim();

  const defaultAddress = useMemo(
    () =>
      savedAddresses.find((item) => item?.is_default) ||
      savedAddresses[0] ||
      null,
    [savedAddresses],
  );

  const shortAddress = useMemo(() => {
    if (defaultAddress) {
      const line =
        defaultAddress.address_line_1 || defaultAddress.address_type_name || "";
      const city = defaultAddress.city || "";
      return ([line, city].filter(Boolean).join(", ") || "Saved address").slice(
        0,
        44,
      );
    }
    if (
      deliveryLocation?.formatted_address ||
      deliveryLocation?.address_line_1
    ) {
      const area =
        deliveryLocation.address_line_1 ||
        deliveryLocation.city ||
        deliveryLocation.formatted_address;
      return String(area || "Selected location").slice(0, 44);
    }
    if (loadingLocation) return "Detecting location...";
    if (locationEnabled && currentAddress) {
      return String(
        currentAddress.address_line_1 ||
          currentAddress.city ||
          currentAddress.formatted_address ||
          "",
      ).slice(0, 44);
    }
    return "Select location";
  }, [
    defaultAddress,
    deliveryLocation,
    loadingLocation,
    locationEnabled,
    currentAddress,
  ]);

  const openLocationSheet = async () => {
    setShowLocationSheet(true);
    if (!savedAddresses.length) {
      const res = await getAddresses();
      if (res?.success !== false) {
        setSavedAddresses(listAddresses(res));
      }
    }
  };

  const selectSavedAddress = async (item) => {
    await setDeliveryLocation(savedAddressToParsed(item));
    if (!item?.is_default && item?.id) {
      await updateAddress(item.id, { is_default: true });
      fetchCustomerData?.();
    }
    setShowLocationSheet(false);
  };

  const comingSoonItems = useMemo(() => {
    const items = [];
    if (!yogaSessions?.length && !dietProducts?.length) {
      items.push({ title: "Diet & Yoga", icon: Salad });
    } else {
      if (!dietProducts?.length)
        items.push({ title: "Diet plans", icon: Salad });
      if (!yogaSessions?.length) items.push({ title: "Yoga", icon: Flower2 });
    }
    items.push({ title: "Panchakarma", icon: Leaf });
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

  const renderProductRail = (items, label, autoScroll = false) => {
    const railItems = items.map((item) => (
      <RailItem key={`${item.variant_id || item.id}`} size="product">
        <ProductCard item={item} />
      </RailItem>
    ));
    return autoScroll ? (
      <AutoScrollRail label={label}>{railItems}</AutoScrollRail>
    ) : (
      <Rail label={label}>{railItems}</Rail>
    );
  };

  return (
    <AppShell tab="home">
      <div className="hm-page">
        <section className="hm-hero" aria-labelledby="hm-hero-title">
          <div className="hm-hero__inner">
            {/* LEFT — Main hero content */}
            <div className="hm-hero__main">
              <div className="hm-hero__copy">
                <div className="hm-hero__hello-wrap">
                  <p className="hm-hero__hello">
                    {name ? `${T.greeting}, ${name}` : T.greeting}
                  </p>
                </div>

                <h1 id="hm-hero-title" className="hm-hero__title">
                  {T.heroTitle}
                </h1>

                <p className="hm-hero__lede">{T.heroLede}</p>

                <div className="hm-hero__ctas">
                  <Button
                    variant="accent"
                    size="lg"
                    onClick={() => navigate("/consult")}
                    leadingIcon={<Stethoscope size={18} aria-hidden />}
                  >
                    {T.ctaConsult}
                  </Button>

                  <Button
                    variant="secondary"
                    size="lg"
                    className="hm-hero__ghost"
                    onClick={() => navigate("/medicines")}
                  >
                    {T.ctaMedicines}
                  </Button>
                </div>

                <button
                  type="button"
                  className="hm-search"
                  onClick={() => navigate("/search")}
                >
                  <Search size={18} aria-hidden />
                  <span>{T.searchPlaceholder}</span>
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
            </div>

            {/* RIGHT — Personal context */}
            <aside className="hm-hero__aside">
              <div className="hm-hero__aside-header">
                <span className="hm-hero__aside-eyebrow">
                  Your care, your way
                </span>
                <span className="hm-hero__aside-status">
                  <span className="hm-hero__aside-status-dot" />
                  Personalised
                </span>
              </div>

              <button
                type="button"
                className="hm-location"
                onClick={openLocationSheet}
                aria-label={`${T.deliverTo}: ${shortAddress}. ${T.changeLocation}`}
              >
                <span className="hm-location__icon">
                  <MapPin size={18} aria-hidden />
                </span>

                <span className="hm-location__content">
                  <span className="hm-location__label">{T.deliverTo}</span>
                  <span className="hm-location__text">{shortAddress}</span>
                  <span className="hm-location__action">
                    {T.changeLocation}
                    <ChevronDown size={14} aria-hidden />
                  </span>
                </span>
              </button>

              <div className="hm-hero__aside-divider" />

              <div className="hm-prakriti" aria-labelledby="hm-prakriti-title">
                {prakritiComplete ? (
                  <>
                    <p className="am-eyebrow">{T.prakritiDoneEyebrow}</p>

                    <h2 id="hm-prakriti-title" className="hm-prakriti__title">
                      {prakritiName || T.prakritiDoneFallback}
                    </h2>

                    <p className="hm-prakriti__text">{T.prakritiDoneText}</p>

                    <Button
                      variant="secondary"
                      block
                      onClick={() => openPrakriti(true)}
                    >
                      {T.prakritiView}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="am-eyebrow">{T.prakritiEyebrow}</p>

                    <h2 id="hm-prakriti-title" className="hm-prakriti__title">
                      {T.prakritiTitle}
                    </h2>

                    <p className="hm-prakriti__text">{T.prakritiText}</p>

                    <div
                      className="hm-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={prakritiProgress}
                      aria-label={T.prakritiProgressLabel}
                    >
                      <span
                        style={{ "--hm-progress": `${prakritiProgress}%` }}
                      />
                    </div>

                    <p className="hm-prakriti__meta">
                      {prakritiProgress}% {T.complete}
                    </p>

                    <Button
                      variant="primary"
                      block
                      onClick={() => openPrakriti(true)}
                    >
                      {prakritiProgress > 0
                        ? T.prakritiContinue
                        : T.prakritiStart}
                    </Button>
                  </>
                )}
              </div>
            </aside>
          </div>
        </section>

        <div className="hm-body">
          {serviceList.length > 0 ? (
            <section
              className="hm-section hm-services"
              aria-labelledby="hm-services-title"
            >
              <h2 id="hm-services-title" className="am-sr-only">
                {T.servicesTitle}
              </h2>
              <ul className="hm-services__grid">
                {serviceList.map((item) => {
                  const key =
                    resolveServiceCategoryKey(item) ||
                    String(item.name || "").toLowerCase();
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
                          {image ? (
                            <img src={image} alt="" loading="lazy" />
                          ) : (
                            <Icon size={24} />
                          )}
                        </span>
                        <span className="hm-service__label">{item.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div className="hm-dash">
            <div className="hm-dash__main">
              <BannerCarousel
                items={bannerItems}
                onSelect={handleBannerPress}
                loading={loading}
                copy={bannerCopy}
              />
            </div>

            {activeDietPreview ||
            loadingAppointments ||
            upcomingAppointments?.length ? (
              <aside className="hm-dash__side" aria-label={T.yourPlan}>
                {activeDietPreview ? (
                  <article className="hm-diet">
                    <div className="hm-diet__img">
                      {activeDietPreview.thumbnailUrl ? (
                        <img
                          src={activeDietPreview.thumbnailUrl}
                          alt=""
                          loading="lazy"
                        />
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
                          onClick={() =>
                            navigate(`/diet/${activeDietPreview.planId}`)
                          }
                        >
                          {activeDietPreview.title}
                        </button>
                      </h2>
                      <p className="hm-diet__meta">
                        {T.day} {activeDietPreview.currentDay}/
                        {activeDietPreview.totalDays} ·{" "}
                        {activeDietPreview.progressPercent}%
                      </p>
                      <div
                        className="hm-progress hm-progress--sm"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={
                          Number(activeDietPreview.progressPercent) || 0
                        }
                        aria-label={T.dietProgressLabel}
                      >
                        <span
                          style={{
                            "--hm-progress": `${Number(activeDietPreview.progressPercent) || 0}%`,
                          }}
                        />
                      </div>
                      {activeDietPreview.focusLabel ? (
                        <p className="hm-diet__focus">
                          {activeDietPreview.focusLabel}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ) : null}
                <HomeJoinAppointments
                  appointments={upcomingAppointments}
                  loading={loadingAppointments}
                />
              </aside>
            ) : null}
          </div>

          {healthConcerns.length > 0 ? (
            <Reveal
              as="section"
              className="hm-section"
              aria-labelledby="hm-concerns-title"
            >
              <SectionHeader
                id="hm-concerns-title"
                eyebrow={T.concernsEyebrow}
                title={T.concernsTitle}
                description={T.concernsText}
                action={
                  healthConcerns.length > 1 ? (
                    <ViewAll
                      label={T.concernsTitle}
                      onClick={() => navigate("/consult")}
                    />
                  ) : null
                }
              />
              <TileGrid label={T.concernsTitle} className="hm-concerns__grid">
                {healthConcerns.map((item) => (
                  <Tile
                    key={item.id}
                    image={item.image_url}
                    label={item.name}
                    onClick={() =>
                      navigate(
                        `/consult/concern/${item.id}?name=${encodeURIComponent(item.name)}${
                          item.description
                            ? `&desc=${encodeURIComponent(item.description)}`
                            : ""
                        }`,
                        {
                          state: {
                            categoryName: item.name,
                            categoryDesc: item.description,
                          },
                        },
                      )
                    }
                  />
                ))}
              </TileGrid>
            </Reveal>
          ) : null}

          {loadingVisitedDoctors && visitedDoctors.length === 0 ? (
            <section className="hm-section" aria-busy="true">
              <SectionHeader title={T.visitedTitle} />
              <RailSkeleton variant="doctor" />
            </section>
          ) : null}

          {visitedDoctors.length > 0 ? (
            <Reveal
              as="section"
              className="hm-section"
              aria-labelledby="hm-visited-title"
            >
              <SectionHeader
                id="hm-visited-title"
                title={T.visitedTitle}
                action={
                  visitedDoctors.length > 1 ? (
                    <ViewAll
                      label={T.visitedTitle}
                      onClick={() => navigate("/consult")}
                    />
                  ) : null
                }
              />
              <Rail label={T.visitedTitle}>
                {visitedDoctors.map((item) => (
                  <RailItem key={item.doctor_id || item.id}>
                    <MediaCard
                      image={item.doctor_image}
                      title={item.doctor_name}
                      subtitle={
                        item.doctor_designation ||
                        item.qualification ||
                        T.ayurvedicDoctor
                      }
                      fallbackIcon={Stethoscope}
                      onClick={() =>
                        navigate(
                          `/consult/doctors/${item.doctor_id || item.id}`,
                        )
                      }
                    />
                  </RailItem>
                ))}
              </Rail>
            </Reveal>
          ) : null}

          {loading && !doctors.length ? (
            <section className="hm-section" aria-busy="true">
              <SectionHeader title={T.doctorsTitle} />
              <RailSkeleton variant="doctor" />
            </section>
          ) : null}

          {doctors.length > 0 ? (
            <Reveal
              as="section"
              className="hm-section"
              aria-labelledby="hm-doctors-title"
            >
              <SectionHeader
                id="hm-doctors-title"
                eyebrow={T.doctorsEyebrow}
                title={T.doctorsTitle}
                description={T.doctorsText}
                action={
                  doctors.length > 1 ? (
                    <ViewAll
                      label={T.doctorsTitle}
                      onClick={() => navigate("/consult/doctors")}
                    />
                  ) : null
                }
              />
              <ul className="am-doctor-grid" aria-label={T.doctorsTitle}>
                {doctors.slice(0, 4).map((item) => (
                  <li key={getDoctorId(item) || item.id}>
                    <DoctorCard item={item} />
                  </li>
                ))}
              </ul>
            </Reveal>
          ) : null}

          {loading && !medicineProducts.length ? (
            <section className="hm-section" aria-busy="true">
              <SectionHeader title={T.medicinesTitle} />
              <RailSkeleton />
            </section>
          ) : null}

          {medicineProducts.length > 0 ? (
            <Reveal
              as="section"
              className="hm-section"
              aria-labelledby="hm-medicines-title"
            >
              <SectionHeader
                id="hm-medicines-title"
                title={T.medicinesTitle}
                action={
                  medicineProducts.length > 1 ? (
                    <ViewAll
                      label={T.medicinesTitle}
                      onClick={() => navigate("/medicines")}
                    />
                  ) : null
                }
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
            <Reveal
              as="section"
              className="hm-section"
              aria-labelledby="hm-products-title"
            >
              <SectionHeader
                id="hm-products-title"
                title={T.productsTitle}
                action={
                  storeProducts.length > 1 ? (
                    <ViewAll
                      label={T.productsTitle}
                      onClick={() => navigate("/products")}
                    />
                  ) : null
                }
              />
              {renderProductRail(storeProducts, T.productsTitle)}
            </Reveal>
          ) : null}

          {Object.entries(sections).map(([key, items]) =>
            items?.length ? (
              <Reveal
                as="section"
                className="hm-section"
                key={key}
                aria-labelledby={`hm-sec-${key}`}
              >
                <SectionHeader
                  id={`hm-sec-${key}`}
                  title={sectionLabels[key] || key}
                  action={
                    items.length > 1 ? (
                      <ViewAll
                        label={sectionLabels[key] || key}
                        onClick={() => navigate("/products")}
                      />
                    ) : null
                  }
                />
                {renderProductRail(
                  items,
                  sectionLabels[key] || key,
                  ["featured", "trending", "recently_viewed"].includes(key),
                )}
              </Reveal>
            ) : null,
          )}

          {yogaSessions.length > 0 ? (
            <Reveal
              as="section"
              className="hm-section"
              aria-labelledby="hm-yoga-title"
            >
              <SectionHeader
                id="hm-yoga-title"
                eyebrow={T.yogaEyebrow}
                title={T.yogaTitle}
                action={
                  yogaSessions.length > 1 ? (
                    <ViewAll
                      label={T.yogaTitle}
                      onClick={() => navigate("/yoga")}
                    />
                  ) : null
                }
              />
              <Rail label={T.yogaTitle}>
                {yogaSessions.map((item) => (
                  <RailItem key={item.id} size="wide">
                    <MediaCard
                      image={item.thumbnail_url}
                      title={item.title}
                      subtitle={item.short_description}
                      fallbackIcon={Flower2}
                      onClick={() =>
                        navigate(`/yoga/${item.id}`, { state: { item } })
                      }
                    />
                  </RailItem>
                ))}
              </Rail>
            </Reveal>
          ) : null}

          {dietProducts.length > 0 ? (
            <Reveal
              as="section"
              className="hm-section"
              aria-labelledby="hm-diet-title"
            >
              <SectionHeader
                id="hm-diet-title"
                eyebrow={T.dietEyebrow}
                title={T.dietTitle}
                action={
                  <ViewAll
                    label={T.dietTitle}
                    onClick={() => navigate("/diet?view=all")}
                  />
                }
              />
              <Rail label={T.dietTitle}>
                {dietProducts.map((item) => (
                  <RailItem key={item.id} size="wide">
                    <MediaCard
                      image={item.thumbnail_url}
                      title={item.title}
                      subtitle={item.short_description}
                      fallbackIcon={Salad}
                      onClick={() =>
                        navigate(`/diet/${item.id}`, { state: { item } })
                      }
                    />
                  </RailItem>
                ))}
              </Rail>
            </Reveal>
          ) : null}

          <Reveal
            as="section"
            className="hm-section"
            aria-labelledby="hm-packages-title"
          >
            <SectionHeader
              id="hm-packages-title"
              title={T.packagesTitle}
              action={
                <ViewAll
                  label={T.packagesTitle}
                  onClick={() => navigate("/packages")}
                />
              }
            />
            <AutoScrollRail label={T.packagesTitle}>
              {DUMMY_CONSULT_PACKAGES.slice(0, 6).map((item) => (
                <RailItem key={item.id} size="product">
                  <DummyOfferCard
                    item={item}
                    kind="package"
                    onClick={() => navigate("/packages")}
                  />
                </RailItem>
              ))}
            </AutoScrollRail>
          </Reveal>

          <Reveal
            as="section"
            className="hm-section"
            aria-labelledby="hm-lab-title"
          >
            <SectionHeader
              id="hm-lab-title"
              title={T.labTitle}
              action={
                <ViewAll label={T.labTitle} onClick={() => navigate("/labs")} />
              }
            />
            <Rail label={T.labTitle}>
              {DUMMY_LAB_TESTS.map((item) => (
                <RailItem key={item.id} size="product">
                  <DummyOfferCard
                    item={item}
                    kind="lab"
                    onClick={() => navigate("/labs")}
                  />
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
            <section
              className="hm-section hm-soon"
              aria-labelledby="hm-soon-title"
            >
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
        visible={showDiseaseModal && activeHomeModal === "disease"}
        serviceCategoryId={medicineCategoryId}
        onDone={onDiseaseModalDone}
      />

      <Modal
        open={Boolean(
          showPrakritiModal &&
          activeHomeModal === "prakriti" &&
          customerData &&
          !loadingCustomer,
        )}
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
          <span style={{ "--hm-progress": `${prakritiProgress}%` }} />
        </div>
        <p className="hm-prakriti__meta">
          {prakritiProgress}% {T.complete}
        </p>
      </Modal>

      <LocationSheet
        visible={showLocationSheet}
        onClose={() => setShowLocationSheet(false)}
        currentAddress={currentAddress || deliveryLocation}
        loadingLocation={loadingLocation}
        savedAddresses={savedAddresses}
        onSelectAddress={selectSavedAddress}
        onViewAll={() => {
          setShowLocationSheet(false);
          navigate("/profile/addresses");
        }}
        onAddAddress={() => {
          setShowLocationSheet(false);
          navigate("/profile/addresses/new");
        }}
        onOpenMap={() => {
          setShowLocationSheet(false);
          navigate("/location-picker", {
            state: {
              returnScreen: "AddEditAddress",
              returnParams: { type: "ADD" },
            },
          });
        }}
        onUseGps={() => {
          setShowLocationSheet(false);
          navigate("/location-picker", {
            state: {
              useGps: true,
              returnScreen: "AddEditAddress",
              returnParams: { type: "ADD" },
            },
          });
        }}
      />
    </AppShell>
  );
}
