import { apiClient } from './apiClient';

export const getPatientList = async () =>
  apiClient('patients/', { method: 'GET' });

export const getPatientById = async (id) =>
  apiClient(`patients/?id=${encodeURIComponent(String(id))}`, { method: 'GET' });

export const addPatient = async (patientData) =>
  apiClient('patients/', {
    method: 'POST',
    body: JSON.stringify(patientData),
  });

export const updatePatientById = async (id, patientData) =>
  apiClient(`patients/?id=${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    body: JSON.stringify(patientData),
  });

export const switchPatient = async (id) =>
  apiClient(`patients/switch/?id=${encodeURIComponent(String(id))}`, {
    method: 'POST',
  });

export const deletePatientById = async (id) =>
  apiClient(`patients/?id=${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  });

export const listPatients = (response) => {
  const data = response?.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

export const extractPatient = (response) => {
  const data = response?.data ?? response;
  if (Array.isArray(data?.results) && data.results.length) return data.results[0];
  if (Array.isArray(data) && data.length) return data[0];
  if (data && typeof data === 'object' && (data.id || data.first_name)) return data;
  return null;
};

export const isSelfRelation = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase() === 'self';

export const getMedicalRecords = async () =>
  apiClient('customers/medical-records/', { method: 'GET' });

export const addMedicalRecord = async (payload) =>
  apiClient('customers/medical-records/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteMedicalRecord = async (recordId) =>
  apiClient(`customers/medical-records/?id=${encodeURIComponent(String(recordId))}`, {
    method: 'DELETE',
  });

export const listMedicalRecords = (response) => {
  const data = response?.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

export const isImageRecord = (item) => {
  const type = String(item?.file_type || '').toLowerCase();
  const url = String(item?.file_url || item?.thumbnail_url || '');
  if (type.includes('pdf')) return false;
  if (type.includes('image') || type === 'jpg' || type === 'jpeg' || type === 'png' || type === 'webp') {
    return true;
  }
  return /\.(jpe?g|png|gif|webp|heic)(\?|$)/i.test(url);
};

export const formatRecordType = (type) => {
  const value = String(type || '').toLowerCase();
  if (value === 'prescription') return 'Prescription';
  if (value === 'lab_report') return 'Lab Report';
  if (!value) return 'Record';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const formatRecordDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};
