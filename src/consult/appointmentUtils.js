const firstNonEmpty = (values) => {
  for (const value of values) {
    if (value != null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

export function getAppointmentIds(source) {
  if (!source) return { appointmentId: '', consultationId: '' };

  const appointmentId = firstNonEmpty([
    source.appointmentId,
    source.appointment_id,
    source.rawData?.appointment_id,
    source.appointment?.appointment_id,
    source.id,
    source.rawData?.id,
    source.appointment?.id,
    source.rawData?.appointment?.id,
  ]);

  const consultationId = firstNonEmpty([
    source.consultationId,
    source.consultation_id,
    source.rawData?.consultation_id,
    source.appointment?.consultation_id,
    source.rawData?.appointment?.consultation_id,
  ]);

  return { appointmentId, consultationId };
}

export function getVideoCallId(source) {
  const { appointmentId, consultationId } = getAppointmentIds(source);
  return appointmentId || consultationId;
}

export function buildVideoCallNavParams(source, extras = {}) {
  const ids = getAppointmentIds(source);
  const primaryId = ids.appointmentId || ids.consultationId;
  return {
    appointmentId: primaryId,
    ...(ids.consultationId ? { consultationId: ids.consultationId } : {}),
    ...extras,
  };
}

export const formatDoctorDisplayName = (name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'Doctor';
  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
};

export function resolveAppointmentLookupId(source) {
  const { appointmentId, consultationId } = getAppointmentIds(source);
  return consultationId || appointmentId;
}

const weekdayFromDate = (dateStr) => {
  if (!dateStr) return '';
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
  const date = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { weekday: 'long' });
};

const formatTimeLabel = (time) => {
  if (!time) return '';
  const raw = String(time).trim();
  const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return raw;
  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[4]?.toUpperCase();
  if (meridiem) {
    return `${hours % 12 || 12}:${minutes} ${meridiem}`;
  }
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
};

export const getConsultationScheduleLabels = (item) => {
  const dateRaw =
    item?.date || item?.appointment_date || item?.appointment?.appointment_date || '';
  const timeRaw = item?.time || item?.start_time || item?.appointment?.start_time || '';
  const status =
    item?.status || item?.appointment_status || item?.appointment?.appointment_status || '';
  const endTime = item?.end_time || item?.appointment?.end_time || null;
  const weekday = weekdayFromDate(dateRaw);
  const dateLabel = formatAppointmentDateFull(dateRaw);
  const timeLabel = formatTimeLabel(timeRaw);
  const endTimeLabel = endTime ? formatTimeLabel(endTime) : null;
  return {
    dateRaw,
    timeRaw,
    status: String(status || ''),
    weekday,
    dayLabel: weekday,
    dateLabel,
    timeLabel,
    endTimeLabel,
    scheduleLine: [weekday, dateLabel, timeLabel].filter(Boolean).join(' · '),
  };
};

export function getAppointmentPatientId(item) {
  if (!item) return '';
  if (item.patientId) return String(item.patientId).trim();
  const patient =
    item?.patient ||
    item?.appointment?.patient ||
    item?.rawData?.patient ||
    item?.rawData?.appointment?.patient ||
    null;
  return String(
    patient?.id ??
      patient?.patient_id ??
      patient?.user_id ??
      item?.appointment?.patient_id ??
      item?.patient_id ??
      '',
  ).trim();
}

export const formatAppointmentWeekday = weekdayFromDate;
export const formatAppointmentTimeLabel = formatTimeLabel;

export const formatAppointmentDateFull = (dateStr) => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (ymd) {
    const date = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const parseLocalDateParts = (dateStr) => {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) {
    return { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
  }
  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return null;
  return {
    year: fallback.getFullYear(),
    month: fallback.getMonth() + 1,
    day: fallback.getDate(),
  };
};

const parseTimeParts = (timeStr) => {
  if (!timeStr) return null;
  const raw = String(timeStr).trim();
  if (/T/.test(raw) || /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:/.test(raw)) {
    const iso = new Date(raw);
    if (!Number.isNaN(iso.getTime())) {
      return { hours: iso.getHours(), minutes: iso.getMinutes(), seconds: iso.getSeconds() };
    }
  }
  const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  const meridiem = match[4]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return { hours, minutes, seconds };
};

const parseAppointmentStart = (dateStr, timeStr) => {
  const timeRaw = timeStr != null ? String(timeStr).trim() : '';
  if (timeRaw && (/T/.test(timeRaw) || /^\d{4}-\d{2}-\d{2}/.test(timeRaw))) {
    const iso = new Date(timeRaw);
    if (!Number.isNaN(iso.getTime())) return iso;
  }
  const parts = parseLocalDateParts(dateStr);
  if (!parts) {
    if (timeRaw) {
      const onlyTime = new Date(timeRaw);
      if (!Number.isNaN(onlyTime.getTime())) return onlyTime;
    }
    return null;
  }
  const timeParts = parseTimeParts(timeRaw);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    timeParts?.hours ?? 0,
    timeParts?.minutes ?? 0,
    timeParts?.seconds ?? 0,
    0,
  );
};

export const resolveAppointmentDateTime = (item) => {
  if (!item) return {};
  const root = item?.rawData ?? item;
  const appt = root?.appointment ?? item?.appointment ?? root;
  const date = String(
    item?.date || appt?.appointment_date || appt?.date || root?.appointment_date || '',
  ).trim();
  const time = String(
    item?.time || appt?.start_time || appt?.time || root?.start_time || '',
  ).trim();
  return { date: date || undefined, time: time || undefined };
};

export const getMinutesUntilAppointment = (dateStr, timeStr) => {
  const start = parseAppointmentStart(dateStr, timeStr);
  if (!start) return null;
  return Math.ceil((start.getTime() - Date.now()) / 60000);
};

const RESCHEDULABLE_STATUSES = [
  'confirmed',
  'reschedule',
  'rescheduled',
  'upcoming',
  'booked',
];
const NON_RESCHEDULABLE_STATUSES = [
  'completed',
  'cancelled',
  'missed',
  'expired',
  'no_show',
  'noshow',
  'cancellation_requested',
  'rejected',
];

export const canRescheduleAppointment = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return false;
  if (NON_RESCHEDULABLE_STATUSES.includes(value)) return false;
  return RESCHEDULABLE_STATUSES.includes(value);
};

export const canModifyAppointment = (status, dateStr, timeStr, windowMinutes = 180) => {
  if (!canRescheduleAppointment(status)) return false;
  const date = String(dateStr || '').trim();
  const time = String(timeStr || '').trim();
  if (!date) return false;
  const mins = getMinutesUntilAppointment(date, time || undefined);
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return false;
  return mins > Math.max(1, Math.floor(Number(windowMinutes) || 180));
};

export const isAppointmentInPast = (raw) => {
  const date = raw?.date || raw?.appointment_date || raw?.appointment?.appointment_date;
  const time = raw?.time || raw?.start_time || raw?.appointment?.start_time;
  const endTime = raw?.endTime || raw?.end_time || raw?.appointment?.end_time;
  const now = Date.now();
  const end = parseAppointmentStart(date, endTime || undefined);
  if (end && now >= end.getTime()) return true;
  const start = parseAppointmentStart(date, time);
  if (start && (!endTime || !end) && now >= start.getTime() + 60 * 60 * 1000) return true;
  if (!start && date) {
    const day = new Date(date);
    if (!Number.isNaN(day.getTime())) {
      day.setHours(23, 59, 59, 999);
      return now > day.getTime();
    }
  }
  return false;
};

export const toIcsStamp = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

export const buildAppointmentStartEnd = (dateStr, startTime, endTime) => {
  const start = parseAppointmentStart(dateStr, startTime);
  if (!start) return null;
  const end = parseAppointmentStart(dateStr, endTime) || new Date(start.getTime() + 30 * 60 * 1000);
  return { start, end };
};

// App ENDED_CALL_STATUSES (utils/appointmentUtils.ts) — exact list.
const ENDED_CALL_STATUSES = new Set([
  'ended',
  'left',
  'completed',
  'cancelled',
  'canceled',
  'no_show',
  'missed',
  'rejected',
]);

/** Short local day label ("Mon, 26 Oct") — parses YYYY-MM-DD / DD-MM-YYYY / ISO without UTC shift. */
export const formatAppointmentDayShort = (dateStr) => {
  const parts = parseLocalDateParts(dateStr);
  if (!parts) return dateStr ? String(dateStr) : '';
  const date = new Date(parts.year, parts.month - 1, parts.day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export function getJoinableAppointment(items = [], windowMinutes = 5) {
  // Exact port of app getJoinableAppointment (utils/appointmentUtils.ts).
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;

  for (const item of items) {
    const callStatus = String(item?.call_status || '').toLowerCase().trim();
    if (ENDED_CALL_STATUSES.has(callStatus)) continue;

    const start = parseAppointmentStart(item?.date, item?.time);
    if (!start) continue;

    const end = item?.endTime ? parseAppointmentStart(item.date, item.endTime) : null;
    const validEnd = end && end.getTime() > start.getTime() ? end : null;
    // Without a usable end_time, the slot ends 15 min after start.
    const endMs = validEnd ? validEnd.getTime() : start.getTime() + 15 * 60 * 1000;
    if (now >= endMs) continue;

    const msUntilStart = start.getTime() - now;
    if (msUntilStart > windowMs) continue;

    if (callStatus === 'in_progress') {
      return { item, minutesLeft: 0, isLive: true };
    }

    return {
      item,
      minutesLeft: Math.max(0, Math.ceil(msUntilStart / 60000)),
      isLive: msUntilStart <= 0,
    };
  }

  return null;
};



/** Mirrors app hasAlreadyRescheduled: one reschedule allowed per appointment. */
export const hasAlreadyRescheduled = (source) => {
  if (source == null) return false;
  const norm = (v) => String(v || '').trim().toLowerCase();
  const once = (s) => s === 'rescheduled' || s === 're-scheduled' || s === 're_scheduled';
  if (typeof source === 'string') return once(norm(source));
  const root = source?.rawData ?? source;
  const appt = root?.appointment ?? root;
  if (once(norm(source?.status ?? appt?.appointment_status ?? root?.appointment_status ?? appt?.status))) return true;
  const count = Number(appt?.reschedule_count ?? root?.reschedule_count ?? source?.reschedule_count ?? 0);
  if (Number.isFinite(count) && count >= 1) return true;
  return [appt?.is_rescheduled, root?.is_rescheduled, appt?.already_rescheduled, root?.already_rescheduled, source?.is_rescheduled].includes(true);
};

/** Mirrors app sortAppointmentsByDateTime: earliest start first. */
export function sortAppointmentsByDateTime(items = []) {
  const startOf = (item) =>
    parseAppointmentStart(item?.date, item?.time)?.getTime() ?? new Date(item?.date || 0).getTime();
  return [...items].sort((a, b) => startOf(a) - startOf(b));
}
