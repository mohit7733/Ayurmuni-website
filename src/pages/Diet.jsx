import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Check, ChevronDown, Leaf, Salad, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import { ActiveDietCard } from '../components/ActiveDietPlan';
import dietCoverImg from '/images/login/14.webp';
import { SectionHead, ViewAll } from '../components/ServiceHome';
import DietListCard from '../components/DietListCard';
import '../design/pages/store.css';
import '../design/brand.css';
import '../design/product-card-home.css';
import '../design/pages/products.css';
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
  ConcernCarousel,
  EmptyState,
  PageBar,
  SearchField,
  searchSuggestions,
  SkeletonGrid,
  Tile,
} from '../components/ui';
import { HOME_COPY as H } from '../content/home';
import { DIET_COPY as D } from '../content/diet';

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
/**
 * Collapsible sidebar filter group (products page st-cat-filter look).
 * type "multi" = checkboxes (values[]), type "single" = radios (value).
 */
function FilterGroup({ id, label, type = 'multi', values = [], value, options, onToggle, onChange, onClear }) {
  const multi = type === 'multi';
  const picked = multi ? values : value !== ALL ? [value] : [];
  const active = picked.length > 0;
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  const summary =
    picked.length > 1
      ? `${picked.length} selected`
      : active
        ? options.find((o) => o.value === picked[0])?.label || ''
        : '';
  const panelId = `${id}-panel`;
  return (
    <div className={`dt-fgroup${open ? ' is-open' : ''}`}>
      <h3 className="dt-fgroup__head">
        <button
          type="button"
          id={id}
          className="dt-fgroup__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="dt-fgroup__label">{label}</span>
          {active && !open ? <span className="dt-fgroup__value">{summary}</span> : null}
          {active ? <span className="dt-fgroup__dot" aria-label="filter applied" /> : null}
          <ChevronDown size={16} className="dt-fgroup__chev" aria-hidden />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={id} className="dt-fgroup__panel" inert={!open}>
        <div className="dt-fgroup__inner">
          <ul className="dt-opts" role={multi ? 'group' : 'radiogroup'} aria-labelledby={id}>
            {options.map((o) => {
              const on = picked.includes(o.value);
              const disabled = o.count === 0 && !on;
              return (
                <li key={o.value}>
                  <label className={`dt-opt${on ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}>
                    <input
                      type={multi ? 'checkbox' : 'radio'}
                      name={multi ? undefined : id}
                      checked={on}
                      disabled={disabled}
                      onChange={() => (multi ? onToggle(o.value) : onChange(o.value))}
                    />
                    <span className={`dt-opt__box${multi ? '' : ' is-radio'}`} aria-hidden>
                      {multi && on ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <span className="dt-opt__label">{o.label}</span>
                    {typeof o.count === 'number' ? <span className="dt-opt__count">{o.count}</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
          {active && onClear ? (
            <button type="button" className="dt-fgroup__clear" onClick={onClear}>
              Clear {label.toLowerCase()}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Paused' },
];
const MULTI_GROUPS = [
  { key: 'status', label: 'Plan status' },
  { key: 'prakriti', label: 'Prakriti' },
  { key: 'disease', label: 'Health concern' },
  { key: 'paid', label: 'Price' },
  { key: 'duration', label: 'Duration' },
  { key: 'calories', label: 'Calories' },
];
const EMPTY_SELECTION = { status: [], prakriti: [], disease: [], paid: [], duration: [], calories: [] };
const isFreePlan = (p) => p?.is_paid === false || Number(p?.price) === 0;
const GROUP_MATCH = {
  status: (p, v) => getDietListStatus(p) === (v === 'active' ? 'active' : 'paused'),
  prakriti: (p, v) => String(p?.prakriti || '').trim().toLowerCase() === String(v).toLowerCase(),
  disease: (p, v) => (Array.isArray(p?.health_diseases) ? p.health_diseases : []).some((d) => String(d?.id ?? '') === v),
  paid: (p, v) => (v === 'false' ? isFreePlan(p) : !isFreePlan(p)),
  duration: (p, v) => planDurationValue(p) === v,
  calories: (p, v) => planCaloriesValue(p) === v,
};
/** OR within a group, AND across groups; `skip` leaves one group out (for facet counts). */
const planPasses = (plan, sel, skip) =>
  MULTI_GROUPS.every(
    ({ key }) => key === skip || !sel[key].length || sel[key].some((v) => GROUP_MATCH[key](plan, v)),
  );

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
  // Multi-select groups (OR within a group, AND across groups) - filtered client-side.
  const [selected, setSelected] = useState(EMPTY_SELECTION);
  const [sortFilter, setSortFilter] = useState(ALL);
  const [ratingFilter, setRatingFilter] = useState(ALL);
  const [filterCatalog, setFilterCatalog] = useState({
    prakriti: DEFAULT_PRAKRITI,
    diseases: [],
    durations: DEFAULT_DURATIONS,
    calories: DEFAULT_CALORIES,
  });
  const statusSel = selected.status;
  const statusTab = statusSel.length === 1 ? statusSel[0] : 'all';
  const toggleOption = (key, value) =>
    setSelected((prev) => {
      const cur = prev[key];
      return { ...prev, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  const clearGroup = (key) => setSelected((prev) => ({ ...prev, [key]: [] }));

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const listFilters = useMemo(
    () => ({
      search: debounced || undefined,
      health_category_id: !healthDiseaseId && healthCategoryId ? healthCategoryId : undefined,
      health_disease_id: healthDiseaseId || undefined,
      min_rating: ratingFilter !== ALL ? ratingFilter : undefined,
      sort: ['popularity', 'latest', 'rating'].includes(sortFilter)
        ? sortFilter === 'rating'
          ? 'ratings'
          : sortFilter
        : undefined,
    }),
    [
      ratingFilter,
      debounced,
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

  const ratingSelect = {
    key: 'rating',
    label: 'Rating',
    value: ratingFilter,
    set: setRatingFilter,
    options: [
      { label: 'Any rating', value: ALL },
      { label: '4.5 & up', value: '4.5' },
      { label: '4.0 & up', value: '4' },
      { label: '3.5 & up', value: '3.5' },
      { label: '3.0 & up', value: '3' },
    ],
  };
  const sortSelect = {
    key: 'sort',
    value: sortFilter,
    set: setSortFilter,
    options: [
      { label: 'Default', value: ALL },
      { label: 'Popularity', value: 'popularity' },
      { label: 'Latest', value: 'latest' },
      { label: 'Highest rating', value: 'rating' },
    ],
  };
  const groupOptions = {
    status: STATUS_OPTIONS,
    prakriti: filterCatalog.prakriti.map((v) => ({ label: v, value: v })),
    disease: filterCatalog.diseases.map((d) => ({ label: d.name, value: d.id })),
    paid: [
      { label: 'Free', value: 'false' },
      { label: 'Paid', value: 'true' },
    ],
    duration: filterCatalog.durations.map((v) => ({ label: `${v} days`, value: v })),
    calories: filterCatalog.calories.map((v) => ({ label: `${v} kcal`, value: v })),
  };
  // Facet counts: plans matching every other group plus this option.
  const multiGroups = MULTI_GROUPS.map((g) => {
    const others = plans.filter((plan) => planPasses(plan, selected, g.key));
    const options = groupOptions[g.key]
      .map((o) => ({ ...o, count: others.filter((plan) => GROUP_MATCH[g.key](plan, o.value)).length }))
      .filter((o) => o.count > 0 || selected[g.key].includes(o.value));
    return { ...g, values: selected[g.key], options };
  }).filter((g) => g.options.length > 1 || g.values.length > 0);
  const appliedChips = [
    ...MULTI_GROUPS.flatMap((g) =>
      selected[g.key].map((v) => ({
        id: `${g.key}:${v}`,
        label: groupOptions[g.key].find((o) => o.value === v)?.label || v,
        remove: () => toggleOption(g.key, v),
      })),
    ),
    ...(ratingFilter !== ALL
      ? [
          {
            id: 'rating',
            label: ratingSelect.options.find((o) => o.value === ratingFilter)?.label || ratingFilter,
            remove: () => setRatingFilter(ALL),
          },
        ]
      : []),
  ];
  const hasActiveFilters = appliedChips.length > 0;
  const clearFilters = () => {
    setSelected(EMPTY_SELECTION);
    setRatingFilter(ALL);
  };
  const visible = useMemo(() => {
    // Same pass as the app: min rating (also sent to the API), then status, active first.
    const minRating = ratingFilter !== ALL ? Number(ratingFilter) : 0;
    const source =
      Number.isFinite(minRating) && minRating > 0
        ? plans.filter((p) => Number(p?.avg_rating ?? p?.my_rating ?? 0) >= minRating)
        : plans;
    const matched = source.filter((p) => planPasses(p, selected));
    const rank = (p) => {
      const st = getDietListStatus(p);
      if (st === 'active') return 0;
      if (st === 'paused') return 1;
      if (st === 'completed' || st === 'stopped') return 2;
      return 3;
    };
    const ranked = [...matched].sort((a, b) => {
      const byStatus = rank(a) - rank(b);
      if (byStatus !== 0) return byStatus;
      if (sortFilter === 'rating') {
        return Number(b?.avg_rating ?? b?.my_rating ?? 0) - Number(a?.avg_rating ?? a?.my_rating ?? 0);
      }
      return 0;
    });
    return ranked;
  }, [plans, selected, ratingFilter, sortFilter]);

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
    statusTab === 'active'
      ? D.activeTitle
      : statusTab === 'inactive'
        ? D.pastTitle
        : categoryName
          ? D.listTitleFor(categoryName)
          : D.listTitle;
  const listText = categoryName ? D.listTextFor(categoryName) : D.listText;

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


          <section className="st-section st-panel st-page--products dt-shop" aria-labelledby="dt-list-title">
            <SectionHead
              id="dt-list-title"
              title={listTitle}
              description={listText}
              action={!wantsAll ? <ViewAll label={H.dietTitle} onClick={() => navigate('/diet?view=all')} /> : null}
            />

            <div className="st-catalog">
              <nav className="st-cat-col dt-filter-col" aria-label="Filter diet plans">
                <p className="st-cat-col__eyebrow">Filter</p>
                {multiGroups.map((g) => (
                  <FilterGroup
                    key={g.key}
                    id={`dt-f-${g.key}`}
                    label={g.label}
                    values={g.values}
                    options={g.options}
                    onToggle={(v) => toggleOption(g.key, v)}
                    onClear={() => clearGroup(g.key)}
                  />
                ))}
                <FilterGroup
                  id="dt-f-rating"
                  label="Rating"
                  type="single"
                  value={ratingFilter}
                  options={ratingSelect.options}
                  onChange={setRatingFilter}
                  onClear={() => setRatingFilter(ALL)}
                />
              </nav>

              <div className="st-catalog__main">
                <div className="st-controls">
                  <div className="st-controls__info">
                    <span>{showSkeleton ? D.loading : D.count(visible.length)}</span>
                    {hasActiveFilters ? (
                      <Button variant="ghost" size="sm" onClick={clearFilters} leadingIcon={<X size={14} />}>
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                  {searchBar}
                  <div className="st-controls__actions">
                    {sortSelect ? (
                      <select
                        value={sortSelect.value}
                        onChange={(e) => sortSelect.set(e.target.value)}
                        className="st-sort-select"
                        aria-label="Sort diet plans"
                      >
                        {sortSelect.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.value === ALL ? 'Sort: Default' : `Sort: ${o.label}`}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate('/diet/weekly')}
                      leadingIcon={<Calendar size={16} aria-hidden />}
                    >
                      Weekly planner
                    </Button>
                  </div>
                </div>

                {appliedChips.length ? (
                  <div className="dt-applied" aria-label="Applied filters">
                    {appliedChips.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="dt-applied__chip"
                        onClick={c.remove}
                        aria-label={`Remove ${c.label} filter`}
                      >
                        {c.label}
                        <X size={13} aria-hidden />
                      </button>
                    ))}
                    <button type="button" className="dt-applied__clear" onClick={clearFilters}>
                      Clear all
                    </button>
                  </div>
                ) : null}

                {showSkeleton ? (
                  <SkeletonGrid count={8} className="am-product-grid" label="Loading diet plans" />
                ) : visible.length === 0 ? (
                <EmptyState
                  icon={<Leaf size={28} />}
                  title={
                    statusTab === 'active'
                      ? D.emptyActiveTitle
                      : statusTab === 'inactive'
                        ? D.emptyPausedTitle
                        : debounced
                          ? D.emptySearchTitle
                          : D.emptyTitle
                  }
                  description={
                    statusTab === 'active'
                      ? D.emptyActiveText
                      : statusTab === 'inactive'
                        ? D.emptyPausedText
                        : debounced
                          ? D.emptySearchText
                          : D.emptyText
                  }
                  action={
                    statusTab !== 'inactive' ? (
                      <Button
                        onClick={() => {
                          setSelected(EMPTY_SELECTION);
                          setSearch('');
                          setDebounced('');
                          navigate('/diet?view=all');
                        }}
                      >
                        {D.browseAll}
                      </Button>
                    ) : null
                  }
                />
                ) : (
                  <ul className="am-product-grid">
                    {visible.map((item) => {
                      const price =
                        item.is_paid === false || Number(item.price) === 0 ? 'Free' : formatRupee(item.price);
                      return (
                        <li key={item.id}>
                          <DietListCard
                            title={item.title || item.name}
                            image={getDietPlanCoverUrl(item) || dietCoverImg}
                            status={getDietListStatus(item) || 'none'}
                            prakriti={item.prakriti}
                            duration={durationLabel(item)}
                            calories={planCaloriesValue(item)}
                            price={price}
                            rating={getDietPlanRatingLabel(item)}
                            onOpen={() => navigate(`/diet/${item.id}`, { state: { item } })}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}

                {hasMore && plans.length > 0 ? (
                  <div className="st-more">
                    <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
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
