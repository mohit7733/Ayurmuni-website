export const REWARDS_COPY = {
  title: 'My Rewards',
  subtitle: 'Referral coupons and rewards',
  loading: 'Loading rewards…',
  filtersLabel: 'Reward type',
  filters: [
    { key: 'all', label: 'All' },
    { key: 'referral', label: 'Referral' },
    { key: 'reward', label: 'Reward' },
  ],
  highlight: (n) => `${n} New Reward${n === 1 ? '' : 's'}`,
  emptyTitle: 'No rewards yet',
  emptyText: 'Referral coupons you earn will show up here.',
  emptyFilterTitle: 'Nothing in this filter',
  emptyFilterText: 'Try All, or check back after you earn a referral reward.',
  howTitle: 'How referrals work',
  howText:
    'Share Ayurmuni with friends. When they complete a qualifying action, referral coupons appear here for you to copy and apply at checkout.',
  shopProducts: 'Browse store',
  bookConsult: 'Book a consult',
  applyCopy: 'Apply / Copy code',
  copiedTitle: 'Coupon unlocked',
  copiedText: 'Code copied. Paste and apply it at checkout.',
  done: 'Done',
  trigger: 'Trigger',
  appliesTo: 'Applies to',
  remainingUses: 'Remaining uses',
  limitedOffer: 'Limited period offer',
  left: (n) => `${n} left`,
};

/** Theme tokens for reward cards — brand greens / gold / soft neutrals only */
export const REWARD_THEMES = [
  {
    bg: 'var(--am-surface)',
    circle: 'var(--am-primary-soft)',
    accent: 'var(--am-primary)',
  },
  {
    bg: 'var(--am-accent-soft)',
    circle: 'color-mix(in srgb, var(--am-accent) 22%, var(--am-surface))',
    accent: 'var(--am-accent-strong)',
  },
  {
    bg: 'var(--am-surface-muted)',
    circle: 'var(--am-primary-tint)',
    accent: 'var(--am-primary-strong)',
  },
  {
    bg: 'color-mix(in srgb, var(--am-success) 8%, var(--am-surface))',
    circle: 'var(--am-success-soft)',
    accent: 'var(--am-success)',
  },
];
