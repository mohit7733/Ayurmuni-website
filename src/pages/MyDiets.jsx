import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Leaf, Salad } from 'lucide-react';
import dietCoverImg from '/images/login/14.webp';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Badge, Button, EmptyState } from '../components/ui';
import { formatRupee } from '../home/catalog';
import { requireAuth } from '../services/guestAuth';
import { getMyDietPlans } from '../services/dietService';
import {
  getDietListStatus,
  getDietPlanCoverUrl,
  normalizeDietPlanList,
} from '../diet/utils';
import '../design/pages/orders.css';

const STATUS_FILTERS = [
  { id: 'all', mark: 'All', label: 'All diets', hint: 'Every plan' },
  { id: 'active', mark: 'On', label: 'Active', hint: 'Following now' },
  { id: 'purchased', mark: 'Buy', label: 'Purchased', hint: 'Plans you bought' },
  { id: 'paused', mark: 'Pa', label: 'Paused', hint: 'On hold' },
  { id: 'in_progress', mark: 'In', label: 'In progress', hint: 'Started' },
  { id: 'completed', mark: 'Do', label: 'Completed', hint: 'Finished' },
  { id: 'stopped', mark: 'St', label: 'Stopped', hint: 'Ended' },
];

const EMPTY_COPY = {
  all: ['No diet plans yet', 'Start a plan and it will show up here.'],
  active: ['No diet is active right now', 'Start a plan and it will show up here.'],
  purchased: ['No purchased diet plans yet', 'Paid plans you buy will be listed here.'],
  paused: ['No paused diets', 'Plans you pause will be listed here.'],
  in_progress: ['No diets in progress', 'A plan you have started will be listed here.'],
  completed: ['No completed diets', 'Finished plans will be listed here.'],
  stopped: ['No stopped diets', 'Plans you stop will be listed here.'],
};

const durationLabel = (plan) => {
  if (plan?.duration) return String(plan.duration);
  const days = Number(plan?.duration_days ?? plan?.total_days);
  return Number.isFinite(days) && days > 0 ? `${days} days` : '';
};

const priceLabel = (plan) =>
  plan?.is_paid === false || Number(plan?.price) === 0 ? 'Free' : formatRupee(plan?.price);

const statusTone = (status) => {
  if (status === 'active' || status === 'in_progress') return 'success';
  if (status === 'paused') return 'warning';
  if (status === 'completed') return 'info';
  return 'neutral';
};

export default function MyDiets() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('active');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      if (!(await requireAuth('Please login to view your diets'))) return;
      try {
        const params = { page: 1, page_size: 40 };
        if (status === 'purchased') params.is_purchased = 'true';
        else if (status !== 'all') params.patient_assignment_status = status;
        const res = await getMyDietPlans(params);
        if (!alive) return;
        setPlans(res?.success === false ? [] : normalizeDietPlanList(res));
      } catch {
        if (alive) setPlans([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [status]);

  return (
    <AppShell tab="profile">
      <section className="or-page or-page--history md-page">
        <PageHeader
          title="Your diets"
          subtitle="Plans grouped by where you are with them."
          backTo="/profile"
          backLabel="Profile"
        />

        <div className="md-layout">
          <aside className="st-cat-col md-filter" aria-labelledby="md-filter-title">
            <p className="st-cat-col__eyebrow">Filter</p>
            <h3 id="md-filter-title">Diet status</h3>
            <ul className="st-cat-filter">
              {STATUS_FILTERS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={status === item.id}
                    className={status === item.id ? 'is-on' : ''}
                    onClick={() => setStatus(item.id)}
                  >
                    <span className="st-cat-filter__mark" aria-hidden>
                      {item.mark}
                    </span>
                    <span className="st-cat-filter__copy">
                      <strong>{item.label}</strong>
                      <em>{item.hint}</em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="md-main">
        {loading ? (
          <p className="or-row__meta" role="status">
            Loading diets…
          </p>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<Salad size={28} />}
            title={EMPTY_COPY[status][0]}
            description={EMPTY_COPY[status][1]}
            action={
              <Button onClick={() => navigate('/diet')}>Browse diet plans</Button>
            }
          />
        ) : (
          <div className="or-list">
            {plans.map((plan) => {
              const planStatus = getDietListStatus(plan);
              const cover = getDietPlanCoverUrl(plan) || dietCoverImg;
              const routeId = String(plan.diet_plan_id || plan.id || '').trim();
              const meta = [durationLabel(plan), plan.prakriti, priceLabel(plan)].filter(Boolean);
              return (
                <button
                  key={plan.patient_diet_plan_id || plan.id}
                  type="button"
                  className="or-row"
                  onClick={() => routeId && navigate(`/diet/${routeId}`)}
                >
                  <span className="or-row__thumbs" aria-hidden>
                    <span className="or-row__thumb">
                      {cover ? <img src={cover} alt="" loading="lazy" /> : <Leaf size={22} />}
                    </span>
                  </span>
                  <div className="or-row__body">
                    <p className="or-row__title">{plan.title || plan.name || 'Diet plan'}</p>
                    {meta.length ? <p className="or-row__meta or-row__meta--line">{meta.map((item) => <span key={item}>{item}</span>)}</p> : null}
                  </div>
                  <div className="or-row__aside">
                    {planStatus && planStatus !== 'none' ? (
                      <Badge tone={statusTone(planStatus)}>{planStatus.replace(/_/g, ' ')}</Badge>
                    ) : null}
                  </div>
                  <ChevronRight className="or-row__chev" size={18} aria-hidden />
                </button>
              );
            })}
          </div>
        )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
