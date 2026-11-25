/** Remember where to send the user after login / OTP (e.g. /cart). */

const AUTH_RETURN_KEY = 'ayurmuni_auth_return';

const BLOCKED_PREFIXES = [
  '/login',
  '/otp',
  '/welcome',
  '/access-mode',
  '/onboarding',
  '/policy-accept',
  '/network-error',
];

/** Only same-origin relative paths; never auth/onboarding loops. */
export function sanitizeReturnPath(path) {
  if (path == null) return '';
  const raw = String(path).trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';

  const pathname = raw.split(/[?#]/)[0] || '/';
  if (pathname === '/') return '';
  if (BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return '';
  }
  return raw;
}

export function rememberReturnPath(path) {
  const safe = sanitizeReturnPath(path);
  try {
    if (typeof sessionStorage === 'undefined') return safe;
    if (safe) sessionStorage.setItem(AUTH_RETURN_KEY, safe);
    else sessionStorage.removeItem(AUTH_RETURN_KEY);
  } catch {
    // private mode
  }
  return safe;
}

export function peekReturnPath() {
  try {
    if (typeof sessionStorage === 'undefined') return '';
    return sanitizeReturnPath(sessionStorage.getItem(AUTH_RETURN_KEY) || '');
  } catch {
    return '';
  }
}

/** Read + clear. Falls back when nothing was stored. */
export function consumeReturnPath(fallback = '/home') {
  const stored = peekReturnPath();
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(AUTH_RETURN_KEY);
  } catch {
    // private mode
  }
  return stored || fallback;
}

export function resolveReturnPath(candidate, fallback = '/home') {
  return sanitizeReturnPath(candidate) || peekReturnPath() || fallback;
}

export function currentLocationPath() {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname || ''}${window.location.search || ''}`;
}
