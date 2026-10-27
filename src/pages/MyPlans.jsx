import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Button, Chip, EmptyState, ErrorState, SearchField, Skeleton } from '../components/ui';
import { formatRupee } from '../home/catalog';
import { requireAuth } from '../services/guestAuth';
import { getMyPackages, isPlanExpired } from '../services/packageService';
import {
  buildPlanNameMap,
  daysLeft,
  formatPlanDate,
  formatPlanTime,
  getPlanStatus,
  getPlanStatusKey,
  getPlanAmounts,
  humanize,
  planBenefitIcon,
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

const BenefitIcon = ({ label, size = 15 }) => {
  const Icon = ICONS[planBenefitIcon(label)] || Leaf;
  return <Icon size={size} aria-hidden />;
};

function ShiftedRow({ item, fromPlanName }) {
  const total = item.quantity_total ?? 0;
  const remaining = item.quantity_remaining ?? 0;
  const hasQuantity = total > 0;
  const exhausted = hasQuantity && remaining <= 0;
  const shiftedOn = formatPlanDate(item.valid_from);
  const validTill = formatPlanDate(item.valid_until);
  const originalTill = formatPlanDate(item.original_valid_until);
  const fromLabel =
    fromPlanName ||
    (item.shifted_from_purchase ? `Plan #${String(item.shifted_from_purchase).slice(0, 8).toUpperCase()}` : '');
  return (
    <li className="mp-benefit is-shifted">
      <span className="mp-benefit__icon">
        <BenefitIcon label={item.label} />
      </span>
      <div className="mp-benefit__body">
        <div className="mp-benefit__top">
          <p className="mp-benefit__label">{item.label}</p>
          <span className="mp-benefit__pill">{humanize(item.status) || 'Shifted'}</span>
        </div>
        {fromLabel ? <p className="mp-benefit__meta">From {fromLabel}</p> : null}
        {shiftedOn || hasQuantity ? (
          <p className="mp-benefit__meta">
            {shiftedOn ? `Shifted on ${shiftedOn}` : ''}
            {shiftedOn && hasQuantity ? ' · ' : ''}
            {hasQuantity ? (exhausted ? `Used ${total}/${total}` : `${remaining} of ${total} left`) : ''}
          </p>
        ) : null}
        {validTill || originalTill ? (
          <p className="mp-benefit__meta">
            {validTill ? `Valid till ${validTill}` : 'No expiry'}
            {originalTill && originalTill !== validTill ? ` · Originally till ${originalTill}` : ''}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function PlanCard({ plan, highlighted, planNames }) {
  const expired = isPlanExpired(plan);
  const statusKey = getPlanStatusKey(plan);
  const status = getPlanStatus(plan);
  const shifted = (plan.shifted_consumables ?? []).filter((item) => item?.label);
  const pending = plan.status === 'pending';
  const autopay = Boolean(plan.billing_mode) && plan.billing_mode !== 'one_time';
  const { amount, saved, original } = getPlanAmounts(plan);
  const remainingDays = daysLeft(plan.expires_at);
  const startDate = formatPlanDate(plan.starts_at);
  const startTime = formatPlanTime(plan.starts_at);
  const expiryDate = formatPlanDate(plan.expires_at);
  const expiryTime = formatPlanTime(plan.expires_at);
  const benefits = (plan.benefits ?? []).filter((benefit) => benefit?.label);
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
              {formatRupee(amount)}
              {plan.currency ? <small>{plan.currency}</small> : null}
            </span>
            {saved > 0 ? (
              <p className="mp-saved">
                Saved {formatRupee(saved)} on {formatRupee(original)}
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
            {plan.billing_mode ? (
              <span className="mp-chip">
                {autopay ? <RefreshCw size={12} aria-hidden /> : <CreditCard size={12} aria-hidden />}
                {autopay ? 'Autopay' : 'One-time payment'}
              </span>
            ) : null}
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

        {benefits.length > 0 ? (
          <div>
            <h3 className="mp-section">Your benefits</h3>
            <ul className="mp-benefits">
              {benefits.map((benefit, index) => (
                <li className="mp-benefit" key={`${plan.id}-${index}`}>
                  <span className="mp-benefit__icon">
                    <BenefitIcon label={benefit.label} />
                  </span>
                  <div className="mp-benefit__body">
                    <p className="mp-benefit__label">{benefit.label}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {shifted.length > 0 ? (
          <div>
            <h3 className="mp-section">
              Shifted benefits <span>{shifted.length} shifted</span>
            </h3>
            <ul className="mp-benefits">
              {shifted.map((item, index) => (
                <ShiftedRow
                  key={item.id || `${plan.id}-shifted-${index}`}
                  item={item}
                  fromPlanName={item.shifted_from_purchase ? planNames[item.shifted_from_purchase] ?? '' : ''}
                />
              ))}
            </ul>
          </div>
        ) : null}

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
        const res = await getMyPackages({ page: nextPage, status, search });
        if (requestId !== requestRef.current) return;
        if (!res?.success) throw new Error(res?.message || 'Failed to load');
        const { list, next } = readPlanPage(res);
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

  const planNames = useMemo(() => buildPlanNameMap(plans), [plans]);

  return (
    <AppShell tab="profile">
      <section className="or-page">
        <PageHeader title="My Plans" subtitle="Care plans you have purchased" backTo="/profile" />

        <div className="or-toolbar">
          <SearchField
            value={searchText}
            onChange={setSearchText}
            placeholder="Search your plans"
            label="Search your plans"
          />
          <div className="or-filters" role="group" aria-label="Plan status">
            {PLAN_STATUS_TABS.map((tab) => (
              <Chip key={tab.label} selected={tab.value === status} onClick={() => setStatus(tab.value)}>
                {tab.label}
              </Chip>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="or-skel" aria-busy="true" aria-label="Loading plans">
            <Skeleton style={{ height: 150, borderRadius: 'var(--am-radius-lg)' }} />
            <Skeleton style={{ height: 150, borderRadius: 'var(--am-radius-lg)' }} />
          </div>
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
                <PlanCard key={plan.id} plan={plan} highlighted={plan.id === highlightId} planNames={planNames} />
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
