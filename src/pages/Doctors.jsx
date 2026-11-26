import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, SearchX, SlidersHorizontal, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import DoctorListCard from '../components/DoctorListCard';
import { getDoctors } from '../services/consultService';
import { invalidateApiCache } from '../services/apiClient';
import { getHealthCategories } from '../services/productService';
import { mapProductCategory, normalizeApiList } from '../home/catalog';
import { getDoctorId, listDoctors } from '../consult/doctors';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Modal,
  SearchField,
  searchSuggestions,
  SkeletonGrid,
} from '../components/ui';
import { CONSULT_COPY as T } from '../content/consult';
import '../design/pages/consult.css';
import '../design/pages/doctors-list.css';

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

/** Quick windows for GET /customers/doctors/?start_time=&end_time= (HH:mm). */
const TIME_PRESETS = [
  { label: T.timeAny, value: '', start: '', end: '' },
  { label: T.timeMorning, value: 'morning', start: '09:00', end: '12:00' },
  { label: T.timeAfternoon, value: 'afternoon', start: '12:00', end: '17:00' },
  { label: T.timeEvening, value: 'evening', start: '17:00', end: '21:00' },
  { label: T.timeNight, value: 'night', start: '21:00', end: '23:59' },
];

const normalizeTime = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '';
  return `${pad(hour)}:${pad(minute)}`;
};

const timePresetFor = (start, end) =>
  TIME_PRESETS.find((item) => item.start === start && item.end === end)?.value || '';

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

const clampRange = (today, from, to) => {
  const todayStr = ymd(today);
  const start = from < todayStr ? todayStr : from;
  if (!to || to < start) return { from: '', to: '' };
  return { from: start, to };
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
  if (type === 'this_week') return clampRange(today, ymd(startOfWeek(today)), ymd(endOfWeek(today)));
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
    return clampRange(today, ymd(start), ymd(end));
  }
  if (type === 'next_month') {
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    return { from: ymd(start), to: ymd(end) };
  }
  return { from: '', to: '' };
};

