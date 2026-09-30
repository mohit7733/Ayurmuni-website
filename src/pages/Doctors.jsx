import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, SearchX, SlidersHorizontal, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import DoctorCard from '../components/DoctorCard';
import PageHeader from '../components/PageHeader';
import { getDoctors } from '../services/consultService';
import { getHealthCategories } from '../services/productService';
import { mapProductCategory, normalizeApiList } from '../home/catalog';
import { getDoctorId, listDoctors } from '../consult/doctors';
import {
  Button,
  Chip,
  Disclaimer,
  EmptyState,
  ErrorState,
  Modal,
  SearchField,
  SkeletonGrid,
} from '../components/ui';
import { CONSULT_COPY as T } from '../content/consult';
import '../design/pages/consult.css';

const EXPERIENCE = [
  { label: 'Any experience', value: '' },
  { label: '1+ Years', value: '1' },
  { label: '5+ Years', value: '5' },
  { label: '10+ Years', value: '10' },
  { label: '15+ Years', value: '15' },
  { label: '20+ Years', value: '20' },
];

const AVAILABILITY = [
  { label: 'Any day', value: '' },
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'This Week', value: 'this_week' },
  { label: 'Next Week', value: 'next_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Next Month', value: 'next_month' },
];

const pad = (value) => String(value).padStart(2, '0');
const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const startOfWeek = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
};

const endOfWeek = (date) => {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return next;
};

const getPresetDates = (type) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (type === 'today') return { from: ymd(today), to: ymd(today) };
  if (type === 'tomorrow') {
    const next = new Date(today);
    next.setDate(today.getDate() + 1);
    return { from: ymd(next), to: ymd(next) };
  }
  if (type === 'this_week') return { from: ymd(startOfWeek(today)), to: ymd(endOfWeek(today)) };
  if (type === 'next_week') {
    const start = startOfWeek(today);
    start.setDate(start.getDate() + 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: ymd(start), to: ymd(end) };
  }
  if (type === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: ymd(start), to: ymd(end) };
  }
  if (type === 'next_month') {
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    return { from: ymd(start), to: ymd(end) };
  }
  return { from: '', to: '' };
};

function FilterGroups({ specialities, specialization, setSpecialization, availability, setAvailability, experience, setExperience }) {
  return (
    <>
      {specialities.length > 0 ? (
        <fieldset className="cs-filter-group">
          <legend>{T.speciality}</legend>
          <div className="cs-chip-wrap">
            <Chip selected={specialization === ''} onClick={() => setSpecialization('')}>
              {T.allSpecialities}
            </Chip>
            {specialities.map((item) => (
              <Chip
                key={item.id}
                selected={specialization === item.id}
                onClick={() => setSpecialization(specialization === item.id ? '' : item.id)}
              >
                {item.name}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="cs-filter-group">
        <legend>{T.availability}</legend>
        <div className="cs-chip-wrap">
          {AVAILABILITY.map((item) => (
            <Chip key={item.value || 'any-day'} selected={availability === item.value} onClick={() => setAvailability(item.value)}>
              {item.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="cs-filter-group">
        <legend>{T.experience}</legend>
        <div className="cs-chip-wrap">
          {EXPERIENCE.map((item) => (
            <Chip key={item.value || 'any'} selected={experience === item.value} onClick={() => setExperience(item.value)}>
              {item.label}
            </Chip>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export default function Doctors() {
  const [params] = useSearchParams();
  const categoryId = params.get('category') || '';
  const diseaseId = params.get('disease') || '';
  const title = params.get('name') || T.listTitle;
  const initialSearch = params.get('q') || '';
  const [search, setSearch] = useState(initialSearch);
  const [submitted, setSubmitted] = useState(initialSearch);
  const [experience, setExperience] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [availability, setAvailability] = useState('');
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
      setSpecialities(normalizeApiList(res).map(mapProductCategory).filter((item) => item.id));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const dates = useMemo(() => getPresetDates(availability), [availability]);

  const filters = useMemo(
    () => ({
      search: submitted || undefined,
      experience: experience || undefined,
      specialization: specialization || undefined,
      health_category_id: categoryId || undefined,
      health_disease_id: diseaseId || undefined,
      from_date: dates.from || undefined,
      to_date: dates.to || undefined,
      page: 1,
      page_size: 40,
    }),
    [submitted, experience, specialization, categoryId, diseaseId, dates.from, dates.to],
  );

  const loadDoctors = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const res = await getDoctors(filters);
    setFailed(res?.success === false);
    setDoctors(listDoctors(res));
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadDoctors(false);
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const activeFilters = [
    specialization && {
      key: 'speciality',
      label: specialities.find((item) => item.id === specialization)?.name || T.speciality,
      clear: () => setSpecialization(''),
    },
    availability && {
      key: 'availability',
      label: AVAILABILITY.find((item) => item.value === availability)?.label,
      clear: () => setAvailability(''),
    },
    experience && {
      key: 'experience',
      label: EXPERIENCE.find((item) => item.value === experience)?.label,
      clear: () => setExperience(''),
    },
  ].filter(Boolean);

  const clearAll = () => {
    setSpecialization('');
    setAvailability('');
    setExperience('');
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
      <div className="cs-page">
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
            onSubmit={(value) => setSubmitted(String(value || '').trim())}
            placeholder={T.listSearch}
            label={T.listSearch}
          />
        </PageHeader>

        <div className="cs-browse">
          <aside className="cs-filters" aria-label={T.filtersLabel}>
            <div className="cs-filters__head">
              <h2>{T.filters}</h2>
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
                {loading ? T.loadingDoctors : failed ? '' : T.resultCount(doctors.length)}
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
                {activeFilters.length ? <span className="cs-filter-btn__count">{activeFilters.length}</span> : null}
              </Button>
            </div>

            {activeFilters.length ? (
              <ul className="cs-active" aria-label={T.filters}>
                {activeFilters.map((item) => (
                  <li key={item.key}>
                    <button type="button" className="cs-active__chip" onClick={item.clear}>
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
              <SkeletonGrid variant="doctor" count={6} label={T.loadingDoctors} className="am-doctor-grid" />
            ) : failed ? (
              <ErrorState title={T.errorTitle} description={T.errorText} onRetry={() => loadDoctors(false)} />
            ) : doctors.length === 0 ? (
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
                        setSearch('');
                        setSubmitted('');
                      }}
                    >
                      {T.clearAll}
                    </Button>
                  ) : null
                }
              />
            ) : (
              <ul className="am-doctor-grid">
                {doctors.map((item) => (
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
            <Button variant="secondary" onClick={clearAll} disabled={!activeFilters.length}>
              {T.clearAll}
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>
              {loading ? T.loadingDoctors : T.showResults(doctors.length)}
            </Button>
          </>
        }
      >
        <FilterGroups {...filterProps} />
      </Modal>
    </AppShell>
  );
}
