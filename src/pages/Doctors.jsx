import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  RefreshCw,
  SearchX,
  SlidersHorizontal,
  X,
  CalendarDays,
  BriefcaseMedical,
  Stethoscope,
  Check,
} from "lucide-react";
import AppShell from "../components/AppShell";
import DoctorCard from "../components/DoctorCard";
import PageHeader from "../components/PageHeader";
import { getDoctors } from "../services/consultService";
import { getHealthCategories } from "../services/productService";
import { mapProductCategory, normalizeApiList } from "../home/catalog";
import { getDoctorId, listDoctors } from "../consult/doctors";
import {
  Button,
  Disclaimer,
  EmptyState,
  ErrorState,
  Modal,
  SearchField,
  SkeletonGrid,
} from "../components/ui";
import { CONSULT_COPY as T } from "../content/consult";
import "../design/pages/consult.css";

const EXPERIENCE = [
  { label: "Any experience", value: "" },
  { label: "1+ years", value: "1" },
  { label: "5+ years", value: "5" },
  { label: "10+ years", value: "10" },
  { label: "15+ years", value: "15" },
  { label: "20+ years", value: "20" },
];

const AVAILABILITY = [
  { label: "Any day", value: "" },
  { label: "Today", value: "today" },
  { label: "Tomorrow", value: "tomorrow" },
  { label: "This week", value: "this_week" },
  { label: "Next week", value: "next_week" },
  { label: "This month", value: "this_month" },
  { label: "Next month", value: "next_month" },
];

const SPECIALITY_LIMIT = 8;

