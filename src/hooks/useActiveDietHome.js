import { useCallback, useEffect, useState } from 'react';
import { getDietPlanProgress, getDietPlans } from '../services/dietService';
import { isAuthenticated } from '../services/guestAuth';
import {
  extractDietPlanDetail,
  getDietListStatus,
  getDietPlanCoverUrl,
  getPlanJsonDays,
  mapPlanJsonMeals,
  normalizeDietPlanList,
  normalizeProgressList,
  resolveCurrentDayKey,
} from '../diet/utils';

/**
 * The signed-in user's active diet plan, for the homepage.
 * Same APIs the Diet pages use:
 *   GET patients/diet-plans/?page=1          -> assignment list (status per plan)
 *   GET patients/diet-plans/?id=<planId>     -> plan detail (plan_json days/meals)
 *   GET patients/diet-plans/progress/?id=<patient_diet_plan_id> -> progress_json
 * Resolves to null when logged out, no active plan, or on any API error.
 * Only real API fields are surfaced; optional fields stay null when absent.
 */
export default function useActiveDietHome(enabled = true) {
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
      if (listRes?.success === false) {
        setPreview(null);
        return;
      }
      const active = normalizeDietPlanList(listRes).find(
        (plan) => getDietListStatus(plan) === 'active',
      );
      if (!active?.id) {
        setPreview(null);
        return;
      }
      const detailRes = await getDietPlans({ id: active.id });
      const detail = extractDietPlanDetail(detailRes) ?? active;
      let progressList = [];
      if (active.patient_diet_plan_id) {
        try {
          progressList = normalizeProgressList(
            await getDietPlanProgress(active.patient_diet_plan_id),
          );
        } catch {
          progressList = [];
        }
      }

      const days = getPlanJsonDays(detail);
      const currentDayKey = resolveCurrentDayKey(detail, progressList);
      const currentDay = Number(String(currentDayKey).replace(/\D/g, '')) || null;
      const allMeals = days.flatMap((day) => mapPlanJsonMeals(detail, day, progressList));
      const doneMeals = allMeals.filter((meal) => meal.status === 'done').length;
      const todayMeals = mapPlanJsonMeals(detail, currentDayKey, progressList);
      const next = todayMeals.find((meal) => meal.status !== 'done') || null;

      setPreview({
        planId: String(active.id),
        assignmentId: active.patient_diet_plan_id ? String(active.patient_diet_plan_id) : null,
        title: String(detail?.name || active.name || ''),
        subtitle: String(active.short_description || '').trim() || null,
        currentDay: days.length && currentDay ? Math.min(currentDay, days.length) : null,
        totalDays: days.length || null,
        progressPercent: allMeals.length ? Math.round((doneMeals / allMeals.length) * 100) : null,
        nextMeal: next
          ? { type: next.type || null, title: next.title || null, time: next.time || null }
          : null,
        thumbnailUrl: getDietPlanCoverUrl(detail) || getDietPlanCoverUrl(active) || null,
      });
    } catch {
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    return undefined;
  }, [enabled, refresh]);

  return { preview, loading, refresh };
}
