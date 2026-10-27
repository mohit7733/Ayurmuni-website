import { calculateFeeBreakdown, parseFeeQuoteConfig } from '../cart/feeQuote';
import { doctorDisplayName, doctorFeeLabel, formatRupee, resolveImageUrl } from '../home/catalog';

export const CONSULT_BOOKING_KEY = 'ayurmuni_consult_booking';
export const CONSULT_PAY_KEY = 'ayurmuni_consult_pay';
export const CONSULT_PENDING_PAYMENT_KEY = 'ayurmuni_consult_pending';

export const getDoctorId = (item) =>
  String(item?.doctor_id ?? item?.id ?? item?.doctorId ?? item?.user_id ?? '').trim();

export const doctorFavorite = (item) => {
  const raw = item?.is_favorite ?? item?.is_favourite ?? item?.isFavorite ?? item?.favorite;
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
};

export const favoriteFromToggle = (response) => {
  const raw =
    response?.is_favorite ??
    response?.is_favourite ??
    response?.data?.is_favorite ??
    response?.data?.is_favourite ??
    response?.data?.favorite;
  if (raw === undefined || raw === null) return undefined;
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
};

const toFeeNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const readGlobalConsultationFee = (source) => {
  if (!source || typeof source !== 'object') return null;
  const candidates = [
    source?.configurations?.consultation?.global_fee,
    source?.configuration?.consultation?.global_fee,
    source?.doctor?.configurations?.consultation?.global_fee,
  ];
  for (const raw of candidates) {
    const fee = toFeeNumber(raw);
    if (fee != null && fee > 0) return fee;
  }
  return null;
};

export const applyDoctorFeesToResponse = (response) => {
  if (!response || typeof response !== 'object') return response;
  const data = response.data;
  if (data == null) return response;
  const wrapperGlobal = readGlobalConsultationFee(data) ?? readGlobalConsultationFee(response);
  const stamp = (item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    const globalFee = readGlobalConsultationFee(item) ?? wrapperGlobal;
    if (globalFee == null || globalFee <= 0) return item;
    return { ...item, consultation_fee: globalFee };
  };
  if (Array.isArray(data)) return { ...response, data: data.map(stamp) };
  if (Array.isArray(data.results)) {
    return { ...response, data: { ...data, results: data.results.map(stamp) } };
  }
  return { ...response, data: stamp(data) };
};

export const parseDoctor = (response) => {
  if (!response || response.success === false) return null;
  const data = response.data ?? response;
  if (Array.isArray(data?.results) && data.results[0]) return data.results[0];
  if (Array.isArray(data) && data[0]) return data[0];
  if (data && typeof data === 'object' && (getDoctorId(data) || data.full_name || data.slots)) {
    return data;
  }
  return null;
};

/** Book-slot may omit data.amount. Same order as the app's RazorpayScreen. */
export const consultPayableRupees = (data, fallback = 0) => {
  const summary = data?.summary ?? {};
  const direct = [
    data?.amount,
    data?.total_payable_amount,
    summary?.total_payable_amount,
    summary?.payable_amount,
    summary?.amount,
  ];
  for (const value of direct) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const parsed = parseFeeQuoteConfig(data, fallback);
  if (parsed) {
    const breakdown = calculateFeeBreakdown({
      baseAmount: parsed.baseAmount,
      discount: parsed.couponDiscount ?? 0,
      gst: parsed.gst,
      platformFee: parsed.platformFee,
      includeShipping: false,
      includeCod: false,
    });
    if (breakdown.total > 0) return breakdown.total;
  }

  return fallback > 0 ? fallback : 0;
};

export const toRazorpayPaise = (apiAmount, fallbackRupees) => {
  const fallback = Math.round(Number(fallbackRupees) || 0);
  const fallbackPaise = fallback * 100;
  const n = Number(apiAmount);
  if (!Number.isFinite(n) || n <= 0) return fallbackPaise > 0 ? fallbackPaise : 0;
  if (fallback > 0 && Math.round(n) === fallbackPaise) return Math.round(n);
  if (n < 100000) return Math.round(n * 100);
  return Math.round(n);
};

export const doctorImage = (item) =>
  resolveImageUrl({
    ...item,
    profile_image: item?.profile_image || item?.doctor_image || item?.profile_picture,
  });

