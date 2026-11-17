import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Leaf, Salad } from 'lucide-react';
import dietCoverImg from '/images/login/14.webp';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Badge, Button, EmptyState, Tabs } from '../components/ui';
import { formatRupee } from '../home/catalog';
import { requireAuth } from '../services/guestAuth';
import { getMyDietPlans } from '../services/dietService';
import {
  getDietListStatus,
  getDietPlanCoverUrl,
  normalizeDietPlanList,
} from '../diet/utils';
import '../design/pages/orders.css';

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'purchased', label: 'Purchased' },
];

const durationLabel = (plan) => {
  if (plan?.duration) return String(plan.duration);
  const days = Number(plan?.duration_days ?? plan?.total_days);
  return Number.isFinite(days) && days > 0 ? `${days} days` : '';
};

const priceLabel = (plan) =>
  plan?.is_paid === false || Number(plan?.price) === 0 ? 'Free' : formatRupee(plan?.price);

const statusTone = (status) => {
  if (status === 'active') return 'success';
  if (status === 'paused') return 'warning';
  if (status === 'completed') return 'info';
  return 'neutral';
};

export default function MyDiets() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('active');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      if (!(await requireAuth('Please login to view your diets'))) return;
      try {
        const params =
          tab === 'purchased'
            ? { page: 1, page_size: 40, is_purchased: 'true' }
            : { page: 1, page_size: 40, patient_assignment_status: 'active' };
        const res = await getMyDietPlans(params);
        if (!alive) return;
        const list = res?.success === false ? [] : normalizeDietPlanList(res);
        setPlans(tab === 'active' ? list.filter((plan) => getDietListStatus(plan) === 'active') : list);
      } catch {
        if (alive) setPlans([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab]);

  return (
    <AppShell tab="profile">
      <section className="or-page or-page--history">
        <PageHeader
          title="Your diets"
          subtitle="The plan you are following, and the plans you have already bought."
          backTo="/profile"
          backLabel="Profile"
        />

        <Tabs label="Diet plans" value={tab} onChange={setTab} items={TABS} />

        {loading ? (
          <p className="or-row__meta" role="status">
            Loading diets…
          </p>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<Salad size={28} />}
            title={tab === 'active' ? 'No diet is active right now' : 'No purchased diet plans yet'}
            description={
              tab === 'active'
                ? 'Start a plan and it will show up here.'
                : 'Paid plans you buy will be listed in this tab.'
            }
            action={
              <Button onClick={() => navigate('/diet')}>Browse diet plans</Button>
            }
          />
        ) : (
          <div className="or-list">
            {plans.map((plan) => {
              const status = getDietListStatus(plan);
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
                    {status && status !== 'none' ? (
                      <Badge tone={statusTone(status)}>{status.replace(/_/g, ' ')}</Badge>
                    ) : null}
                  </div>
                  <ChevronRight className="or-row__chev" size={18} aria-hidden />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
