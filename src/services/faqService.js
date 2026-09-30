import { apiClient } from './apiClient';

export const FAQ_CATEGORIES = [
  { key: '', title: 'All' },
  { key: 'general', title: 'General' },
  { key: 'account', title: 'Account' },
  { key: 'appointments', title: 'Appointments' },
  { key: 'orders', title: 'Orders' },
  { key: 'payments', title: 'Payments' },
  { key: 'products', title: 'Products' },
  { key: 'diet_plans', title: 'Diet Plans' },
  { key: 'yoga', title: 'Yoga' },
  { key: 'medical_records', title: 'Records' },
  { key: 'prakriti', title: 'Prakriti' },
];

const pickList = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.faqs)) return data.faqs;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export const normalizeFaqItem = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.faq_id || raw.uuid || '').trim();
  const question = String(raw.question || raw.title || raw.heading || '').trim();
  if (!id && !question) return null;
  return {
    ...raw,
    id: id || question,
    question: question || 'Untitled question',
    answer: String(raw.answer || raw.description || raw.content || raw.body || '').trim(),
    category: raw.category || raw.faq_category || '',
  };
};

export const getFaqs = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.id) query.set('id', String(params.id));
  if (params.category) query.set('category', String(params.category));
  const qs = query.toString();
  return apiClient(qs ? `customers/faqs/?${qs}` : 'customers/faqs/', { method: 'GET' });
};

export const getFaqList = async (category) => {
  const response = await getFaqs({ category: category || undefined });
  return pickList(response).map(normalizeFaqItem).filter(Boolean);
};

export const getFaqDetail = async (faqId) => {
  if (!faqId) return null;
  const response = await getFaqs({ id: faqId });
  const list = pickList(response).map(normalizeFaqItem).filter(Boolean);
  if (list.length) return list[0];
  const data = response?.data ?? response;
  return normalizeFaqItem(data);
};

export const formatFaqUpdatedLabel = (faq) => {
  const raw = faq?.updated_at || faq?.modified_at || faq?.created_at;
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return `Updated ${date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
};