export const doctorSpeciality = (item) => {
  const raw =
    item?.specialization_name ||
    item?.specialization ||
    item?.designation ||
    item?.qualification ||
    '';
  if (Array.isArray(raw)) {
    return raw.map((v) => v?.name || v).filter(Boolean).join(', ');
  }
  if (raw && typeof raw === 'object') return String(raw.name || raw.title || '');
  return String(raw).trim();
};

export const doctorExperience = (item) => {
  const raw = item?.experience_display || item?.experience_years || item?.experience || '';
  const match = String(raw).match(/(\d+)/);
  return match ? `${match[1]} yrs exp` : String(raw || '').trim();
};

export const doctorConsultFee = (item) => {
  const fee = Number(
    item?.consultation_fee ?? item?.global_fee ?? item?.fee ?? item?.consult_fee,
  );
  return Number.isFinite(fee) && fee >= 0 ? fee : 0;
};

export const doctorQualification = (item) =>
  String(item?.qualification || item?.designation || item?.degree || '').trim();

export const doctorLocation = (item) => {
  const city = String(item?.city || '').trim();
  const state = String(item?.state || '').trim();
  if (city && state) return `${city}, ${state}`;
  return city || state;
};

export const toLabelList = (value) => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item?.name) return String(item.name).trim();
        if (item?.title) return String(item.title).trim();
        if (item?.label) return String(item.label).trim();
        return '';
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
};

export const resolveDoctorSpecializations = (doctor) => {
  const candidates = [
    doctor?.doctor_specialization,
    doctor?.specializations,
    doctor?.specialization,
    doctor?.specialization_name,
    doctor?.speciality,
    doctor?.specialty,
  ];
  for (const candidate of candidates) {
    const list = toLabelList(candidate);
    if (list.length) return list;
  }
  return [];
};

export const resolveDoctorHealthDiseases = (doctor) => toLabelList(doctor?.health_diseases);

