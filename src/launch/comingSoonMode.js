/**
 * Temporary consult-only launch gate.
 * Remove this folder + ComingSoonGate when full catalog ships.
 *
 * VITE_COMING_SOON=true  → features below with `true` show "Coming soon"
 * VITE_COMING_SOON=false → full access (default when unset)
 *
 * Flip any feature to `false` to unlock it while the master switch stays on.
 */

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

export function isComingSoonMode() {
  const raw = String(import.meta.env.VITE_COMING_SOON ?? '').trim().toLowerCase();
  return TRUTHY.has(raw);
}

/** true = blocked / show Coming soon. false = live. Only applies when master mode is on. */
export const COMING_SOON_FEATURES = {
  products: true,
  medicines: true,
  cart: true,
  search: true,
  reviews: true,
  yoga: true,
  diet: true,
  packages: true,
  panchakarma: true,
  labs: true,
  mentor: true,
  brands: true,
  orders: true,
  returns: true,
  wishlist: true,
  plans: true,
  diets: true,
  rewards: true,
  payments: true,
};

const PATH_FEATURES = [
  { feature: 'products', prefixes: ['/products'] },
  { feature: 'medicines', prefixes: ['/medicines'] },
  { feature: 'cart', prefixes: ['/cart', '/checkout', '/payment/return', '/order-confirmation'] },
  { feature: 'search', prefixes: ['/search'] },
  { feature: 'reviews', prefixes: ['/reviews'] },
  { feature: 'yoga', prefixes: ['/yoga'] },
  { feature: 'diet', prefixes: ['/diet'] },
  { feature: 'packages', prefixes: ['/packages'] },
  { feature: 'panchakarma', prefixes: ['/panchakarma'] },
  { feature: 'labs', prefixes: ['/labs'] },
  { feature: 'mentor', prefixes: ['/mentor'] },
  { feature: 'orders', prefixes: ['/profile/orders'] },
  { feature: 'returns', prefixes: ['/profile/returns'] },
  { feature: 'wishlist', prefixes: ['/profile/wishlist'] },
  { feature: 'plans', prefixes: ['/profile/plans'] },
  { feature: 'diets', prefixes: ['/profile/diets'] },
  { feature: 'rewards', prefixes: ['/profile/rewards'] },
  { feature: 'payments', prefixes: ['/profile/payments'] },
];

const SERVICE_FEATURES = {
  medicine: 'medicines',
  medicines: 'medicines',
  products: 'products',
  product: 'products',
  yoga: 'yoga',
  diet: 'diet',
  diets: 'diet',
  packages: 'packages',
  'care plan': 'packages',
  panchakarma: 'panchakarma',
  panchkarma: 'panchakarma',
  labs: 'labs',
  lab: 'labs',
  mentor: 'mentor',
  search: 'search',
  cart: 'cart',
  brands: 'brands',
};

export function isFeatureComingSoon(feature) {
  if (!feature || !isComingSoonMode()) return false;
  return COMING_SOON_FEATURES[feature] === true;
}

export function featureForPath(pathname = '') {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  const hit = PATH_FEATURES.find(({ prefixes }) =>
    prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
  );
  return hit?.feature || null;
}

export function featureForServiceKey(key = '') {
  const normalized = String(key).trim().toLowerCase();
  return SERVICE_FEATURES[normalized] || null;
}

export function isComingSoonPath(pathname = '') {
  const feature = featureForPath(pathname);
  return feature ? isFeatureComingSoon(feature) : false;
}

export const COMING_SOON_EVENT = 'ayurmuni:coming-soon';

export function openComingSoonModal() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(COMING_SOON_EVENT));
}

/** Intercept a link/nav click when the path is in coming-soon mode. */
export function guardComingSoonPath(event, pathname = '') {
  if (!isComingSoonPath(pathname)) return false;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  openComingSoonModal();
  return true;
}
