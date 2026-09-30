import { apiClient } from './apiClient';
import { applyDoctorFeesToResponse } from '../consult/doctors';
import { Utils } from '../common/utils';
import { BaseUrl } from '../config/key';

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && String(value).trim() !== '',
    ),
  );

const doctorsQuery = (params) => {
  const query = new URLSearchParams();
  Object.entries(cleanParams(params)).forEach(([key, value]) => {
    query.set(key, String(value));
  });
  return query.toString();
};

export const getDoctors = async (params = {}) => {
  const qs = doctorsQuery(params);
  const response = await apiClient(qs ? `customers/doctors/?${qs}` : 'customers/doctors/', {
    method: 'GET',
  });
  return applyDoctorFeesToResponse(response);
};

export const getTopDoctors = async () => getDoctors();

export const getDoctorById = async (id, extra = {}) =>
  getDoctors({ id, ...extra });

export const toggleFavDoctor = async (doctorId) =>
  apiClient(`favorites/doctors/?doctor_id=${encodeURIComponent(String(doctorId))}`, {
    method: 'POST',
  });

export const getRecentVisitedDoctors = async () =>
  apiClient('customers/doctors/recent/', { method: 'GET' });

export const getConsultHistory = async (params = {}) => {
  const qs = doctorsQuery(params);
  return apiClient(
    qs
      ? `customers/doctors/consultation-history/?${qs}`
      : 'customers/doctors/consultation-history/',
    { method: 'GET' },
  );
};

// export const getDoctorSlip = async (doctorId) =>
//   apiClient(
//     `customers/doctor-slip/?doctor_id=${encodeURIComponent(String(doctorId))}`,
//     { method: 'GET' },
//   );

export const createConsultationPayment = async (data) => {
  const clean = cleanParams(data);
  return apiClient('payments/customer/consultation/payment/book-slot/', {
    method: 'POST',
    body: JSON.stringify(clean),
  });
};

export const retryConsultationPayment = async (appointmentId) =>
  apiClient(
    `payments/customer/consultation/payment/retry/?appointment_id=${encodeURIComponent(
      String(appointmentId),
    )}`,
    { method: 'POST' },
  );

export const getConsultationFeeQuote = async (slotId, couponCode) => {
  const params = new URLSearchParams();
  params.set('slot_id', String(slotId));
  if (couponCode) params.set('coupon_code', String(couponCode));
  return apiClient(`payments/customer/consultation/fee-quote/?${params.toString()}`, {
    method: 'GET',
  });
};

export const verifyConsultationPayment = async (data) =>
  apiClient('payments/customer/consultation/payment/verify-payment/', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getMedicalReceipt = async (consultationId) =>
  apiClient(
    `customers/doctors/consultation-receipt/?consultation_id=${encodeURIComponent(
      String(consultationId),
    )}`,
    { method: 'GET' },
  );

export const getDoctorSlip = async (doctorId) =>
  apiClient(
    `customers/doctor-slip/?doctor_id=${encodeURIComponent(String(doctorId))}`,
    { method: 'GET' },
  );

export const getAppointmentDetail = async (lookupId) => {
  const tryFetch = async (param) =>
    apiClient(
      `customers/patient/consultation/?${param}=${encodeURIComponent(lookupId)}`,
      { method: 'GET' },
    );
  let response = await tryFetch('appointment_id');
  if (response?.success) return response;
  const message = String(response?.message || '').toLowerCase();
  const notFound =
    response?.status === 404 ||
    message.includes('not found') ||
    message.includes('does not exist');
  if (notFound || !response?.success) {
    response = await tryFetch('consultation_id');
  }
  return response;
};

export const appointmentActionAPI = async (appointmentId, payload) =>
  apiClient(`customers/doctors/appointments/action/?id=${encodeURIComponent(String(appointmentId))}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

const pdfUrlFromJson = (json) =>
  json?.data?.url ||
  json?.data?.file_url ||
  json?.data?.pdf_url ||
  json?.data?.prescription_url ||
  json?.data?.download_url ||
  json?.url ||
  json?.file_url ||
  json?.pdf_url ||
  json?.prescription_url ||
  json?.download_url ||
  '';

export const downloadPrescriptionFile = async (prescriptionID) => {
  const token = await Utils.getData('_TOKEN');
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(
    `${BaseUrl.base_url}customers/prescription/download/?prescription_id=${encodeURIComponent(
      String(prescriptionID),
    )}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/pdf, application/octet-stream, application/json, */*',
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Prescription download failed: ${response.status}`);
  }
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/pdf')) {
    return { success: true, status: response.status, data: await response.arrayBuffer() };
  }
  if (contentType.includes('application/json')) {
    const json = await response.json();
    const pdfUrl = pdfUrlFromJson(json);
    if (pdfUrl) {
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Prescription PDF fetch failed: ${pdfResponse.status}`);
      }
      return { success: true, status: pdfResponse.status, data: await pdfResponse.arrayBuffer() };
    }
    const base64 = json?.data?.base64 || json?.base64 || json?.data?.pdf_base64 || json?.pdf_base64;
    if (base64) {
      return { success: true, status: response.status, base64 };
    }
    const prescriptionData = json?.data && typeof json.data === 'object' ? json.data : null;
    if (
      prescriptionData &&
      (prescriptionData.prescription_code ||
        prescriptionData.medicines ||
        prescriptionData.id ||
        prescriptionData.doctor ||
        prescriptionData.patient)
    ) {
      return { success: true, status: response.status, prescriptionData };
    }
    throw new Error('Prescription PDF URL/data not found in API response');
  }
  return { success: true, status: response.status, data: await response.arrayBuffer() };
};
