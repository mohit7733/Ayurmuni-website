import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import dietCoverImg from '/images/login/14.jpg';
import { formatRupee } from '../home/catalog';
import useDietPlans from '../diet/useDietPlans';
import {
  getDietListStatus,
  getDietPlanCoverUrl,
  getDietPlanRatingLabel,
} from '../diet/utils';
import '../design/pages/diet.css';

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
  return '';
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

  return (
    <AppShell tab="home">
      <section className="catalog-page diet-page">
        <header className="catalog-head">
          <div>
            <button type="button" className="text-back" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <h1>{categoryName ? `${categoryName} Diet` : 'Diet Plans'}</h1>
            <p>Personalized Ayurveda meal plans</p>
          </div>
          <div className="diet-chips" role="group" aria-label="Diet plan shortcuts">
            <button type="button" className="chip" onClick={() => navigate('/diet/weekly')}>
              Weekly planner
            </button>
            {!wantsAll ? (
              <button type="button" className="chip" onClick={() => navigate('/diet?view=all')}>
                View all
              </button>
            ) : null}
          </div>
        </header>

        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setDebounced(search.trim());
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search diet plans..."
          />
          <button type="submit" className="cta">
            Search
          </button>
        </form>

        <div
          className="diet-chips diet-prakriti-filters"
          role="group"
          aria-label="Filter by prakriti"
        >
          {PRAKRITI.map((item) => (
            <button
              key={item}
              type="button"
              className={`chip ${prakriti === item ? 'on' : ''}`}
              onClick={() => setPrakriti(item)}
            >
              {item === 'all' ? 'All prakriti' : item}
            </button>
          ))}
        </div>

        <div
          className="diet-chips diet-status-filters"
          role="group"
          aria-label="Filter by plan status"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`chip ${statusTab === tab.key ? 'on' : ''}`}
              onClick={() => setStatusTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loadingList && plans.length === 0 ? (
          <p className="muted">Loading diet plans…</p>
        ) : visible.length === 0 ? (
          <div className="empty-copy">
            <strong>No diet plans</strong>
            <p>
              {debounced
                ? 'Try another search.'
                : 'Plans for this concern will appear here when available.'}
            </p>
          </div>
        ) : (
          <>
            <div className="diet-results-heading">
              <h2>
                {statusTab === 'active'
                  ? 'Active plans'
                  : statusTab === 'inactive'
                    ? 'Past plans'
                    : 'Available plans'}
              </h2>
              <span>
                {visible.length} {visible.length === 1 ? 'plan' : 'plans'}
              </span>
            </div>
            <div className="diet-grid">
              {visible.map((item) => {
                const cover = getDietPlanCoverUrl(item) || dietCoverImg;
                const rating = getDietPlanRatingLabel(item);
                const status = statusLabel(item);
                const price =
                  item.is_paid === false || Number(item.price) === 0
                    ? 'Free'
                    : formatRupee(item.price);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="diet-card"
                    onClick={() => navigate(`/diet/${item.id}`, { state: { item } })}
                  >
                    <div className="diet-card-media">
                      <img src={cover} alt="" />
                      {status ? (
                        <span className={`diet-status ${getDietListStatus(item)}`}>{status}</span>
                      ) : null}
                    </div>
                    <strong>{item.title || item.name}</strong>
                    <small>
                      {[item.prakriti, item.season, price].filter(Boolean).join(' • ')}
                    </small>
                    {rating ? <em>★ {rating}</em> : null}
                    {item.short_description ? <p>{item.short_description}</p> : null}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {hasMore && plans.length > 0 ? (
          <button
            type="button"
            className="ghost diet-more"
            disabled={loadingMore}
            onClick={loadMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
      </section>
    </AppShell>
  );
}
