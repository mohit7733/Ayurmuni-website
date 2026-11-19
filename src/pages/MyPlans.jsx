import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Clock,
  CreditCard,
  FlaskConical,
  Leaf,
  RefreshCw,
  Salad,
  Stethoscope,
  ClipboardList,
  Dumbbell,
  Zap,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Button, Chip, EmptyState, ErrorState, SearchField, SectionHold } from '../components/ui';
import { formatPlanMoney } from '../packages/planTheme';
import { requireAuth } from '../services/guestAuth';
import { getMyPackages, isPlanExpired } from '../services/packageService';
import PackageCount from '../components/PackageCount';
import {
  daysLeft,
  formatPlanDate,
  formatPlanTime,
  getPlanStatus,
  getPlanStatusKey,
  getPlanAmounts,
  humanize,
  planBenefitIcon,
  ownPurchaseBenefits,
  ALL_PLAN_STATUSES,
  PLAN_STATUS_TABS,
  readPlanPage,
} from '../utils/planUtils';
import '../design/pages/orders.css';
import '../design/pages/my-plans.css';

const ICONS = {
  consult: Stethoscope,
  diet: Salad,
  yoga: Dumbbell,
  assessment: ClipboardList,
  lab: FlaskConical,
  leaf: Leaf,
};

const collectPlans = async (value, searchText, startPage) => {
  const list = [];
  let page = startPage;
  let next = null;
  let failed = null;
  for (let guard = 0; guard < 8; guard += 1) {
    const res = await getMyPackages({ page, page_size: 50, status: value, search: searchText });
    if (res?.success === false) {
      failed = res;
      break;
    }
    const pageData = readPlanPage(res);
    list.push(...pageData.list);
    if (!pageData.next) {
      next = null;
      break;
    }
    next = pageData.next;
    page += 1;
  }
  return { list, next, failed };
};

const BenefitIcon = ({ label, size = 15 }) => {
  const Icon = ICONS[planBenefitIcon(label)] || Leaf;
  return <Icon size={size} aria-hidden />;
};

