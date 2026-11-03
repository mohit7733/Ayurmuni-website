/** Plan colours from the app: components/packages/packageUi.ts (Ayurmuni2.0, development). */
export const PLAN_GOLD = '#E8C27A';

const THEMES = [
  {
    tint: '#E8F4EF',
    accent: '#0D614E',
    soft: '#CFE6DC',
    icon: 'stethoscope',
    gradient: ['#0A4A3C', '#0D614E', '#178A6E'],
  },
  {
    tint: '#FFF4E5',
    accent: '#B45309',
    soft: '#FDE3BF',
    icon: 'salad-filled',
    gradient: ['#5B3A0A', '#8A5A12', '#B7791F'],
  },
  {
    tint: '#EEF2FF',
    accent: '#4338CA',
    soft: '#D9DEFC',
    icon: 'heart-handshake',
    gradient: ['#26206B', '#3730A3', '#4F46E5'],
  },
  {
    tint: '#FDECF3',
    accent: '#BE185D',
    soft: '#F9D2E2',
    icon: 'leaf',
    gradient: ['#6B1239', '#9D174D', '#BE185D'],
  },
  {
    tint: '#E6F6FB',
    accent: '#0E7490',
    soft: '#C7EAF3',
    icon: 'shield',
    gradient: ['#0B3F4F', '#0E6070', '#0E7490'],
  },
];

const hash = (value) =>
  value.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);

export const getPlanTheme = (plan) => {
  const key = String(plan?.categoryCode || plan?.group || 'plan').toLowerCase();
  if (key.includes('consult')) return THEMES[0];
  if (key.includes('diet') || key.includes('nutri')) return THEMES[1];
  if (key.includes('care')) return THEMES[2];
  return THEMES[hash(key) % THEMES.length];
};

export const themeStyle = (theme) => ({
  '--plan-tint': theme.tint,
  '--plan-accent': theme.accent,
  '--plan-soft': theme.soft,
  '--plan-a': theme.gradient[0],
  '--plan-b': theme.gradient[1],
  '--plan-c': theme.gradient[2],
});

export const isCarePlan = (plan) => {
  if (plan?.purchaseType) return plan.purchaseType === 'prepaid_package' && Boolean(plan.canBePurchased);
  return plan?.mode === 'purchase';
};

export const planDiscount = (plan) => {
  const original = Number(plan?.mrp);
  const selling = Number(plan?.price);
  if (!Number.isFinite(original) || !Number.isFinite(selling) || original <= 0 || selling >= original) return 0;
  return Math.round(((original - selling) / original) * 100);
};

export const planDuration = (plan) => {
  if (plan?.billingMode && plan.billingMode !== 'one_time' && plan.billingPeriod) {
    const every = plan.billingInterval > 1 ? `${plan.billingInterval} ` : '';
    return `Autopay · every ${every}${plan.billingPeriod}`;
  }
  const days = Number(plan?.validityDays);
  if (Number.isFinite(days) && days > 0) {
    if (days % 30 === 0 && days >= 30) {
      const months = days / 30;
      return `${months} month${months > 1 ? 's' : ''} validity`;
    }
    return `${days} days validity`;
  }
  if (plan?.duration) return `${plan.duration} validity`;
  return plan?.purchaseType === 'open_plan' ? 'Pay per consult' : 'One-time plan';
};

export const planBilling = (plan) => {
  if (!plan?.billingMode || plan.billingMode === 'one_time') return 'One-time payment';
  const every = plan.billingPeriod
    ? `every ${plan.billingInterval > 1 ? `${plan.billingInterval} ` : ''}${plan.billingPeriod}`
    : '';
  return `Autopay${every ? ` ${every}` : ''}`;
};

/** App labels: rail uses Buy now / Book; the full card uses Buy now / Buy again / Book consultation. */
export const planCta = (plan, { owned = false, rail = false } = {}) => {
  const care = isCarePlan(plan);
  if (rail) return care ? (owned ? 'Buy again' : 'Buy now') : 'Book';
  if (plan?.buttonAction === 'book_consultation' || plan?.canBePurchased === false || !care) {
    return 'Book consultation';
  }
  return owned ? 'Buy again' : 'Buy now';
};
