import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Calendar, Leaf, Salad } from 'lucide-react';
import AppShell from '../components/AppShell';
import { ActiveDietCard } from '../components/ActiveDietPlan';
import dietCoverImg from '/images/login/14.webp';
import { SectionHead, ViewAll } from '../components/ServiceHome';
import DietListCard from '../components/DietListCard';
import '../design/pages/diet-list.css';
import { formatRupee, mapProductCategory, normalizeApiList } from '../home/catalog';
import { getServiceCategoryId } from '../home/serviceCategories';
import useDashboardCategories from '../hooks/useDashboardCategories';
import useActiveDietHome from '../hooks/useActiveDietHome';
import { getHealthCategories } from '../services/productService';
import { getDietPlans } from '../services/dietService';
import useDietPlans from '../diet/useDietPlans';
import {
  getDietListStatus,
  getDietPlanCoverUrl,
  getDietPlanRatingLabel,
  normalizeDietPlanList,
} from '../diet/utils';
import {
  Button,
  Chip,
  ConcernCarousel,
  EmptyState,
  PageBar,
  SearchField,
  searchSuggestions,
  SkeletonGrid,
  Tile,
} from '../components/ui';
import { HOME_COPY as H } from '../content/home';

const ALL = 'all';
// App DietScreen defaults; the lists grow from loaded plans (mergeFilterCatalog).
const DEFAULT_PRAKRITI = ['Vata', 'Pitta', 'Kapha', 'Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha'];
const DEFAULT_DURATIONS = ['7', '14', '21', '30', '45', '60'];
const DEFAULT_CALORIES = ['1200', '1500', '1800', '2000', '2200', '2500'];

const planDurationValue = (plan) =>
  String(plan?.duration ?? plan?.duration_days ?? plan?.days ?? plan?.plan_duration ?? '').trim();
const planCaloriesValue = (plan) =>
  String(
    plan?.calories ?? plan?.calorie ?? plan?.daily_calories ?? plan?.total_calories ?? plan?.calorie_target ?? '',
  ).trim();
const sortNumericLike = (a, b) => {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b);
};
const mergeFilterCatalog = (prev, plans) => {
  const prakriti = new Set(prev.prakriti);
  const durations = new Set(prev.durations);
  const calories = new Set(prev.calories);
  const diseases = new Map(prev.diseases.map((d) => [d.id, d]));
  plans.forEach((plan) => {
    const p = String(plan?.prakriti || '').trim();
    if (p) prakriti.add(p);
    const dur = planDurationValue(plan);
    if (dur) durations.add(dur);
    const cal = planCaloriesValue(plan);
    if (cal) calories.add(cal);
    (Array.isArray(plan?.health_diseases) ? plan.health_diseases : []).forEach((d) => {
      const id = String(d?.id ?? '').trim();
      const name = String(d?.name ?? '').trim();
      if (id && name) diseases.set(id, { id, name });
    });
  });
  return {
    prakriti: Array.from(prakriti).sort((a, b) => a.localeCompare(b)),
    diseases: Array.from(diseases.values()).sort((a, b) => a.name.localeCompare(b.name)),
    durations: Array.from(durations).sort(sortNumericLike),
    calories: Array.from(calories).sort(sortNumericLike),
  };
};
const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

const durationLabel = (plan) => {
  if (plan?.duration) return String(plan.duration);
  const days = Number(plan?.duration_days ?? plan?.total_days);
  return Number.isFinite(days) && days > 0 ? `${days} days` : '';
};

