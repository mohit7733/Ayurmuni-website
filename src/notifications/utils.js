const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isLikelyId = (value) => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return UUID_REGEX.test(trimmed) || /^\d+$/.test(trimmed);
};

const formatLabel = (value) => {
  if (!value || isLikelyId(value)) return undefined;
  return value
    .split(/[._-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const resolveNotificationContent = (item) => {
  const data = item?.data ?? {};
  let title = String(item.title ?? '').trim();
  let description = String(item.message ?? item.body ?? '').trim();

  if (isLikelyId(title)) title = '';
  if (isLikelyId(description)) description = '';

  const notificationType = formatLabel(item.notification_type) ?? item.notification_type;

  if (!title) {
    if (data.doctor_name) title = `Appointment with ${data.doctor_name}`;
    else if (notificationType) title = notificationType;
    else title = 'Notification';
  }

  if (!description || description === title) {
    const parts = [];
    if (data.patient_name) parts.push(`Patient: ${data.patient_name}`);
    if (data.doctor_name && !title.includes(data.doctor_name)) {
      parts.push(`Doctor: ${data.doctor_name}`);
    }
    if (data.reason) parts.push(String(data.reason));
    if (data.appointment_date || data.date) {
      parts.push(`Date: ${data.appointment_date ?? data.date}`);
    }
    description = parts.length ? parts.join(' · ') : description || title;
  }

  return {
    title,
    description,
    notificationType,
    eventType: formatLabel(item.event_type),
    patientName: data.patient_name,
    doctorName: data.doctor_name,
    reason: data.reason,
    appointmentStatus: data.appointment_status,
    appointmentId: data.appointment_id ?? data.id,
  };
};

export const getTimeAgo = (date) => {
  if (!date) return '';
  const created = new Date(date);
  if (Number.isNaN(created.getTime())) return '';
  const diff = Math.floor((Date.now() - created.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const getSection = (date) => {
  const created = new Date(date);
  const today = new Date();
  if (created.toDateString() === today.toDateString()) return 'today';
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (created.toDateString() === yesterday.toDateString()) return 'yesterday';
  return 'older';
};

export const getAppointmentIconConfig = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'confirmed':
    case 'accepted':
      return { glyph: '✓', bg: '#0D614E' };
    case 'pending':
      return { glyph: '◷', bg: '#F59E0B' };
    case 'cancelled':
    case 'rejected':
      return { glyph: '×', bg: '#EF4444' };
    case 'completed':
      return { glyph: '✓', bg: '#2563EB' };
    case 'rescheduled':
      return { glyph: '↻', bg: '#8B5CF6' };
    default:
      return { glyph: '▣', bg: '#0D614E' };
  }
};

export const mapNotification = (item) => {
  const content = resolveNotificationContent(item);
  const isRead = !!item.is_read;
  const appointmentIcon =
    item.notification_type === 'appointment'
      ? getAppointmentIconConfig(content.appointmentStatus)
      : { glyph: '●', bg: '#64748B' };

  return {
    id: String(item.id),
    title: content.title,
    description: content.description,
    createdAt: item.created_at,
    time: getTimeAgo(item.created_at),
    isRead,
    isNew: !isRead,
    type: item.notification_type,
    notificationType: content.notificationType,
    eventType: content.eventType,
    patientName: content.patientName,
    doctorName: content.doctorName,
    reason: content.reason,
    appointmentStatus: content.appointmentStatus,
    appointmentId: content.appointmentId,
    section: getSection(item.created_at),
    glyph: appointmentIcon.glyph,
    iconBg: appointmentIcon.bg,
    image: item.image || item.data?.image || item.data?.doctor_image || '',
    rawData: item,
  };
};

export const normalizeNotificationPayload = (raw = {}) => ({
  ...raw,
  type: String(raw?.type ?? raw?.notification_type ?? raw?.event_type ?? '').toUpperCase() || raw?.type,
  appointment_id: raw?.appointment_id ?? raw?.appointmentId ?? raw?.data?.appointment_id,
  order_id: raw?.order_id ?? raw?.orderId ?? raw?.data?.order_id,
  product_id: raw?.product_id ?? raw?.productId ?? raw?.data?.product_id,
  doctor_id: raw?.doctor_id ?? raw?.doctorId ?? raw?.data?.doctor_id,
  prescription_id: raw?.prescription_id ?? raw?.prescriptionId ?? raw?.data?.prescription_id,
  diet_id: raw?.diet_id ?? raw?.dietId ?? raw?.data?.diet_id,
  medicine_id: raw?.medicine_id ?? raw?.medicineId ?? raw?.data?.medicine_id,
});
