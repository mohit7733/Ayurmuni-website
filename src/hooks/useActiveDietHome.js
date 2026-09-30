import { useCallback, useEffect, useState } from 'react';
import { getDietPlanProgress, getDietPlans } from '../services/dietService';
import { isAuthenticated } from '../services/guestAuth';
import {
  extractDietPlanDetail,
  getDietListStatus,
  getDietPlanCoverUrl,
  getMealGalleryUrl,
  getPlanJsonDays,
  normalizeDietPlanList,
  normalizeProgressList,
  resolveCurrentDayKey,
} from '../diet/utils';

const MEAL_SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];

const isMealDone = (status) => {
  if (status === true || status === 1) return true;
  const value = String(status ?? '').toLowerCase().trim();
  return ['completed', 'complete', 'done', 'logged', 'true', '1'].includes(value);
};

export default function useActiveDietHome() {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!(await isAuthenticated())) {
      setPreview(null);
      return;
    }
    setLoading(true);
    try {
      const listRes = await getDietPlans({ page: 1 });
      const plans = normalizeDietPlanList(listRes);
      const active = plans.find((plan) => getDietListStatus(plan) === 'active');
      if (!active?.patient_diet_plan_id && !active?.id) {
        setPreview(null);
        return;
      }
      const detailRes = await getDietPlans({ id: active.id });
      const detail = extractDietPlanDetail(detailRes) ?? active;
      let progressList = [];
      try {
        if (active.patient_diet_plan_id) {
          const progressRes = await getDietPlanProgress(active.patient_diet_plan_id);
          progressList = normalizeProgressList(progressRes);
        }
      } catch {
        progressList = [];
      }
      const days = getPlanJsonDays(detail);
      const totalDays = days.length || 7;
      const currentDayKey = resolveCurrentDayKey(detail, progressList);
      const currentDay = Number(String(currentDayKey).replace(/\D/g, '')) || 1;
      const totalMeals = Math.max(totalDays * MEAL_SLOTS.length, 1);
      const completed = progressList.filter((item) => isMealDone(item.status)).length;
      const cover =
        getDietPlanCoverUrl(detail) ||
        getDietPlanCoverUrl(active) ||
        getMealGalleryUrl(detail?.plan_json?.[currentDayKey]?.breakfast) ||
        active?.thumbnail_url ||
        detail?.thumbnail_url ||
        null;
      setPreview({
        planId: String(active.id),
        title: String(active.title || active.name || 'Your Diet Plan'),
        subtitle: String(
          active.short_description || detail?.short_description || 'Personalized nutrition plan',
        ),
        currentDay: Math.min(currentDay, totalDays),
        totalDays,
        progressPercent: Math.min(100, Math.round((completed / totalMeals) * 100)),
        focusLabel:
          String(
            detail?.plan_json?.[currentDayKey]?.focus ||
              detail?.plan_json?.[currentDayKey]?.theme ||
              'Stay on track today',
          ),
        thumbnailUrl: cover,
      });
    } catch {
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { preview, loading, refresh };
}