export default function Diet() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const healthCategoryId = params.get('category') || params.get('health_category_id') || '';
  const healthDiseaseId = params.get('disease') || params.get('health_disease_id') || '';
  const categoryName = (params.get('name') || '').trim();
  const wantsAll =
    params.get('view') === 'all' || Boolean(healthCategoryId) || Boolean(healthDiseaseId);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [prakriti, setPrakriti] = useState(ALL);
  const [diseaseFilter, setDiseaseFilter] = useState(ALL);
  const [paidFilter, setPaidFilter] = useState(ALL);
  const [durationFilter, setDurationFilter] = useState(ALL);
  const [caloriesFilter, setCaloriesFilter] = useState(ALL);
  const [sortFilter, setSortFilter] = useState(ALL);
  const [ratingFilter, setRatingFilter] = useState(ALL);
  const [filterCatalog, setFilterCatalog] = useState({
    prakriti: DEFAULT_PRAKRITI,
    diseases: [],
    durations: DEFAULT_DURATIONS,
    calories: DEFAULT_CALORIES,
  });
  const [statusTab, setStatusTab] = useState('all');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const listFilters = useMemo(
    () => ({
      search: debounced || undefined,
      prakriti: prakriti !== ALL ? prakriti : undefined,
      health_category_id:
        diseaseFilter === ALL && healthCategoryId ? healthCategoryId : undefined,
      health_disease_id: (diseaseFilter !== ALL ? diseaseFilter : '') || healthDiseaseId || undefined,
      is_paid: paidFilter === 'true' || paidFilter === 'false' ? paidFilter : undefined,
      duration: durationFilter !== ALL ? durationFilter : undefined,
      calories: caloriesFilter !== ALL ? caloriesFilter : undefined,
      min_rating: ratingFilter !== ALL ? ratingFilter : undefined,
      sort: ['popularity', 'latest', 'rating'].includes(sortFilter)
        ? sortFilter === 'rating'
          ? 'ratings'
          : sortFilter
        : undefined,
      // Assignment status is filtered by the API as well (active / paused).
      patient_assignment_status:
        statusTab === 'active' ? 'active' : statusTab === 'inactive' ? 'paused' : undefined,
    }),
    [
      statusTab,
      ratingFilter,
      debounced,
      prakriti,
      diseaseFilter,
      paidFilter,
      durationFilter,
      caloriesFilter,
      sortFilter,
      healthCategoryId,
      healthDiseaseId,
    ],
  );

  const { plans, loadingList, loadingMore, hasMore, loadMore } = useDietPlans({
    listType: wantsAll ? 'all' : null,
    listFilters,
  });

  // Grow option lists from loaded plans; never shrink on filter (app behaviour).
  useEffect(() => {
    if (!plans?.length) return;
    setFilterCatalog((prev) => mergeFilterCatalog(prev, plans));
  }, [plans]);

  // Quiet seed from the catalog, as the app does: GET ?type=all&page=1&page_size=50.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getDietPlans({ type: 'all', page: 1, page_size: 50 });
        if (cancelled || res?.success === false) return;
        const mapped = normalizeDietPlanList(res);
        if (mapped.length) setFilterCatalog((prev) => mergeFilterCatalog(prev, mapped));
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterSelects = [
    {
      key: 'prakriti',
      label: 'Prakriti',
      value: prakriti,
      set: setPrakriti,
      options: [{ label: 'All Prakriti', value: ALL }, ...filterCatalog.prakriti.map((v) => ({ label: v, value: v }))],
    },
    {
      key: 'disease',
      label: 'Health disease',
      value: diseaseFilter,
      set: setDiseaseFilter,
      options: [
        { label: 'All Diseases', value: ALL },
        ...filterCatalog.diseases.map((d) => ({ label: d.name, value: d.id })),
      ],
    },
    {
      key: 'paid',
      label: 'Paid status',
      value: paidFilter,
      set: setPaidFilter,
      options: [
        { label: 'All', value: ALL },
        { label: 'Free', value: 'false' },
        { label: 'Paid', value: 'true' },
      ],
    },
    {
      key: 'duration',
      label: 'Duration',
      value: durationFilter,
      set: setDurationFilter,
      options: [
        { label: 'All Durations', value: ALL },
        ...filterCatalog.durations.map((v) => ({ label: `${v} days`, value: v })),
      ],
    },
    {
      key: 'calories',
      label: 'Calories',
      value: caloriesFilter,
      set: setCaloriesFilter,
      options: [
        { label: 'All Calories', value: ALL },
        ...filterCatalog.calories.map((v) => ({ label: `${v} kcal`, value: v })),
      ],
    },
    {
      key: 'rating',
      label: 'Rating',
      value: ratingFilter,
      set: setRatingFilter,
      options: [
        { label: 'All ratings', value: ALL },
        { label: '4.5 & above', value: '4.5' },
        { label: '4.0 & above', value: '4' },
        { label: '3.5 & above', value: '3.5' },
        { label: '3.0 & above', value: '3' },
      ],
    },
    {
      key: 'sort',
      label: 'Sort by',
      value: sortFilter,
      set: setSortFilter,
      options: [
        { label: 'Default', value: ALL },
        { label: 'Popularity', value: 'popularity' },
        { label: 'Latest', value: 'latest' },
        { label: 'Highest rating', value: 'rating' },
      ],
    },
  ];

  const visible = useMemo(() => {
    // Same pass as the app: min rating (also sent to the API), then status, active first.
    const minRating = ratingFilter !== ALL ? Number(ratingFilter) : 0;
    const source =
      Number.isFinite(minRating) && minRating > 0
        ? plans.filter((p) => Number(p?.avg_rating ?? p?.my_rating ?? 0) >= minRating)
        : plans;
    const rank = (p) => {
      const st = getDietListStatus(p);
      if (st === 'active') return 0;
      if (st === 'paused') return 1;
      if (st === 'completed' || st === 'stopped') return 2;
      return 3;
    };
    const ranked = [...source].sort((a, b) => {
      const byStatus = rank(a) - rank(b);
      if (byStatus !== 0) return byStatus;
      if (sortFilter === 'rating') {
        return Number(b?.avg_rating ?? b?.my_rating ?? 0) - Number(a?.avg_rating ?? a?.my_rating ?? 0);
      }
      return 0;
    });
    if (statusTab === 'active') return ranked.filter((p) => getDietListStatus(p) === 'active');
    if (statusTab === 'inactive') return ranked.filter((p) => getDietListStatus(p) === 'paused');
    return ranked;
  }, [plans, statusTab, ratingFilter, sortFilter]);

  const { preview: activeDiet } = useActiveDietHome(true);

  const { categories: dashboardCategories } = useDashboardCategories();
  const medicineId = useMemo(
    () => getServiceCategoryId(dashboardCategories, 'medicine'),
    [dashboardCategories],
  );
  const [concerns, setConcerns] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getHealthCategories(
          medicineId ? { service_category_id: medicineId } : undefined,
        );
        if (!alive || res?.success === false) return;
        setConcerns(
          normalizeApiList(res)
            .map(mapProductCategory)
            .filter((item) => item.id),
        );
      } catch {
        if (alive) setConcerns([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [medicineId]);

  const showSkeleton = loadingList && plans.length === 0;
  const listTitle =
    statusTab === 'active' ? 'Active plans' : statusTab === 'inactive' ? 'Past plans' : H.dietTitle;

  const searchBar = (
      <PageBar className="am-page-bar--slot" id="dt-title" title={`${categoryName || 'Diet'} plans`}>
        <SearchField
          value={search}
          onChange={setSearch}
          onSubmit={(value) => setDebounced(String(value || '').trim())}
          placeholder="Search diet plans"
          label="Search diet plans"
          suggestions={searchSuggestions(plans)}
        />
      </PageBar>
  );

  return (
    <AppShell tab="home">
      <div className="hm-page svc-page">
        <div className="hm-body">


          <section className="hm-well hm-well--nourish dlp-list" aria-labelledby="dt-list-title">
            <SectionHead
              id="dt-list-title"
              title={listTitle}
              description={
                showSkeleton
                  ? H.dietText
                  : `${visible.length} ${visible.length === 1 ? 'plan' : 'plans'}`
              }
              action={
                <div className="am-head-tools">
                  {searchBar}
                  <Button
                    variant="accent"
                    onClick={() => navigate('/diet/weekly')}
                    leadingIcon={<Calendar size={16} aria-hidden />}
                    trailingIcon={<ArrowRight size={16} aria-hidden />}
                  >
                    Weekly planner
                  </Button>
                  {!wantsAll ? <ViewAll label={H.dietTitle} onClick={() => navigate('/diet?view=all')} /> : null}
                </div>
              }
            />

            <div className="dt-filters" role="group" aria-label="Filter diet plans">
              {filterSelects.map((f) => (
                <label key={f.key} className={`dt-filter${f.value !== ALL ? ' is-active' : ''}`}>
                  <span className="dt-filter-label">{f.label}</span>
                  <select value={f.value} onChange={(e) => f.set(e.target.value)} aria-label={f.label}>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="svc-chips" role="group" aria-label="Filter by plan status">
              {STATUS_TABS.map((tab) => (
                <Chip key={tab.key} selected={statusTab === tab.key} onClick={() => setStatusTab(tab.key)}>
                  {tab.label}
                </Chip>
              ))}
            </div>

            {showSkeleton ? (
              <SkeletonGrid count={8} className="svc-meal-grid" label="Loading diet plans" />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<Leaf size={28} />}
                title={
                  statusTab === 'active'
                    ? 'No active diet'
                    : statusTab === 'inactive'
                      ? 'No paused diets'
                      : 'No diet plans'
                }
                description={
                  statusTab === 'active'
                    ? "You don't have a diet in progress. Open All and start a plan."
                    : statusTab === 'inactive'
                      ? 'No plans are currently paused.'
                      : debounced
                    ? 'Try another search.'
                    : 'Plans for this concern will appear here when available.'
                }
              />
            ) : (
              <ul className="svc-meal-grid dlp-grid">
                {visible.map((item) => {
                  const price =
                    item.is_paid === false || Number(item.price) === 0
                      ? 'Free'
                      : formatRupee(item.price);
                  const duration = durationLabel(item);
                  const rating = getDietPlanRatingLabel(item);
                  return (
                    <li key={item.id}>
                      <DietListCard
                        title={item.title || item.name}
                        image={getDietPlanCoverUrl(item) || dietCoverImg}
                        status={getDietListStatus(item) || 'none'}
                        prakriti={item.prakriti}
                        duration={duration}
                        price={price}
                        rating={rating}
                        onOpen={() => navigate(`/diet/${item.id}`, { state: { item } })}
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {hasMore && plans.length > 0 ? (
              <div className="svc-more">
                <Button variant="secondary" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </section>

          {activeDiet ? <ActiveDietCard plan={activeDiet} /> : null}

          {concerns.length ? (
            <section className="hm-section hm-panel hm-concerns-panel" aria-labelledby="dt-concerns-title">
              <SectionHead
                id="dt-concerns-title"
                title={H.concernsTitle}
                description="Plans tuned for what you want to improve."
              />
              <ConcernCarousel label={H.concernsTitle}>
                {concerns.map((item) => (
                  <Tile
                    cutout
                    key={item.id}
                    image={item.image_url}
                    icon={Salad}
                    label={item.name}
                    onClick={() =>
                      navigate(
                        `/diet?category=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.name)}`,
                      )
                    }
                  />
                ))}
              </ConcernCarousel>
            </section>
          ) : null}

        </div>
      </div>
    </AppShell>
  );
}
