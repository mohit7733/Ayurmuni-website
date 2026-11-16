/** Plan colours from the app: components/packages/packageUi.ts (Ayurmuni2.0, development). */
import { formatRupee } from '../home/catalog';

export const PLAN_GOLD = '#E8C27A';

/** Server prices keep paise ("554.65" stays ₹554.65; whole rupees stay ₹10). */
export const formatPlanMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? formatRupee(n) : formatRupee(n, { decimals: 2 });
};

/** Saturated mid-tones so white type stays readable and the card still looks luminous. */
const THEMES = [
  {
    tint: '#F3E8FF',
    accent: '#5B21B6',
    soft: '#DDD6FE',
    icon: 'heart-handshake',
    gradient: ['#4C1D95', '#6D28D9', '#7C3AED'],
    glow: ['108%', '-8%'],
  },
  {
    tint: '#E6F7F3',
    accent: '#0F766E',
    soft: '#B7EBE3',
    icon: 'leaf',
    gradient: ['#047857', '#0F766E', '#0D9488'],
    glow: ['-8%', '0%'],
  },
  {
    tint: '#E7F6EF',
    accent: '#0D614E',
    soft: '#C7E6D6',
    icon: 'stethoscope',
    gradient: ['#0B6B4F', '#0E7A5C', '#14956F'],
    glow: ['100%', '110%'],
  },
  {
    tint: '#FFF1E6',
    accent: '#C2410C',
    soft: '#FED7AA',
    icon: 'salad-filled',
    gradient: ['#9A3412', '#C2410C', '#EA580C'],
    glow: ['0%', '100%'],
  },
  {
    tint: '#FDE7F0',
    accent: '#BE185D',
    soft: '#FBCFE8',
    icon: 'leaf',
    gradient: ['#9D174D', '#BE185D', '#DB2777'],
    glow: ['110%', '80%'],
  },
  {
    tint: '#E0F2FE',
    accent: '#0369A1',
    soft: '#BAE6FD',
    icon: 'shield',
    gradient: ['#0C4A6E', '#0369A1', '#0284C7'],
    glow: ['-10%', '70%'],
  },
  {
    tint: '#FAE8FF',
    accent: '#A21CAF',
    soft: '#F5D0FE',
    icon: 'heart-handshake',
    gradient: ['#86198F', '#A21CAF', '#C026D3'],
    glow: ['100%', '-12%'],
  },
  {
    tint: '#E0E7FF',
    accent: '#4338CA',
    soft: '#C7D2FE',
    icon: 'shield',
    gradient: ['#312E81', '#4338CA', '#4F46E5'],
    glow: ['0%', '-10%'],
  },
];

const hash = (value) =>
  value.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);

const categoryKey = (plan) => {
  const name = String(plan?.group || '').trim().toLowerCase();
  const generic = !name || /^(plan|plans|package|packages)$/.test(name);
  if (!generic) return name;
  const code = String(plan?.categoryCode || '').trim().toLowerCase();
  if (code && !/^pkd\d+$/.test(code)) return `${code} ${name}`.trim();
  return `${name} ${String(plan?.name || plan?.id || '').toLowerCase()}`.trim();
};

/** Palette index for a package category. Care and consult lead with the violet card from the app. */
export const planThemeIndex = (plan) => {
  const key = categoryKey(plan);
  if (/(diet|nutri|ahara|meal)/.test(key)) return 3;
  if (/(pancha|therap|abhyang)/.test(key)) return 4;
  if (/(yoga|asana)/.test(key)) return 5;
  if (/(skin|beauty|women|fertil)/.test(key)) return 6;
  if (/(consult|doctor|bams|vaidya|physician)/.test(key)) return 0;
  if (/(long|vital|renew)/.test(key)) return 1;
  if (/(wellness|journey|care)/.test(key)) return 0;
  if (/(immun|rasayana|shield)/.test(key)) return 5;
  return hash(key || 'plan') % THEMES.length;
};

/**
 * Per-card offset so a repeated category steps to the next gradient.
 * Different categories keep their own colour; neighbours in the rail stay distinct.
 */
export const railThemeTones = (plans) => {
  let prev = -1;
  return plans.map((plan) => {
    const base = planThemeIndex(plan);
    let index = base;
    if (index === prev) index = (index + 1) % THEMES.length;
    prev = index;
    return (index - base + THEMES.length) % THEMES.length;
  });
};

export const getPlanTheme = (plan, tone = 0) => {
  const shift = Number(tone) || 0;
  const index = (planThemeIndex(plan) + shift) % THEMES.length;
  return THEMES[index];
};

export const themeStyle = (theme) => ({
  '--plan-tint': theme.tint,
  '--plan-accent': theme.accent,
  '--plan-soft': theme.soft,
  '--plan-a': theme.gradient[0],
  '--plan-b': theme.gradient[1],
  '--plan-c': theme.gradient[2],
  '--plan-glow-x': theme.glow?.[0] || '100%',
  '--plan-glow-y': theme.glow?.[1] || '0%',
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
