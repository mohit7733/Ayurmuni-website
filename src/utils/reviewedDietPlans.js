const STORAGE_KEY = 'ayurmuni_reviewed_diet_assignments';

let reviewedIds = new Set();
let hydrated = false;

export const hydrateReviewedDietPlans = async () => {
  if (hydrated) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    reviewedIds = new Set(Array.isArray(parsed) ? parsed.map((id) => String(id)) : []);
  } catch {
    reviewedIds = new Set();
  }
  hydrated = true;
};

export const markDietPlanAssignmentReviewed = async (patientDietPlanId) => {
  const id = String(patientDietPlanId || '').trim();
  if (!id) return;
  reviewedIds.add(id);
  hydrated = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...reviewedIds]));
  } catch {
    // non-blocking
  }
};

export const isDietPlanAssignmentReviewed = (patientDietPlanId) => {
  const id = String(patientDietPlanId || '').trim();
  if (!id) return false;
  return reviewedIds.has(id);
};