function PlanCard({ plan, highlighted }) {
  const expired = isPlanExpired(plan);
  const statusKey = getPlanStatusKey(plan);
  const status = getPlanStatus(plan);
  const pending = plan.status === 'pending';
  const autopay = Boolean(plan.billing_mode) && plan.billing_mode !== 'one_time';
  const { amount, saved, original } = getPlanAmounts(plan);
  const remainingDays = daysLeft(plan.expires_at);
  const startDate = formatPlanDate(plan.starts_at);
  const startTime = formatPlanTime(plan.starts_at);
  const expiryDate = formatPlanDate(plan.expires_at);
  const expiryTime = formatPlanTime(plan.expires_at);
  const benefits = ownPurchaseBenefits(plan);
  const showValidity = Boolean(expiryDate) && remainingDays !== null && plan.status === 'active' && !expired;
  const cardRef = useRef(null);

  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [highlighted]);

  return (
    <article
      ref={cardRef}
      className={`mp-card${highlighted ? ' is-highlight' : ''}`}
      data-status={statusKey}
      aria-label={plan.name}
    >
      <div className="mp-hero">
        <div className="mp-hero__top">
          <span className="mp-brand">
            <Award size={14} aria-hidden /> AyurMuni care plan
          </span>
          <span className="mp-status">
            <i aria-hidden />
            {status.label}
          </span>
        </div>
        <h2 className="mp-name">{plan.name}</h2>
        <div className="mp-hero__bottom">
          <div>
            <span className="mp-label">{pending ? 'Plan amount' : 'Amount paid'}</span>
            <span className="mp-price">
              {formatPlanMoney(amount)}
              {plan.currency ? <small>{plan.currency}</small> : null}
            </span>
            {saved > 0 ? (
              <p className="mp-saved">
                Saved {formatPlanMoney(saved)} on {formatPlanMoney(original)}
              </p>
            ) : null}
          </div>
          {showValidity ? (
            <div className="mp-days">
              <strong>{remainingDays}</strong>
              <span>day{remainingDays === 1 ? '' : 's'} left</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mp-body">
        {pending ? (
          <p className="mp-note">
            <Clock size={14} aria-hidden />
            Payment confirmation pending. Your plan activates once it&apos;s confirmed.
          </p>
        ) : null}
        {expired ? (
          <p className="mp-note is-danger">
            <AlertCircle size={14} aria-hidden />
            {expiryDate ? `This plan expired on ${expiryDate}.` : 'This plan has expired.'} Its benefits can no longer be
            used.
          </p>
        ) : null}

        {startDate || expiryDate ? (
          <div className="mp-dates">
            {startDate ? (
              <div className="mp-dates__cell">
                <small>Started</small>
                <strong>{startDate}</strong>
                {startTime ? <span>{startTime}</span> : null}
              </div>
            ) : null}
            {expiryDate ? (
              <div className="mp-dates__cell">
                <small>{expired ? 'Expired on' : 'Valid till'}</small>
                <strong>{expiryDate}</strong>
                {expiryTime ? <span>{expiryTime}</span> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {plan.billing_mode || plan.cancel_at_period_end ? (
          <div className="mp-chips">
            {/* {plan.billing_mode ? (
              <span className="mp-chip">
                {autopay ? <RefreshCw size={12} aria-hidden /> : <CreditCard size={12} aria-hidden />}
                {autopay ? 'Autopay' : 'One-time payment'}
              </span>
            ) : null} */}
            {autopay && plan.autopay_status ? (
              <span className="mp-chip">
                <Zap size={12} aria-hidden />
                Autopay {humanize(plan.autopay_status)}
              </span>
            ) : null}
            {plan.cancel_at_period_end ? (
              <span className="mp-chip is-warn">
                <AlertCircle size={12} aria-hidden />
                Ends at period end
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mp-benefits-block">
          <h3 className="mp-section">Your benefits</h3>
          {benefits.length > 0 ? (
            <ul className="mp-benefits">
              {benefits.map((benefit, index) => (
                <li className="mp-benefit" key={`${plan.id}-${index}`}>
                  <span className="mp-benefit__icon">
                    <BenefitIcon label={benefit.label} />
                  </span>
                  <div className="mp-benefit__body">
                    <p className="mp-benefit__label">{benefit.label}</p>
                    <PackageCount remaining={benefit.remaining} total={benefit.total} expired={expired} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mp-benefits__empty">No benefits listed for this plan.</p>
          )}
        </div>

        <p className="mp-id">Plan ID · {String(plan.id).slice(0, 8).toUpperCase()}</p>
      </div>
    </article>
  );
}

export default function MyPlans() {
  const navigate = useNavigate();
  const location = useLocation();
  const highlightId = location.state?.highlightId || new URLSearchParams(location.search).get('highlight') || '';
  const [status, setStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [plans, setPlans] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [authed, setAuthed] = useState(true);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  const fetchPage = useCallback(
    async (nextPage, mode) => {
      const requestId = ++requestRef.current;
      if (mode === 'more') setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        const statuses = status ? [status] : ALL_PLAN_STATUSES;
        const responses = await Promise.all(statuses.map((value) => collectPlans(value, search, nextPage)));
        if (requestId !== requestRef.current) return;
        const failed = responses.find((entry) => entry.failed);
        const seen = new Set();
        const list = [];
        let next = null;
        responses.forEach((entry) => {
          entry.list.forEach((plan) => {
            if (!plan?.id || seen.has(plan.id)) return;
            seen.add(plan.id);
            list.push(plan);
          });
          if (entry.next) next = entry.next;
        });
        if (!list.length && failed) throw new Error(failed.message || 'Failed to load');
        setPlans((prev) => (mode === 'more' ? [...prev, ...list] : list));
        setHasMore(Boolean(next));
        setPage(nextPage);
      } catch (err) {
        if (requestId !== requestRef.current) return;
        setError(err?.message || 'Failed to load');
        if (mode !== 'more') {
          setPlans([]);
          setHasMore(false);
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [status, search],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await requireAuth('Sign in to view your plans.');
      if (cancelled) return;
      setAuthed(ok);
      if (ok) fetchPage(1, 'initial');
      else setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  return (
    <AppShell tab="profile">
      <section className="or-page mp-page">
        <PageHeader
          title="My Plans"
          subtitle="Care plans you have purchased"
          backTo="/profile"
          actions={
            <div className="mp-toolbar">
              <SearchField
                value={searchText}
                onChange={setSearchText}
                placeholder="Search your plans"
                label="Search your plans"
              />
              <div className="mp-filters" role="group" aria-label="Plan status">
                {PLAN_STATUS_TABS.map((tab) => (
                  <Chip key={tab.label} selected={tab.value === status} onClick={() => setStatus(tab.value)}>
                    {tab.label}
                  </Chip>
                ))}
              </div>
            </div>
          }
        />

        {loading ? (
          <SectionHold label="Loading plans" minHeight={280} />
        ) : !authed ? (
          <EmptyState
            icon={<Award size={28} />}
            title="Sign in to view your plans"
            description="Your purchased care plans are available on your AyurMuni account."
            action={
              <Button variant="primary" onClick={() => requireAuth('Sign in to view your plans.')}>
                Sign in
              </Button>
            }
          />
        ) : error && plans.length === 0 ? (
          <ErrorState title="Could not load your plans" description={error} onRetry={() => fetchPage(1, 'initial')} />
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<Award size={28} />}
            title="No plans yet"
            description="Care plans you buy will show up here."
            action={
              <Button variant="primary" onClick={() => navigate('/packages')}>
                Explore care plans
              </Button>
            }
          />
        ) : (
          <>
            <div className="mp-list">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} highlighted={plan.id === highlightId} />
              ))}
            </div>
            {hasMore ? (
              <div className="mp-more">
                <Button variant="secondary" loading={loadingMore} onClick={() => fetchPage(page + 1, 'more')}>
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}