const pad = (value) => String(value).padStart(2, "0");
const ymd = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const doctorExperienceYears = (doctor) => {
  for (const raw of [
    doctor?.experience_years,
    doctor?.experience_display,
    doctor?.experience,
  ]) {
    const match = String(raw ?? "").match(/\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return null;
};

const startOfWeek = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
  return next;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getPresetDates = (type) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const y = today.getFullYear();
  const m = today.getMonth();
  let range = null;

  if (type === "today") range = [today, today];
  else if (type === "tomorrow") range = [addDays(today, 1), addDays(today, 1)];
  else if (type === "this_week") {
    const start = startOfWeek(today);
    range = [start, addDays(start, 6)];
  } else if (type === "next_week") {
    const start = addDays(startOfWeek(today), 7);
    range = [start, addDays(start, 6)];
  } else if (type === "this_month")
    range = [new Date(y, m, 1), new Date(y, m + 1, 0)];
  else if (type === "next_month")
    range = [new Date(y, m + 1, 1), new Date(y, m + 2, 0)];

  return range
    ? { from: ymd(range[0]), to: ymd(range[1]) }
    : { from: "", to: "" };
};

function FilterGroup({ icon, title, hint, children }) {
  return (
    <fieldset className="cs-filter-group">
      <legend className="cs-filter-heading">
        <span className="cs-filter-heading__icon">{icon}</span>
        <span className="cs-filter-heading__text">
          <strong>{title}</strong>
          <small>{hint}</small>
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      className={`cs-chip${selected ? " is-selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {selected && <Check size={13} strokeWidth={2.75} aria-hidden />}
      {children}
    </button>
  );
}

function FilterGroups({
  specialities,
  specialization,
  setSpecialization,
  availability,
  setAvailability,
  experience,
  setExperience,
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleSpecialities = showAll
    ? specialities
    : specialities.filter(
        (item, index) => index < SPECIALITY_LIMIT || item.id === specialization,
      );
  const hiddenCount = specialities.length - visibleSpecialities.length;

  const renderChips = (items, selected, onSelect) => (
    <div className="cs-chips cs-chips--grid">
      {items.map((item) => (
        <Chip
          key={item.value || "all"}
          selected={selected === item.value}
          onClick={() => onSelect(item.value)}
        >
          {item.label}
        </Chip>
      ))}
    </div>
  );

  return (
    <div className="cs-filter-groups">
      {specialities.length > 0 && (
        <FilterGroup
          icon={<Stethoscope size={17} aria-hidden />}
          title={T.speciality}
          hint="Choose a health specialty"
        >
          <div className="cs-chips">
            <Chip
              selected={specialization === ""}
              onClick={() => setSpecialization("")}
            >
              {T.allSpecialities}
            </Chip>
            {visibleSpecialities.map((item) => (
              <Chip
                key={item.id}
                selected={specialization === item.id}
                onClick={() =>
                  setSpecialization(specialization === item.id ? "" : item.id)
                }
              >
                {item.name}
              </Chip>
            ))}
          </div>
          {specialities.length > SPECIALITY_LIMIT && (
            <button
              type="button"
              className="cs-more-toggle"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
            >
              {showAll ? "Show fewer" : `Show ${hiddenCount} more`}
            </button>
          )}
        </FilterGroup>
      )}

      <FilterGroup
        icon={<CalendarDays size={17} aria-hidden />}
        title={T.availability}
        hint="Find a convenient consultation date"
      >
        {renderChips(AVAILABILITY, availability, setAvailability)}
      </FilterGroup>

      <FilterGroup
        icon={<BriefcaseMedical size={17} aria-hidden />}
        title={T.experience}
        hint="Set the doctor's experience level"
      >
        {renderChips(EXPERIENCE, experience, setExperience)}
      </FilterGroup>
    </div>
  );
}

export default function Doctors() {
  const [params] = useSearchParams();
  const categoryId = params.get("category") || "";
  const diseaseId = params.get("disease") || "";
  const title = params.get("name") || T.listTitle;
  const initialSearch = params.get("q") || "";
  const [search, setSearch] = useState(initialSearch);
  const [submitted, setSubmitted] = useState(initialSearch);
  const [experience, setExperience] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [availability, setAvailability] = useState("");
  const [specialities, setSpecialities] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSubmitted(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getHealthCategories();
      if (!alive) return;
      setSpecialities(
        normalizeApiList(res)
          .map(mapProductCategory)
          .filter((item) => item.id),
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  const dates = useMemo(() => getPresetDates(availability), [availability]);

  const filters = useMemo(
    () => ({
      search: submitted || undefined,
      specialization: specialization || undefined,
      health_category_id: categoryId || undefined,
      health_disease_id: diseaseId || undefined,
      from_date: dates.from || undefined,
      to_date: dates.to || undefined,
      page: 1,
      page_size: 40,
    }),
    [submitted, specialization, categoryId, diseaseId, dates.from, dates.to],
  );

  const loadDoctors = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const res = await getDoctors(filters);
    setFailed(res?.success === false && res?.status !== 404);
    setDoctors(listDoctors(res));
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadDoctors(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const activeFilters = [
    specialization && {
      key: "speciality",
      label:
        specialities.find((item) => item.id === specialization)?.name ||
        T.speciality,
      clear: () => setSpecialization(""),
    },
    availability && {
      key: "availability",
      label: AVAILABILITY.find((item) => item.value === availability)?.label,
      clear: () => setAvailability(""),
    },
    experience && {
      key: "experience",
      label: EXPERIENCE.find((item) => item.value === experience)?.label,
      clear: () => setExperience(""),
    },
  ].filter(Boolean);

  const filteredDoctors = useMemo(() => {
    const minimumYears = Number(experience);
    if (!minimumYears) return doctors;
    return doctors.filter((doctor) => {
      const years = doctorExperienceYears(doctor);
      return years !== null && years >= minimumYears;
    });
  }, [doctors, experience]);

  const clearAll = () => {
    setSpecialization("");
    setAvailability("");
    setExperience("");
  };

  const hasQuery = Boolean(submitted) || activeFilters.length > 0;

  const filterProps = {
    specialities,
    specialization,
    setSpecialization,
    availability,
    setAvailability,
    experience,
    setExperience,
  };

  return (
    <AppShell tab="consult">
      <div className="cs-page cs-doctors-page">
        <PageHeader
          title={title}
          subtitle={T.listSubtitle}
          backTo="/consult"
          actions={
            <Button
              variant="ghost"
              size="sm"
              loading={refreshing}
              disabled={loading}
              onClick={() => loadDoctors(true)}
              leadingIcon={<RefreshCw size={16} aria-hidden />}
            >
              {refreshing ? T.refreshing : T.refresh}
            </Button>
          }
        >
          <SearchField
            value={search}
            onChange={setSearch}
            onSubmit={(value) => setSubmitted(String(value || "").trim())}
            placeholder={T.listSearch}
            label={T.listSearch}
          />
        </PageHeader>

        <div className="cs-browse">
          <aside className="cs-filters" aria-label={T.filtersLabel}>
            <div className="cs-filters__head">
              <h2>
                <SlidersHorizontal size={17} aria-hidden />
                {T.filters}
                {activeFilters.length ? (
                  <span className="cs-badge">{activeFilters.length}</span>
                ) : null}
              </h2>
              {activeFilters.length ? (
                <Button variant="link" size="sm" onClick={clearAll}>
                  {T.clearAll}
                </Button>
              ) : null}
            </div>
            <FilterGroups {...filterProps} />
          </aside>

          <div className="cs-results">
            <div className="cs-toolbar">
              <p className="cs-count" role="status">
                {loading
                  ? T.loadingDoctors
                  : failed
                    ? ""
                    : T.resultCount(filteredDoctors.length)}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="cs-filter-btn"
                onClick={() => setFiltersOpen(true)}
                leadingIcon={<SlidersHorizontal size={16} aria-hidden />}
                aria-haspopup="dialog"
              >
                {T.filters}
                {activeFilters.length ? (
                  <span className="cs-badge">{activeFilters.length}</span>
                ) : null}
              </Button>
            </div>

            {activeFilters.length ? (
              <ul className="cs-active" aria-label={T.filters}>
                {activeFilters.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className="cs-active__chip"
                      onClick={item.clear}
                    >
                      {item.label}
                      <X size={14} aria-hidden />
                      <span className="am-sr-only">{T.removeFilter}</span>
                    </button>
                  </li>
                ))}
                <li>
                  <Button variant="link" size="sm" onClick={clearAll}>
                    {T.clearAll}
                  </Button>
                </li>
              </ul>
            ) : null}

            {loading ? (
              <SkeletonGrid
                variant="doctor"
                count={6}
                label={T.loadingDoctors}
                className="am-doctor-grid"
              />
            ) : failed ? (
              <ErrorState
                title={T.errorTitle}
                description={T.errorText}
                onRetry={() => loadDoctors(false)}
              />
            ) : filteredDoctors.length === 0 ? (
              <EmptyState
                icon={<SearchX size={28} />}
                title={hasQuery ? T.emptyFiltered : T.noDoctors}
                description={hasQuery ? T.emptyFilteredText : T.noDoctorsText}
                action={
                  hasQuery ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        clearAll();
                        setSearch("");
                        setSubmitted("");
                      }}
                    >
                      {T.clearAll}
                    </Button>
                  ) : null
                }
              />
            ) : (
              <ul className="am-doctor-grid">
                {filteredDoctors.map((item) => (
                  <li key={getDoctorId(item) || item.full_name}>
                    <DoctorCard item={item} />
                  </li>
                ))}
              </ul>
            )}

            <Disclaimer className="cs-disclaimer" />
          </div>
        </div>
      </div>

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={T.filters}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={clearAll}
              disabled={!activeFilters.length}
            >
              {T.clearAll}
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>
              {loading
                ? T.loadingDoctors
                : T.showResults(filteredDoctors.length)}
            </Button>
          </>
        }
      >
        <FilterGroups {...filterProps} />
      </Modal>
    </AppShell>
  );
}
