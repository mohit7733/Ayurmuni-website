import { apiClient } from './apiClient';

const ALL_CATEGORY = { key: '', title: 'All' };

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

const normalizeCategory = (raw) => {
  if (!raw) return { id: '', name: '', imageUrl: null };
  if (typeof raw === 'string') {
    const name = raw.trim();
    return { id: name.toLowerCase(), name, imageUrl: null };
  }
  if (typeof raw !== 'object') return { id: '', name: '', imageUrl: null };
  const id = String(raw.id || raw.uuid || raw.key || raw.slug || '').trim();
  const name = String(raw.name || raw.title || raw.label || raw.category || '').trim();
  return {
    id: id || name.toLowerCase(),
    name: name || 'General',
    imageUrl: raw.image_url || raw.image || null,
  };
};

export const normalizeFaqItem = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.faq_id || raw.uuid || '').trim();
  const question = String(raw.question || raw.title || raw.heading || '').trim();
  if (!id && !question) return null;

  const category = normalizeCategory(raw.category || raw.faq_category);
  const imageUrls = Array.isArray(raw.image_urls)
    ? raw.image_urls.filter(Boolean)
    : [];
  const primaryImage =
    imageUrls[0] || raw.image_url || raw.image || category.imageUrl || null;

  return {
    ...raw,
    id: id || question,
    question: question || 'Untitled question',
    answer: String(raw.answer || raw.description || raw.content || raw.body || '').trim(),
    category,
    categoryId: category.id,
    categoryName: category.name,
    categoryLabel: category.name,
    image_url: primaryImage,
    image_urls: imageUrls,
    display_order: Number(raw.display_order) || 0,
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
  return pickList(response)
    .map(normalizeFaqItem)
    .filter(Boolean)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
};

export const getFaqDetail = async (faqId) => {
  if (!faqId) return null;
  const response = await getFaqs({ id: faqId });
  const list = pickList(response).map(normalizeFaqItem).filter(Boolean);
  if (list.length) return list[0];
  const data = response?.data ?? response;
  return normalizeFaqItem(data);
};

export const buildFaqCategories = (faqs = []) => {
  const seen = new Map();
  faqs.forEach((faq) => {
    const id = String(faq?.categoryId || faq?.category?.id || '').trim();
    const name = String(faq?.categoryName || faq?.category?.name || '').trim();
    if (!id && !name) return;
    const key = id || name.toLowerCase();
    if (seen.has(key)) return;
    seen.set(key, {
      key,
      title: name || 'General',
      imageUrl: faq?.category?.imageUrl || faq?.category?.image_url || null,
    });
  });
  return [ALL_CATEGORY, ...seen.values()];
};

export const groupFaqsByCategory = (faqs = []) => {
  const groups = [];
  const indexByKey = new Map();

  faqs.forEach((faq) => {
    const key = String(faq?.categoryId || faq?.categoryName || 'general').trim() || 'general';
    const title = String(faq?.categoryName || 'General').trim() || 'General';
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        title,
        imageUrl: faq?.category?.imageUrl || null,
        items: [],
      });
    }
    groups[indexByKey.get(key)].items.push(faq);
  });

  return groups;
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

/** @deprecated Use buildFaqCategories() from live FAQ data instead. */
export const FAQ_CATEGORIES = [ALL_CATEGORY];
