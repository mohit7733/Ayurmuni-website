import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flower2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import YogaCard, { YogaGridSkeleton } from '../components/yoga/YogaCard';
import { getYogaSession } from '../services/yogaService';
import { itemMatchesHealthConcern, matchesYogaSearch, normalizeYogaSessionList } from '../yoga/utils';
import { DURATION_BUCKETS, levelLabel, yogaMinutes } from '../yoga/present';
import { Button, Chip, EmptyState, SearchField, searchSuggestions } from '../components/ui';
import PageBar from '../components/ui/PageBar';
import { SectionHead } from '../components/ServiceHome';
import { YOGA_COPY as Y } from '../content/yoga';
import '../design/pages/yoga.css';

function FilterRow({ label, options, value, onChange }) {
  if (options.length < 2) return null;
  return (
    <div className="svc-chips yg-chips" role="group" aria-label={label}>
      <Chip selected={!value} onClick={() => onChange('')}>
        {label}: {Y.filterAll}
      </Chip>
      {options.map((opt) => (
        <Chip key={opt.key} selected={value === opt.key} onClick={() => onChange(value === opt.key ? '' : opt.key)}>
          {opt.label}
        </Chip>
      ))}
    </div>
  );
}
export default function Yoga() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const healthCategoryId = params.get('category') || params.get('health_category_id') || '';
  const healthDiseaseId = params.get('disease') || params.get('health_disease_id') || '';
  const categoryName = (params.get('name') || '').trim();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [level, setLevel] = useState('');
  const [duration, setDuration] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const concernMatch = useMemo(
    () => ({
      healthCategoryId: healthCategoryId || null,
      healthDiseaseId: healthDiseaseId || null,
      categoryName: categoryName || null,
    }),
    [healthCategoryId, healthDiseaseId, categoryName],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getYogaSession({
        ...(healthDiseaseId
          ? { health_disease_id: healthDiseaseId }
          : healthCategoryId
            ? { health_category_id: healthCategoryId }
            : {}),
      });
      setSessions(
        normalizeYogaSessionList(res).filter((item) => itemMatchesHealthConcern(item, concernMatch)),
      );
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [healthCategoryId, healthDiseaseId, concernMatch]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Filter options come only from values present in the data.
  const levelOptions = useMemo(() => {
    const seen = new Map();
    sessions.forEach((item) => {
      const label = levelLabel(item);
      if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label);
    });
    return [...seen].map(([key, label]) => ({ key, label }));
  }, [sessions]);
  const durationOptions = useMemo(
    () => DURATION_BUCKETS.filter((b) => sessions.some((item) => b.test(yogaMinutes(item)))),
    [sessions],
  );

  const filtered = useMemo(() => {
    const bucket = DURATION_BUCKETS.find((b) => b.key === duration);
    return sessions.filter(
      (item) =>
        matchesYogaSearch(debounced, item) &&
        (!level || levelLabel(item).toLowerCase() === level) &&
        (!bucket || bucket.test(yogaMinutes(item))),
    );
  }, [sessions, debounced, level, duration]);

  const filtering = Boolean(debounced || level || duration);
  const clearAll = () => {
    setSearch('');
    setDebounced('');
    setLevel('');
    setDuration('');
  };
  const openSession = (item) => navigate(`/yoga/${item.id}`, { state: { item } });

  const title = categoryName ? Y.listTitleFor(categoryName) : Y.listTitle;

  return (
    <AppShell tab="home">
      <div className="hm-page svc-page yg-page">
        <div className="hm-body">
          <section className="hm-well hm-well--move dlp-list yg-list" aria-labelledby="yg-list-title">
            <SectionHead
              id="yg-list-title"
              title={title}
              description={
                loading && sessions.length === 0
                  ? categoryName
                    ? Y.listTextFor(categoryName)
                    : Y.listText
                  : `${categoryName ? Y.listTextFor(categoryName) : Y.listText} ${Y.resultCount(filtered.length)}.`
              }
              action={
                <div className="am-head-tools">
                  <PageBar className="am-page-bar--slot" id="yg-bar" title={title}>
                    <SearchField
                      value={search}
                      onChange={setSearch}
                      onSubmit={(value) => setDebounced(String(value || '').trim())}
                      placeholder={Y.searchPlaceholder}
                      label={Y.searchLabel}
                      suggestions={searchSuggestions(sessions)}
                    />
                  </PageBar>
                </div>
              }
            />

            {!loading && sessions.length > 0 ? (
              <>
                <FilterRow label={Y.filterLevel} options={levelOptions} value={level} onChange={setLevel} />
                <FilterRow label={Y.filterDuration} options={durationOptions} value={duration} onChange={setDuration} />
              </>
            ) : null}

            {loading && sessions.length === 0 ? (
              <YogaGridSkeleton count={8} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Flower2 size={28} />}
                title={filtering ? Y.emptyFilteredTitle : Y.emptyTitle}
                description={filtering ? Y.emptyFilteredText : Y.emptyText}
                action={
                  filtering ? (
                    <Button onClick={clearAll}>{Y.clearFilters}</Button>
                  ) : (
                    <>
                      <Button onClick={() => navigate('/consult/doctors')}>{Y.ctaConsult}</Button>
                      {categoryName ? (
                        <Button variant="secondary" onClick={() => navigate('/yoga')}>
                          {Y.ctaBrowse}
                        </Button>
                      ) : null}
                    </>
                  )
                }
              />
            ) : (
              <>
                {filtering ? (
                  <div className="svc-more yg-clear">
                    <Button variant="ghost" size="sm" onClick={clearAll}>
                      {Y.clearFilters}
                    </Button>
                  </div>
                ) : null}
                <ul className="svc-meal-grid dlp-grid">
                  {filtered.map((item) => (
                    <li key={item.id}>
                      <YogaCard item={item} onOpen={openSession} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}