function FilterGroups({
  specialities,
  specialization,
  setSpecialization,
  availability,
  setAvailability,
  startTime,
  endTime,
  setStartTime,
  setEndTime,
  experience,
  setExperience,
}) {
  const timePreset = timePresetFor(startTime, endTime);

  const applyTimePreset = (preset) => {
    setStartTime(preset.start);
    setEndTime(preset.end);
  };

  return (
    <>
      <fieldset className="cs-filter-group">
        <legend>{T.availableTime}</legend>
        <div className="cs-chip-wrap">
          {TIME_PRESETS.map((item) => (
            <Chip
              key={item.value || 'any-time'}
              selected={timePreset === item.value}
              onClick={() => applyTimePreset(item)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
        <div className="cs-time-range">
          <label className="cs-time-range__field">
            <span>{T.timeStart}</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(normalizeTime(event.target.value))}
            />
          </label>
          <label className="cs-time-range__field">
            <span>{T.timeEnd}</span>
            <input
              type="time"
              value={endTime}
              min={startTime || undefined}
              onChange={(event) => setEndTime(normalizeTime(event.target.value))}
            />
          </label>
        </div>
      </fieldset>
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
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [specialities, setSpecialities] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
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
  // Chips are health concerns. The doctor list matches health_disease_id, not that concern id.
  const concernId = specialization || categoryId;
  const useUrlDisease = Boolean(diseaseId) && !specialization;
  const [concernDiseases, setConcernDiseases] = useState('');
  const [concernKey, setConcernKey] = useState('');

  useEffect(() => {
    if (useUrlDisease || !concernId) {
      setConcernDiseases('');
      setConcernKey(useUrlDisease ? 'disease' : '');
      return undefined;
    }
    let alive = true;
    setConcernKey('');
    (async () => {
      const res = await getHealthCategories({ id: concernId });
      if (!alive) return;
      const ids = normalizeApiList(res).map((item) => item.id).filter(Boolean);
      setConcernDiseases(ids.join(','));
      setConcernKey(concernId);
    })();
    return () => {
      alive = false;
    };
  }, [concernId, useUrlDisease]);

  const concernPending = Boolean(concernId) && !useUrlDisease && concernKey !== concernId;
  const concernMiss = Boolean(concernId) && !useUrlDisease && concernKey === concernId && !concernDiseases;

  const timeWindow = useMemo(() => {
    const start = normalizeTime(startTime);
    const end = normalizeTime(endTime);
    if (!start || !end || end <= start) return { start: '', end: '' };
    return { start, end };
  }, [startTime, endTime]);

  const filters = useMemo(
    () => ({
      search: submitted || undefined,
      experience: experience || undefined,
      health_disease_id: useUrlDisease ? diseaseId : concernDiseases || undefined,
      from_date: dates.from || undefined,
      to_date: dates.to || undefined,
      start_time: timeWindow.start || undefined,
      end_time: timeWindow.end || undefined,
      page: 1,
      page_size: 20,
    }),
    [
      submitted,
      experience,
      useUrlDisease,
      diseaseId,
      concernDiseases,
      dates.from,
      dates.to,
      timeWindow.start,
      timeWindow.end,
    ],
  );

  // Only the newest filter/search request may write the list (typing, filter chips, refresh).
  const doctorsRequestRef = useRef(0);
  const loadDoctors = async (isRefresh = false) => {
    const requestId = ++doctorsRequestRef.current;
    if (concernPending) {
      setLoading(true);
      return;
    }
    if (concernMiss) {
      setFailed(false);
      setDoctors([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) {
      setRefreshing(true);
      invalidateApiCache('customers/doctors/');
    } else setLoading(true);
    const res = await getDoctors(filters);
    if (requestId !== doctorsRequestRef.current) return;
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
  }, [filters, concernPending, concernMiss]);

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
    timeWindow.start &&
    timeWindow.end && {
      key: 'time',
      label:
        TIME_PRESETS.find(
          (item) => item.start === timeWindow.start && item.end === timeWindow.end,
        )?.label || T.timeRangeLabel(timeWindow.start, timeWindow.end),
      clear: () => {
        setStartTime('');
        setEndTime('');
      },
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
    setStartTime('');
    setEndTime('');
    setExperience('');
  };

  const hasQuery = Boolean(submitted) || activeFilters.length > 0;

  const filterProps = {
    specialities,
    specialization,
    setSpecialization,
    availability,
    setAvailability,
    startTime,
    endTime,
    setStartTime,
    setEndTime,
    experience,
    setExperience,
  };

  return (
    <AppShell tab="consult">
      <div className="cs-page cs-doctors-page dl-page">
        <header className="dl-head">
          <button type="button" className="dl-head__back" onClick={() => navigate('/consult')} aria-label="Back to consult">
            <ArrowLeft size={18} aria-hidden />
          </button>
          <div className="dl-head__copy">
            <h1 className="dl-head__title">{title}</h1>
            <p className="dl-head__desc">{T.listSubtitle}</p>
          </div>
          <button
            type="button"
            className="dl-head__refresh"
            onClick={() => loadDoctors(true)}
            disabled={loading || refreshing}
            aria-label={refreshing ? T.refreshing : T.refresh}
            title={T.refresh}
          >
            <RefreshCw size={16} aria-hidden className={refreshing ? 'is-spinning' : undefined} />
          </button>
        </header>

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
            {/* <div className="cs-toolbar">
              <p className="cs-count" role="status">
                {loading ? T.loadingDoctors : failed ? '' : T.resultCount(doctors.length)}
              </p>
              <div className="am-page-bar am-page-bar--slot dl-bar">
                <SearchField
                  value={search}
                  onChange={setSearch}
                  onSubmit={(value) => setSubmitted(String(value || '').trim())}
                  placeholder={T.listSearch}
                  label={T.listSearch}
                  suggestions={searchSuggestions(specialities)}
                />
              </div>
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
            </div> */}

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
              <SkeletonGrid
                variant="doctor"
                count={6}
                label={T.loadingDoctors}
                className="am-doctor-grid am-doctor-grid--premium"
              />
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
              <ul className="dl-grid">
                {doctors.map((item) => (
                  <li key={getDoctorId(item) || item.full_name}>
                    <DoctorListCard item={item} />
                  </li>
                ))}
              </ul>
            )}

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
