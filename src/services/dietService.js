import { apiClient } from './apiClient';

export const DIET_PLAN_PAGE_SIZE = 20;

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([key, value]) => {
      if (key === 'min_rating') return false;
      return value !== undefined && value !== null && String(value).trim() !== '';
    }),
  );

const toQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(cleanParams(params)).forEach(([key, value]) => {
    query.set(key, String(value));
  });
  return query.toString();
};

export const getDietPlans = async (params = {}) => {
  const qs = toQuery(params);
  return apiClient(qs ? `patients/diet-plans/?${qs}` : 'patients/diet-plans/', {
    method: 'GET',
  });
};

export const hasMoreDietPlanPages = (response, resultsLength, pageSize = DIET_PLAN_PAGE_SIZE, pageLoaded) => {
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
    if (total != null) return resultsLength >= pageSize;
  }
  return resultsLength >= pageSize;
};

export const startDietPlan = async (diet_plan_id, options) => {
  const id = String(diet_plan_id).trim();
  const body = { diet_plan_id: id, id };
  if (
    options?.daily_water_intake_goal != null &&
    Number.isFinite(Number(options.daily_water_intake_goal)) &&
    Number(options.daily_water_intake_goal) > 0
  ) {
    body.daily_water_intake_goal = Math.round(Number(options.daily_water_intake_goal));
  }
  return apiClient('patients/diet-plans/start/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const updateDietPlanWater = async (payload) =>
  apiClient('patients/diet-plans/water/', {
    method: 'PATCH',
    body: JSON.stringify({
      day: String(payload.day || 'day_1'),
      intake_ml: Math.max(0, Math.round(Number(payload.intake_ml) || 0)),
    }),
  });

export const getDietPlanProgress = async (patient_diet_plan_id) => {
  const qs =
    patient_diet_plan_id != null && String(patient_diet_plan_id).trim() !== ''
      ? `?id=${encodeURIComponent(String(patient_diet_plan_id))}`
      : '';
  return apiClient(`patients/diet-plans/progress/${qs}`, { method: 'GET' });
};

export const updateDietPlanProgress = async (payload) => {
  const body = {
    day: payload.day,
    meal: payload.meal,
    status: payload.status,
  };
  if (payload.status === 'completed') {
    body.completed_at =
      payload.completed_at || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  } else if (payload.completed_at !== undefined) {
    body.completed_at = payload.completed_at;
  }
  return apiClient('patients/diet-plans/progress/', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
};

export const updateDietPlanStatus = async (patient_diet_plan_id, payload) => {
  const id = encodeURIComponent(String(patient_diet_plan_id));
  return apiClient(`patients/diet-plans/status/?id=${id}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
