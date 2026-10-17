import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Calendar, Leaf, Salad } from 'lucide-react';
import AppShell from '../components/AppShell';
import { ActiveDietCard } from '../components/ActiveDietPlan';
import dietCoverImg from '/images/login/14.jpg';
import { DietPlanCard, SectionHead, ServiceHero, ViewAll } from '../components/ServiceHome';
import { formatRupee, mapProductCategory, normalizeApiList } from '../home/catalog';
import { getServiceCategoryId } from '../home/serviceCategories';
import useDashboardCategories from '../hooks/useDashboardCategories';
import useActiveDietHome from '../hooks/useActiveDietHome';
import { getHealthCategories } from '../services/productService';
import useDietPlans from '../diet/useDietPlans';
import {
  getDietListStatus,
  getDietPlanCoverUrl,
  getDietPlanRatingLabel,
} from '../diet/utils';
import {
  Button,
  Chip,
  ConcernCarousel,
  EmptyState,
  SearchField,
  SkeletonGrid,
  Tile,
} from '../components/ui';
import { HOME_COPY as H } from '../content/home';

const PRAKRITI = ['all', 'Vata', 'Pitta', 'Kapha', 'Vata-Pitta', 'Pitta-Kapha', 'Vata-Kapha'];
const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

const statusLabel = (plan) => {
  const status = getDietListStatus(plan);
  if (status === 'active') return 'Active';
  if (status === 'paused') return 'Paused';
  if (status === 'completed') return 'Completed';
  if (status === 'stopped') return 'Stopped';
  return 'Not started';
};

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
  const [prakriti, setPrakriti] = useState('all');
  const [statusTab, setStatusTab] = useState('all');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const listFilters = useMemo(
    () => ({
      search: debounced || undefined,
      prakriti: prakriti !== 'all' ? prakriti : undefined,
      health_category_id: !healthDiseaseId && healthCategoryId ? healthCategoryId : undefined,
      health_disease_id: healthDiseaseId || undefined,
    }),
    [debounced, prakriti, healthCategoryId, healthDiseaseId],
  );

  const { plans, loadingList, loadingMore, hasMore, loadMore } = useDietPlans({
    listType: wantsAll ? 'all' : null,
    listFilters,
  });

  const visible = useMemo(() => {
    if (statusTab === 'all') return plans;
    if (statusTab === 'active') return plans.filter((p) => getDietListStatus(p) === 'active');
    return plans.filter((p) => getDietListStatus(p) !== 'active');
  }, [plans, statusTab]);

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

  return (
    <AppShell tab="home">
      <div className="hm-page svc-page">
        <ServiceHero
          id="dt-title"
          eyebrow="Nourish"
          title={categoryName || 'Diet'}
          accent="plans."
          lede={H.dietText}
          trust={[
            { icon: Salad, label: 'Seasonal meals' },
            { icon: Leaf, label: 'Tuned to your Prakriti' },
            { icon: Calendar, label: 'Weekly planner' },
          ]}
        >
          <div className="svc-search">
            <SearchField
              value={search}
              onChange={setSearch}
              onSubmit={(value) => setDebounced(String(value || '').trim())}
              placeholder="Search diet plans"
              label="Search diet plans"
            />
          </div>
          <div className="hm-hero__ctas">
            <Button
              variant="accent"
              size="lg"
              className="hm-hero__primary"
              onClick={() => navigate('/diet/weekly')}
              leadingIcon={<Calendar size={16} aria-hidden />}
              trailingIcon={<ArrowRight size={16} aria-hidden />}
            >
              Weekly planner
            </Button>
          </div>
        </ServiceHero>

        <div className="hm-body">
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

          <section className="hm-well hm-well--nourish" aria-labelledby="dt-list-title">
            <SectionHead
              id="dt-list-title"
              title={listTitle}
              description={
                showSkeleton
                  ? H.dietText
                  : `${visible.length} ${visible.length === 1 ? 'plan' : 'plans'}`
              }
              action={
                !wantsAll ? <ViewAll label={H.dietTitle} onClick={() => navigate('/diet?view=all')} /> : null
              }
            />

            <div className="svc-chips" role="group" aria-label="Filter by prakriti">
              {PRAKRITI.map((item) => (
                <Chip key={item} selected={prakriti === item} onClick={() => setPrakriti(item)}>
                  {item === 'all' ? 'All prakriti' : item}
                </Chip>
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
                title="No diet plans"
                description={
                  debounced
                    ? 'Try another search.'
                    : 'Plans for this concern will appear here when available.'
                }
              />
            ) : (
              <ul className="svc-meal-grid">
                {visible.map((item) => {
                  const price =
                    item.is_paid === false || Number(item.price) === 0
                      ? 'Free'
                      : formatRupee(item.price);
                  const duration = durationLabel(item);
                  const rating = getDietPlanRatingLabel(item);
                  const meta = [duration, price, rating].filter(Boolean).join(' · ');
                  return (
                    <li key={item.id}>
                      <DietPlanCard
                        item={{
                          title: item.title || item.name,
                          thumbnail_url: getDietPlanCoverUrl(item) || dietCoverImg,
                          season: statusLabel(item),
                          short_description: item.short_description,
                          prakriti: [item.prakriti, meta].filter(Boolean).join(' · '),
                        }}
                        onClick={() => navigate(`/diet/${item.id}`, { state: { item } })}
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
        </div>
      </div>
    </AppShell>
  );
}
