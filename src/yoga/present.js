import { getYogaSessionBreakdown, resolveYogaThumbnailUri, resolveYogaVideoUri } from './utils';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '');

/** Turn an API list (array of strings/objects, or a comma/newline string) into clean labels. */
export const toLabelList = (value) => {
  if (value == null || value === '') return [];
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n|;|,|\u2022/)
      : [];
  const out = raw
    .map((entry) =>
      typeof entry === 'string' || typeof entry === 'number'
        ? clean(entry)
        : clean(entry?.title ?? entry?.name ?? entry?.label ?? entry?.text ?? ''),
    )
    .map((text) => text.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);
  return [...new Set(out)];
};

/** Minutes from "20 min", "20", "1:05:00", 20 ... (0 when unknown). */
export const yogaMinutes = (item) => {
  const n = Number(item?.duration_minutes);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  const text = clean(item?.duration);
  if (!text) return 0;
  const hm = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hm) return hm[3] != null ? Number(hm[1]) * 60 + Number(hm[2]) : Number(hm[1]);
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hour)/i);
  const mins = text.match(/(\d+(?:\.\d+)?)\s*(m|min)/i);
  if (hours || mins) return Math.round((hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0));
  return /^\d+$/.test(text) ? Number(text) : 0;
};

export const durationLabel = (item) => {
  const minutes = yogaMinutes(item);
  if (minutes > 0) return `${minutes} min`;
  const text = clean(item?.duration);
  return text && text.length <= 24 && !/^0+(\.0+)?$/.test(text) ? text : '';
};

export const levelLabel = (item) => {
  const text = clean(item?.difficulty || item?.level || item?.production_level);
  return text && text.length <= 24 ? capitalize(text) : '';
};

export const DURATION_BUCKETS = [
  { key: 'short', label: 'Under 15 min', test: (m) => m > 0 && m < 15 },
  { key: 'medium', label: '15-30 min', test: (m) => m >= 15 && m <= 30 },
  { key: 'long', label: '30+ min', test: (m) => m > 30 },
];

/** Everything the yoga UI shows, only from fields the API actually sends. */
export const yogaView = (item) => {
  if (!item) return null;
  const title = clean(item.title || item.name) || 'Yoga session';
  const level = levelLabel(item);
  const description = clean(item.short_description || item.description);
  return {
    id: item.id,
    title,
    image: resolveYogaThumbnailUri(item),
    video: resolveYogaVideoUri(item),
    level,
    duration: durationLabel(item),
    minutes: yogaMinutes(item),
    poses: getYogaSessionBreakdown(item).length,
    description:
      description && description.toLowerCase() !== level.toLowerCase() && description.toLowerCase() !== clean(item.duration).toLowerCase()
        ? description
        : '',
    focus: toLabelList(item.focus ?? item.focus_area ?? item.focus_areas ?? item.body_focus).slice(0, 3),
    benefits: toLabelList(item.benefits ?? item.benefit ?? item.key_benefits),
    precautions: toLabelList(item.precautions ?? item.contraindications ?? item.cautions ?? item.precaution),
  };
};