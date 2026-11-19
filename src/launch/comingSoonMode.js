/**
 * Temporary consult-only launch gate.
 * Remove this folder + ComingSoonGate when full catalog ships.
 *
 * VITE_COMING_SOON=true  → blocked routes show "Coming soon" modal
 * VITE_COMING_SOON=false → full access (default when unset)
 */

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

export function isComingSoonMode() {
  const raw = String(import.meta.env.VITE_COMING_SOON ?? '').trim().toLowerCase();
  return TRUTHY.has(raw);
}

/** Feature areas not in the consult-only launch. */
const BLOCKED_PREFIXES = [
  '/products',
  '/medicines',
  '/cart',
  '/checkout',
  '/order-confirmation',
  '/search',
  '/reviews',
  '/yoga',
  '/diet',
  '/packages',
  '/panchakarma',
  '/labs',
  '/mentor',
  '/profile/orders',
  '/profile/returns',
  '/profile/wishlist',
  '/profile/plans',
  '/profile/diets',
  '/profile/rewards',
  '/profile/payments',
];

export function isComingSoonPath(pathname = '') {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  return BLOCKED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