export const resolveConsultationModes = (doctor) => {
  const raw = doctor?.consultation_modes || doctor?.consultation_mode || doctor?.modes || [];
  if (Array.isArray(raw)) {
    return raw.map((mode) => String(mode?.name || mode).toLowerCase().trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((part) => part.toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
};

export const doctorOffersVideo = (doctor) => {
  const modes = resolveConsultationModes(doctor);
  return !modes.length || modes.some((mode) => /video|online|virtual/.test(mode));
};

export const resolveLanguages = (doctor) =>
  toLabelList(
    doctor?.languages_spoken || doctor?.preferred_languages || doctor?.languages || doctor?.language,
  );

export const resolveSocialAccounts = (doctor) => {
  const social = doctor?.social_media || doctor?.social_links || doctor?.social || doctor?.socials || {};
  const pick = (...keys) => {
    for (const key of keys) {
      const value = doctor?.[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  };
  return [
    {
      label: 'Facebook',
      url: pick('facebook', 'facebook_url') || String(social?.facebook || social?.fb || ''),
    },
    {
      label: 'Instagram',
      url: pick('instagram', 'instagram_url') || String(social?.instagram || social?.ig || ''),
    },
    {
      label: 'X',
      url: pick('twitter', 'twitter_url', 'x_url') || String(social?.twitter || social?.x || ''),
    },
    {
      label: 'LinkedIn',
      url: pick('linkedin', 'linkedin_url') || String(social?.linkedin || ''),
    },
  ].filter((item) => String(item.url || '').trim());
};

export const formatEarliestDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const doctorRating = (item) => {
  const n = Number(item?.average_rating ?? item?.rating ?? item?.ranking_score ?? 0);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : '';
};

export const isSlotBookable = (slot, date) => {
  const dated = { ...(slot || {}), date: slot?.date || date };
  const status = String(dated?.status || '')
    .trim()
    .toLowerCase();
  if (status && status !== 'available') return false;
  const day = String(dated?.date || '').trim();
  const time = String(dated?.end_time || dated?.start_time || '').trim();
  if (day && time) {
    const parts = time.split(':');
    const iso = `${day}T${parts[0].padStart(2, '0')}:${(parts[1] || '00').padStart(2, '0')}:${(parts[2] || '00').slice(0, 2)}`;
    const end = new Date(iso);
    if (!Number.isNaN(end.getTime()) && end.getTime() <= Date.now()) return false;
  }
  return true;
};

export const withSlotDate = (slot, date) => {
  const slotDate = String(slot?.date || '').trim();
  const fallback = String(date || '').trim();
  if (slotDate || !fallback) return slot;
  return { ...slot, date: fallback };
};

export const pickFirstBookableSlot = (slots = [], date) => {
  for (const raw of slots) {
    const slot = withSlotDate(raw, date);
    if (isSlotBookable(slot, date)) return slot;
  }
  return null;
};

export const formatSlotTime = (time) => {
  if (!time) return '';
  const [h, m] = String(time).split(':');
  const hour = Number(h);
  if (!Number.isFinite(hour)) return String(time);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hr = hour % 12 || 12;
  return `${hr}:${String(m || '00').padStart(2, '0')} ${suffix}`;
};

export const groupSlotsByTime = (slots = [], date) => {
  const grouped = { Morning: [], Afternoon: [], Evening: [] };
  slots.forEach((item) => {
    const hour = Number(String(item?.start_time || '').split(':')[0]);
    const slot = {
      ...item,
      date: item.date || date,
      displayTime: formatSlotTime(item.start_time),
    };
    if (hour < 12) grouped.Morning.push(slot);
    else if (hour < 17) grouped.Afternoon.push(slot);
    else grouped.Evening.push(slot);
  });
  return Object.entries(grouped).filter(([, list]) => list.length);
};

export const futureDates = (days = 14) => {
  const list = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    list.push({
      fullDate: `${yyyy}-${mm}-${dd}`,
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: dd,
      isToday: i === 0,
    });
  }
  return list;
};

export const generateMonthDates = (monthOffset = 0) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const totalDays = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const dates = [];
  for (let i = 1; i <= totalDays; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), i);
    date.setHours(0, 0, 0, 0);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    dates.push({
      fullDate: `${yyyy}-${mm}-${dd}`,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      day: dd,
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      isToday: date.getTime() === today.getTime(),
      isDisabled: date < today,
    });
  }
  return dates;
};

export const listDoctors = (response) => {
  const data = response?.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

const BLOCKED_DOCTOR_STATUSES = new Set([
  'rejected',
  'pending',
  'draft',
  'inactive',
  'disabled',
  'blocked',
  'suspended',
]);

const APPROVED_DOCTOR_STATUSES = new Set(['approved', 'active', 'published', 'verified']);

export const isApprovedDoctor = (doctor) => {
  if (!doctor || typeof doctor !== 'object') return false;

  const status = String(
    doctor.approval_status ??
      doctor.profile_status ??
      doctor.doctor_status ??
      doctor.verification_status ??
      doctor.status ??
      '',
  )
    .trim()
    .toLowerCase();

  if (status) {
    if (BLOCKED_DOCTOR_STATUSES.has(status)) return false;
    if (APPROVED_DOCTOR_STATUSES.has(status)) return true;
  }

  const approved = doctor.is_approved ?? doctor.isApproved ?? doctor.approved;
  if (approved === false || approved === 'false' || approved === 0 || approved === '0') {
    return false;
  }
  if (approved === true || approved === 'true' || approved === 1 || approved === '1') {
    return true;
  }

  const active = doctor.is_active ?? doctor.isActive;
  if (active === false || active === 'false' || active === 0 || active === '0') {
    return false;
  }

  return true;
};

export const normalizeDoctorList = (response, { approvedOnly = false } = {}) => {
  let items = listDoctors(response).filter(
    (item) =>
      item &&
      getDoctorId(item) &&
      String(item.full_name || item.name || item.doctor_name || '').trim(),
  );
  if (approvedOnly) items = items.filter(isApprovedDoctor);
  return items;
};

export const hasMoreDoctorPages = (response, resultsLength, pageSize, pageLoaded) => {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return resultsLength >= pageSize;
  if (data && typeof data === 'object') {
    if ('next' in data) return data.next != null && data.next !== '';
    if (data?.pagination?.next != null) return Boolean(data.pagination.next);
    if (data?.links?.next != null) return Boolean(data.links.next);
    const total =
      typeof data.count === 'number'
        ? data.count
        : typeof data.total === 'number'
          ? data.total
          : typeof data.total_count === 'number'
            ? data.total_count
            : null;
    const page =
      pageLoaded ??
      (typeof data.page === 'number'
        ? data.page
        : typeof data.current_page === 'number'
          ? data.current_page
          : null);
    if (total != null && page != null) return page * pageSize < total;
  }
  return resultsLength >= pageSize;
};

export { doctorDisplayName, doctorFeeLabel, formatRupee };
