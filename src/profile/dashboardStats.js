// Profile dashboard stat chips + profile-photo payload, ported from the app
// (hooks/useProfileDashboardStats.ts, ProfileHeader.tsx buildProfilePayload).

export const PROFILE_STAT_DEFAULTS = [
  { key: 'consults', value: '--', label: 'CONSULTS', to: '/profile/appointments' },
  { key: 'orders', value: '--', label: 'ORDERS', to: '/profile/orders' },
  { key: 'reports', value: '--', label: 'REPORTS', to: '/profile/records' },
];

export const formatStatCount = (count) => String(Math.max(0, Number(count) || 0)).padStart(2, '0');

/** Count from an API payload: numeric `count`, else the length of the first list found. */
export const resolveCount = (response, listKeys = ['results', 'data']) => {
  const layers = [response, response?.data].filter((item) => item && typeof item === 'object');
  for (const layer of layers) {
    if (typeof layer.count === 'number') return layer.count;
  }
  for (const layer of layers) {
    if (Array.isArray(layer)) return layer.length;
    for (const key of listKeys) {
      if (Array.isArray(layer[key])) return layer[key].length;
    }
  }
  return 0;
};

const settled = (result, listKeys) =>
  result?.status === 'fulfilled' ? resolveCount(result.value, listKeys) : 0;

/** Build the three chips from Promise.allSettled results [consults, orders, reports]. */
export const buildProfileStats = ([consultRes, ordersRes, recordsRes] = []) => {
  const counts = [settled(consultRes), settled(ordersRes, ['data', 'results']), settled(recordsRes, ['data', 'results'])];
  return PROFILE_STAT_DEFAULTS.map((stat, index) => ({ ...stat, value: formatStatCount(counts[index]) }));
};

export const LOGGED_OUT_STATS = PROFILE_STAT_DEFAULTS.map((stat) => ({ ...stat, value: '00' }));

const toText = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return String(value.url || value.uri || value.label || '');
  return '';
};

/** PUT customers/profile/ body used when only the profile picture changes (same fields as the app). */
export const buildProfilePayload = (user, profilePicture) => ({
  first_name: toText(user?.first_name),
  last_name: toText(user?.last_name).trim(),
  email: toText(user?.email),
  secondary_number: toText(user?.secondary_number),
  gender: toText(user?.gender).toLowerCase(),
  date_of_birth: toText(user?.date_of_birth),
  profile_picture: profilePicture,
});

/** Builds the photo-action list the header sheet shows (view/change/remove), as in the app. */
export const buildPhotoOptions = (hasPhoto) =>
  hasPhoto
    ? [
        { key: 'view', label: 'View photo' },
        { key: 'change', label: 'Change photo' },
        { key: 'remove', label: 'Remove photo', destructive: true },
      ]
    : [{ key: 'change', label: 'Add photo' }];
