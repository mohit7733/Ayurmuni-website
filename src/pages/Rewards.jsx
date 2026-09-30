import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Star } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import ReferralCard from '../components/ReferralCard';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import { fetchRewards } from '../services/rewardService';
import {
  couponAppliesLabel,
  couponExpiryLabel,
  couponMaxNote,
  couponMinNote,
  couponOfferTitle,
  couponSavingsLabel,
  couponSourceLabel,
  couponThemeIndex,
  isRewardsScreenItem,
  triggerLabel,
} from '../rewards/utils';
import {
  Badge,
  Button,
  Chip,
  Disclaimer,
  EmptyState,
  Modal,
  Skeleton,
} from '../components/ui';
import { REWARDS_COPY as T, REWARD_THEMES } from '../content/rewards';
import '../design/pages/rewards.css';

const matchesFilter = (reward, key) => {
  if (key === 'all') return true;
  const source = String(reward.source || reward.coupon?.source || '').toLowerCase();
  const trigger = String(reward.trigger || '').toLowerCase();
  return source === key || trigger === key;
};

export default function Rewards() {
  const navigate = useNavigate();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterKey, setFilterKey] = useState('all');
  const [detail, setDetail] = useState(null);
  const [copied, setCopied] = useState(null);

  const load = async () => {
    setLoading(true);
    const list = await fetchRewards();
    setRewards(list);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view rewards'))) return;
      load();
    })();
  }, []);

  const displayRewards = useMemo(
    () => rewards.filter((item) => item.coupon && isRewardsScreenItem(item)),
    [rewards],
  );
  const filtered = useMemo(
    () => displayRewards.filter((item) => matchesFilter(item, filterKey)),
    [displayRewards, filterKey],
  );

  const copyCode = async (coupon, reward) => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setDetail(null);
      setCopied({
        code: coupon.code,
        title: reward?.title || couponOfferTitle(coupon),
      });
    } catch {
      showSuccessToast('Could not copy coupon', 'error');
    }
  };

  const isEmptyFilter = !loading && filtered.length === 0 && filterKey !== 'all';
  const isEmptyAll = !loading && displayRewards.length === 0;

  return (
    <AppShell tab="profile">
      <section className="rw-page">
        <PageHeader title={T.title} subtitle={T.subtitle} backTo="/profile" />

        {/* Referral Card */}
        <div className="rw-referral-section">
          <ReferralCard />
        </div>

        <div className="rw-how">
          <h2>{T.howTitle}</h2>
          <p>{T.howText}</p>
        </div>

        <div className="rw-filters" role="group" aria-label={T.filtersLabel}>
          {T.filters.map((chip) => (
            <Chip
              key={chip.key}
              selected={filterKey === chip.key}
              onClick={() => setFilterKey(chip.key)}
            >
              {chip.label}
            </Chip>
          ))}
        </div>

        {loading ? (
          <div className="rw-skel" aria-busy="true" aria-label={T.loading}>
            <Skeleton style={{ height: 160, borderRadius: 'var(--am-radius-lg)' }} />
            <Skeleton style={{ height: 160, borderRadius: 'var(--am-radius-lg)' }} />
            <Skeleton style={{ height: 160, borderRadius: 'var(--am-radius-lg)' }} />
          </div>
        ) : isEmptyAll ? (
          <EmptyState
            icon={<Gift size={28} />}
            title={T.emptyTitle}
            description={T.emptyText}
            action={
              <>
                <Button variant="secondary" onClick={() => navigate('/products')}>
                  {T.shopProducts}
                </Button>
                <Button variant="primary" onClick={() => navigate('/consult/doctors')}>
                  {T.bookConsult}
                </Button>
              </>
            }
          />
        ) : isEmptyFilter ? (
          <EmptyState
            icon={<Gift size={28} />}
            title={T.emptyFilterTitle}
            description={T.emptyFilterText}
            action={
              <Button variant="secondary" onClick={() => setFilterKey('all')}>
                All
              </Button>
            }
          />
        ) : (
          <div className="rw-grid">
            {filterKey === 'all' && displayRewards.length > 0 ? (
              <p className="rw-highlight">{T.highlight(displayRewards.length)}</p>
            ) : null}
            {filtered.map((reward) => {
              const coupon = reward.coupon;
              const theme = REWARD_THEMES[couponThemeIndex(coupon.code || coupon.id)];
              const title = reward.title || couponOfferTitle(coupon);
              const sourceText = reward.trigger
                ? triggerLabel(reward.trigger)
                : couponSourceLabel(String(coupon.source));
              return (
                <button
                  key={reward.id}
                  type="button"
                  className="rw-card"
                  style={{ background: theme.bg }}
                  onClick={() => setDetail({ coupon, reward })}
                >
                  <div className="rw-card__top">
                    <span className="rw-card__thumb" style={{ background: theme.circle }}>
                      {reward.image_url || coupon.image_url ? (
                        <img
                          src={reward.image_url || coupon.image_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Star size={20} aria-hidden />
                      )}
                    </span>
                    <Badge tone="primary">{sourceText}</Badge>
                  </div>
                  <h3 className="rw-card__title">{title}</h3>
                  <p className="rw-card__savings" style={{ color: theme.accent }}>
                    {couponSavingsLabel(coupon)}
                  </p>
                  <code className="rw-card__code" style={{ color: theme.accent }}>
                    {coupon.code}
                  </code>
                  <p className="rw-card__meta">
                    {[
                      couponMaxNote(coupon),
                      couponExpiryLabel(coupon),
                      couponAppliesLabel(coupon),
                      coupon.remaining_uses != null ? T.left(coupon.remaining_uses) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        <Disclaimer />
      </section>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? detail.reward?.title || couponOfferTitle(detail.coupon) : undefined}
        footer={
          detail ? (
            <Button variant="primary" block onClick={() => copyCode(detail.coupon, detail.reward)}>
              {T.applyCopy}
            </Button>
          ) : null
        }
      >
        {detail ? (
          <div className="rw-detail">
            <p className="rw-detail__code">{detail.coupon.code}</p>
            {detail.reward?.trigger ? (
              <p>
                {T.trigger}: {detail.reward.trigger}
              </p>
            ) : null}
            {detail.reward?.description || detail.coupon.description ? (
              <p>{detail.reward?.description || detail.coupon.description}</p>
            ) : null}
            <p>{couponSavingsLabel(detail.coupon)}</p>
            {couponMinNote(detail.coupon) ? (
              <p className="rw-detail__warn">{couponMinNote(detail.coupon)}</p>
            ) : null}
            {couponMaxNote(detail.coupon) ? <p>{couponMaxNote(detail.coupon)}</p> : null}
            <p>{couponExpiryLabel(detail.coupon) || T.limitedOffer}</p>
            <p>
              {T.appliesTo}: {couponAppliesLabel(detail.coupon)}
            </p>
            {detail.coupon.remaining_uses != null ? (
              <p>
                {T.remainingUses}: {detail.coupon.remaining_uses}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(copied)}
        onClose={() => setCopied(null)}
        title={copied?.title || T.copiedTitle}
        description={T.copiedText}
        footer={
          <Button variant="primary" block onClick={() => setCopied(null)}>
            {T.done}
          </Button>
        }
      >
        {copied ? <p className="rw-detail__code">{copied.code}</p> : null}
      </Modal>
    </AppShell>
  );
}
