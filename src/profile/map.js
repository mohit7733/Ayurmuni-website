import { formatRupee, resolveImageUrl } from '../home/catalog';
import { getAppointmentIds } from '../consult/appointmentUtils';
import { doctorDisplayName, doctorImage, getDoctorId } from '../consult/doctors';

export const mapOrderToListItem = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const first = items[0];
  const firstTitle =
    first?.variant?.variant_title || first?.product_name || first?.name || 'Order';
  const moreCount = Math.max(0, items.length - 1);
  return {
    id: String(order?.id ?? order?.order_code ?? ''),
    orderCode: String(order?.order_code || order?.order_number || order?.id || ''),
    title: moreCount > 0 ? `${firstTitle} +${moreCount} more` : firstTitle,
    status: String(order?.order_status || order?.status || 'pending'),
    date: order?.created_at
      ? new Date(order.created_at).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '',
    amount: formatRupee(order?.total_amount ?? order?.payable_amount ?? 0),
    image: resolveImageUrl(first?.variant || first),
    items,
    raw: order,
  };
};

const formatOrderDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const mapOrdersToRecentProducts = (orders = [], limit = 8) => {
  const sorted = [...orders].sort(
    (a, b) => new Date(b?.created_at ?? 0).getTime() - new Date(a?.created_at ?? 0).getTime(),
  );
  const recentItems = [];

  for (const order of sorted) {
    const orderDate = formatOrderDate(order?.created_at);
    const items = Array.isArray(order?.items) ? order.items : [];
    for (const item of items) {
      if (recentItems.length >= limit) break;
      recentItems.push({
        id: String(item?.id ?? item?.variant?.variant_id ?? recentItems.length),
        variantId: String(
          item?.variant?.variant_id ??
            item?.variant_id ??
            item?.product_variant_id ??
            item?.variant?.id ??
            '',
        ),
        name: item?.variant?.variant_title || item?.product_name || item?.name || 'Product',
        price: Number(item?.selling_price ?? item?.variant?.selling_price ?? 0),
        image: resolveImageUrl(item?.variant || item),
        lastOrdered: orderDate,
      });
    }
    if (recentItems.length >= limit) break;
  }

  return recentItems;
};

const pickFollowUpDate = (followUp, item) =>
  String(followUp?.date || followUp?.schedule || item?.follow_up_date || '').trim();

export const mapAppointment = (item) => {
  const doctor = item?.doctor || {};
  const appointment = item?.appointment || item;
  const ids = getAppointmentIds({ rawData: item, ...item, appointment });
  const id = ids.consultationId || ids.appointmentId;
  const doctorId = getDoctorId(doctor) || getDoctorId(item);
  const patient = appointment?.patient || item?.patient || null;
  const specialtyRaw =
    doctor?.doctor_specialization ||
    doctor?.specialization ||
    doctor?.specialization_name ||
    doctor?.qualification ||
    '';
  const specialty = Array.isArray(specialtyRaw)
    ? specialtyRaw.filter(Boolean).join(', ')
    : String(specialtyRaw || '').trim();
  const therapies = Array.isArray(doctor?.health_diseases)
    ? doctor.health_diseases.map((disease) => disease?.name || disease).filter(Boolean).join(', ')
    : specialty;
  const followUp = item?.follow_up || appointment?.follow_up || {};
  return {
    id: String(id),
    appointmentId: ids.appointmentId || ids.consultationId,
    consultationId: ids.consultationId,
    doctorId,
    doctorName: doctorDisplayName(doctor),
    image: doctorImage(doctor),
    specialty,
    therapies,
    date:
      appointment?.appointment_date ||
      item?.appointment_date ||
      item?.date ||
      '',
    time: appointment?.start_time || item?.start_time || item?.time || '',
    endTime: appointment?.end_time || item?.end_time || '',
    status: String(
      appointment?.appointment_status || item?.appointment_status || item?.status || '',
    ),
    call_status: String(
      appointment?.call_status || item?.call_status || item?.rawData?.call_status || '',
    ),
    concern: item?.concern || appointment?.concern || '',
    patientId: String(patient?.id ?? patient?.patient_id ?? appointment?.patient_id ?? '').trim(),
    patientName: String(
      patient?.patient_name || patient?.full_name || patient?.name || '',
    ).trim(),
    followUpDate: pickFollowUpDate(followUp, item),
    hasPrescription: Boolean(
      item?.has_prescription ||
        item?.is_prescribed ||
        item?.prescription_id ||
        appointment?.prescription_id ||
        appointment?.prescription ||
        item?.prescription,
    ),
    raw: item,
  };
};
