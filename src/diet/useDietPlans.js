import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import {
  DIET_PLAN_PAGE_SIZE,
  getDietPlanProgress,
  getDietPlans,
  hasMoreDietPlanPages,
  startDietPlan,
  updateDietPlanProgress,
  updateDietPlanStatus,
  updateDietPlanWater,
} from '../services/dietService';
import {
  buildDietDayChips,
  buildWaterProgressPatch,
  calculateDietNutrition,
  extractDietApiError,
  extractDietPlanDetail,
  extractProgressPayload,
  getDietListStatus,
  getPlanJsonDays,
  getWaterGoalMl,
  getWaterIntakeForDay,
  isAlreadyActiveDietPlanError,
  isDietPlanStarted,
  isNoActiveDietPlanError,
  mapDietPlanSummary,
  mapPlanJsonMeals,
  mergePlanAssignmentFields,
  mergePlanJsonWithGalleries,
  normalizeDietPlanList,
  normalizeProgressList,
  nowIso,
  resolveCurrentDayKey,
  WATER_LITER_ML,
} from './utils';

const normalizeListFilters = (filters) => {
  if (!filters) return {};
  const search = String(filters.search || '').trim();
  const prakriti = String(filters.prakriti || '').trim();
  const health_category_id =
    filters.health_category_id != null && String(filters.health_category_id).trim() !== ''
      ? filters.health_category_id
      : undefined;
  const health_disease_id =
    filters.health_disease_id != null && String(filters.health_disease_id).trim() !== ''
      ? filters.health_disease_id
      : undefined;
  const duration =
    filters.duration != null && String(filters.duration).trim() !== ''
      ? filters.duration
      : undefined;
  const calories =
    filters.calories != null && String(filters.calories).trim() !== ''
      ? filters.calories
      : undefined;
  const sort = String(filters.sort || '').trim() || undefined;
  const min_rating =
    filters.min_rating != null && String(filters.min_rating).trim() !== ''
      ? filters.min_rating
      : undefined;
  const is_paid =
    filters.is_paid === true ||
    filters.is_paid === false ||
    filters.is_paid === 'true' ||
    filters.is_paid === 'false'
      ? filters.is_paid
      : undefined;
  return {
    ...(search ? { search } : {}),
    ...(prakriti && prakriti.toLowerCase() !== 'all' ? { prakriti } : {}),
    ...(health_category_id != null ? { health_category_id } : {}),
    ...(health_disease_id != null ? { health_disease_id } : {}),
    ...(is_paid != null ? { is_paid } : {}),
    ...(duration != null ? { duration } : {}),
    ...(calories != null ? { calories } : {}),
    ...(sort ? { sort } : {}),
    ...(min_rating != null ? { min_rating } : {}),
  };
};

export default function useDietPlans(options = {}) {
  const { initialPlanId = null, listType = null, listFilters } = options;
  const normalizedFilters = useMemo(
    () => normalizeListFilters(listFilters),
    [JSON.stringify(normalizeListFilters(listFilters))],
  );
  const hasServerFilters = Object.keys(normalizedFilters).length > 0;
  const effectiveListType = listType === 'all' || hasServerFilters ? 'all' : null;

  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId);
  const [planDetail, setPlanDetail] = useState(null);
  const [progress, setProgress] = useState([]);
  const [currentDayKey, setCurrentDayKey] = useState('day_1');
  const [todayDayKey, setTodayDayKey] = useState('day_1');
  const [showAllDays, setShowAllDays] = useState(false);
  const [meals, setMeals] = useState([]);
  const [mealsByDay, setMealsByDay] = useState([]);
  const [waterMl, setWaterMl] = useState(0);
  const [updatingWater, setUpdatingWater] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [starting, setStarting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [loggingMealId, setLoggingMealId] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const currentDayKeyRef = useRef(currentDayKey);
  const plansRef = useRef([]);
  const planDetailRef = useRef(null);
  const hasInitializedDayRef = useRef(false);
  const loadingMoreLockRef = useRef(false);
  const hasMoreRef = useRef(true);
  const pageRef = useRef(1);
  const listRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const loadDetailRef = useRef(async () => null);
  const lastCompletedAssignmentIdRef = useRef(null);
  currentDayKeyRef.current = currentDayKey;

  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);
  useEffect(() => {
    planDetailRef.current = planDetail;
  }, [planDetail]);
  useEffect(() => {
    if (!planDetail || !currentDayKey) return;
    setWaterMl(getWaterIntakeForDay(planDetail, currentDayKey));
  }, [planDetail, currentDayKey]);

  const nutrition = useMemo(
    () => calculateDietNutrition(meals, planDetail, currentDayKey, { waterMl }),
    [meals, planDetail, currentDayKey, waterMl],
  );

  const rebuildMeals = useCallback((detail, progressList, preferredDayKey, forceDay = false) => {
    if (!detail) {
      setMeals([]);
      setMealsByDay([]);
      return;
    }
    const todayKey = resolveCurrentDayKey(detail, progressList);
    setTodayDayKey(todayKey);
    const days = getPlanJsonDays(detail);
    const allDays = days.map((dayKey) => {
      const dayNumber = Number(String(dayKey).replace(/\D/g, '')) || 0;
      return {
        dayKey,
        label: `Day ${dayNumber || dayKey}`,
        meals: mapPlanJsonMeals(detail, dayKey, progressList),
      };
    });
    setMealsByDay(allDays);
    const requestedRaw = forceDay
      ? preferredDayKey || todayKey
      : preferredDayKey || currentDayKeyRef.current || todayKey;
    const requested = String(requestedRaw || '').toLowerCase();
    const dayKey =
      days.find((d) => d.toLowerCase() === requested) ||
      days.find((d) => d.toLowerCase() === String(todayKey).toLowerCase()) ||
      days[0] ||
      'day_1';
    currentDayKeyRef.current = dayKey;
    setCurrentDayKey(dayKey);
    setMeals(mapPlanJsonMeals(detail, dayKey, progressList));
  }, []);

  const selectDay = useCallback(
    (dayKey) => {
      if (!dayKey) return;
      setShowAllDays(false);
      currentDayKeyRef.current = dayKey;
      setCurrentDayKey(dayKey);
      if (!planDetail) return;
      setMeals(mapPlanJsonMeals(planDetail, dayKey, progress));
      setWaterMl(getWaterIntakeForDay(planDetail, dayKey));
    },
    [planDetail, progress],
  );

  const planDays = useMemo(
    () => buildDietDayChips(planDetail, progress, todayDayKey),
    [planDetail, progress, todayDayKey],
  );

  const emptyProgress = useCallback(
    (raw = null) => ({
      progressList: [],
      planJson: null,
      startedAt: null,
      assignmentId: null,
      dietPlanId: null,
      status: null,
      raw,
    }),
    [],
  );

  const loadProgress = useCallback(
    async (patientDietPlanId) => {
      if (patientDietPlanId == null || String(patientDietPlanId).trim() === '') {
        return emptyProgress();
      }
      const res = await getDietPlanProgress(patientDietPlanId);
      if (res?.success === false) return emptyProgress(res);
      return { ...extractProgressPayload(res), raw: res };
    },
    [emptyProgress],
  );

  const fetchListPage = useCallback(
    async (pageToLoad, mode) => {
      if (mode === 'append') {
        if (loadingMoreLockRef.current || !hasMoreRef.current) return;
        loadingMoreLockRef.current = true;
        setLoadingMore(true);
      } else {
        listRequestIdRef.current += 1;
        setLoadingList(true);
      }
      const requestId = listRequestIdRef.current;
      try {
        const { min_rating: _minRating, ...apiFilters } = normalizedFilters;
        const res = await getDietPlans({
          ...(effectiveListType ? { type: effectiveListType } : {}),
          ...apiFilters,
          page: pageToLoad,
          page_size: DIET_PLAN_PAGE_SIZE,
        });
        let assignmentOverlay = [];
        if (effectiveListType === 'all') {
          const assignRes = await getDietPlans({ page: 1, page_size: 100 });
          if (assignRes?.success !== false) assignmentOverlay = normalizeDietPlanList(assignRes);
        }
        if (requestId !== listRequestIdRef.current) return;
        if (res?.success === false) {
          if (mode === 'replace') {
            setPlans([]);
            setHasMore(false);
            hasMoreRef.current = false;
          }
          return;
        }
        const mappedRaw =
          assignmentOverlay.length > 0
            ? mergePlanAssignmentFields(normalizeDietPlanList(res), assignmentOverlay)
            : normalizeDietPlanList(res);
        const seenIds = new Set(mappedRaw.map((p) => String(p.id)));
        const missingAssigned = assignmentOverlay.filter((p) => {
          const id = String(p.id || '');
          if (!id || seenIds.has(id)) return false;
          const st = getDietListStatus(p);
          return st === 'active' || st === 'paused';
        });
        const mapped = [...missingAssigned, ...mappedRaw];
        let more = hasMoreDietPlanPages(res, mapped.length, DIET_PLAN_PAGE_SIZE, pageToLoad);
        setPlans((prev) => {
          if (mode !== 'append') {
            plansRef.current = mapped;
            return mapped;
          }
          const seen = new Set(prev.map((p) => String(p.id)));
          const unique = mapped.filter((p) => {
            const id = String(p.id);
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          if (unique.length === 0 || mapped.length < DIET_PLAN_PAGE_SIZE) more = false;
          const next = [...prev, ...unique];
          plansRef.current = next;
          return next;
        });
        if (mode === 'replace' && mapped.length < DIET_PLAN_PAGE_SIZE) more = false;
        pageRef.current = pageToLoad;
        setHasMore(more);
        hasMoreRef.current = more;
      } catch {
        if (requestId !== listRequestIdRef.current) return;
        if (mode === 'replace') {
          setPlans([]);
          plansRef.current = [];
          setHasMore(false);
          hasMoreRef.current = false;
        }
      } finally {
        if (mode === 'append') loadingMoreLockRef.current = false;
        if (requestId === listRequestIdRef.current) {
          setLoadingList(false);
          setLoadingMore(false);
        }
      }
    },
    [effectiveListType, normalizedFilters],
  );

  const loadList = useCallback(async () => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    setHasMore(true);
    await fetchListPage(1, 'replace');
  }, [fetchListPage]);

  const loadMore = useCallback(() => {
    if (loadingList || loadingMore || !hasMoreRef.current || loadingMoreLockRef.current) return;
    fetchListPage(pageRef.current + 1, 'append');
  }, [fetchListPage, loadingList, loadingMore]);

  const loadDetail = useCallback(
    async (planId) => {
      if (!planId) return null;
      const requestId = ++detailRequestIdRef.current;
      setLoadingDetail(true);
      try {
        let catalogPlanId = String(planId).trim();
        const listSummary =
          plansRef.current.find((p) => String(p.id) === catalogPlanId) ||
          plansRef.current.find((p) => String(p.patient_diet_plan_id || '') === catalogPlanId) ||
          null;
        if (
          listSummary &&
          String(listSummary.patient_diet_plan_id || '') === catalogPlanId &&
          String(listSummary.id) !== catalogPlanId
        ) {
          catalogPlanId = String(listSummary.id);
        }
        const detailRes = await getDietPlans({ id: catalogPlanId });
        if (requestId !== detailRequestIdRef.current) return null;
        let detail = extractDietPlanDetail(detailRes);
        if (!detail || detailRes?.success === false) {
          detail = listSummary ? { ...listSummary } : mapDietPlanSummary({ id: catalogPlanId });
        } else {
          detail = {
            ...(listSummary || {}),
            ...detail,
            patient_diet_plan_id:
              detail?.patient_diet_plan_id ?? listSummary?.patient_diet_plan_id ?? null,
            patient_assignment_status:
              detail?.patient_assignment_status ?? listSummary?.patient_assignment_status ?? null,
            started_at: detail?.started_at ?? listSummary?.started_at ?? null,
            ended_at: detail?.ended_at ?? listSummary?.ended_at ?? null,
            stop_reason: detail?.stop_reason ?? listSummary?.stop_reason ?? null,
            repeat_count: detail?.repeat_count ?? listSummary?.repeat_count ?? 0,
          };
        }
        const assignmentFromDetail = detail?.patient_diet_plan_id
          ? String(detail.patient_diet_plan_id)
          : '';
        const rawCatalogId = String(detail?.diet_plan_id || detail?.id || catalogPlanId);
        const safeCatalogId =
          rawCatalogId && rawCatalogId !== assignmentFromDetail ? rawCatalogId : catalogPlanId;
        const catalogPlanJson =
          detail?.plan_json || listSummary?.plan_json || planDetailRef.current?.plan_json || null;
        detail = {
          ...detail,
          id: safeCatalogId,
          plan_json: detail?.plan_json || catalogPlanJson || null,
        };
        let assignmentId = detail?.patient_diet_plan_id || null;
        let listStatus = getDietListStatus(detail);
        let progressList = [];
        if (assignmentId && listStatus === 'active') {
          const progressPayload = await loadProgress(assignmentId);
          if (requestId !== detailRequestIdRef.current) return null;
          if (isNoActiveDietPlanError(progressPayload.raw)) {
            detail = {
              ...detail,
              patient_assignment_status: detail?.patient_assignment_status || 'paused',
            };
          } else {
            const sameAssignment =
              !progressPayload.assignmentId ||
              String(progressPayload.assignmentId) === String(assignmentId);
            const sameDietPlan =
              !progressPayload.dietPlanId || String(progressPayload.dietPlanId) === String(safeCatalogId);
            if (sameAssignment && sameDietPlan) {
              if (progressPayload.planJson) {
                detail = {
                  ...detail,
                  plan_json: mergePlanJsonWithGalleries(catalogPlanJson, progressPayload.planJson),
                };
              }
              if (progressPayload.startedAt) {
                detail = { ...detail, started_at: progressPayload.startedAt };
              }
              progressList = progressPayload.progressList;
            }
          }
        }
        if (requestId !== detailRequestIdRef.current) return null;
        setPlanDetail(detail);
        setProgress(progressList);
        if (getDietListStatus(detail) === 'completed' && detail?.patient_diet_plan_id) {
          lastCompletedAssignmentIdRef.current = String(detail.patient_diet_plan_id);
        }
        setPlans((prev) =>
          prev.map((p) =>
            String(p.id) === String(safeCatalogId)
              ? {
                  ...p,
                  patient_diet_plan_id: detail.patient_diet_plan_id ?? p.patient_diet_plan_id,
                  patient_assignment_status:
                    detail.patient_assignment_status ?? p.patient_assignment_status,
                  started_at: detail.started_at ?? p.started_at,
                  ended_at: detail.ended_at ?? p.ended_at,
                  stop_reason: detail.stop_reason ?? p.stop_reason,
                  repeat_count: detail.repeat_count ?? p.repeat_count,
                }
              : p,
          ),
        );
        if (isDietPlanStarted(detail)) {
          const todayKey = resolveCurrentDayKey(detail, progressList);
          const forceToday = !hasInitializedDayRef.current;
          if (forceToday) hasInitializedDayRef.current = true;
          rebuildMeals(
            detail,
            progressList,
            forceToday ? todayKey : currentDayKeyRef.current || todayKey,
            forceToday,
          );
        } else {
          setMeals([]);
          setMealsByDay([]);
          setShowAllDays(false);
        }
        return detail;
      } catch {
        if (requestId !== detailRequestIdRef.current) return null;
        setPlanDetail(null);
        setMeals([]);
        return null;
      } finally {
        if (requestId === detailRequestIdRef.current) setLoadingDetail(false);
      }
    },
    [loadProgress, rebuildMeals],
  );

  loadDetailRef.current = loadDetail;

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (initialPlanId) {
      setSelectedPlanId((prev) =>
        prev === String(initialPlanId) ? prev : String(initialPlanId),
      );
    }
  }, [initialPlanId]);

  useEffect(() => {
    if (selectedPlanId) loadDetailRef.current(selectedPlanId);
    else {
      detailRequestIdRef.current += 1;
      setPlanDetail(null);
      setMeals([]);
      setProgress([]);
    }
  }, [selectedPlanId]);

  const selectPlan = useCallback((planId) => {
    hasInitializedDayRef.current = false;
    setPlanDetail(null);
    setMeals([]);
    setMealsByDay([]);
    setProgress([]);
    setShowAllDays(false);
    setSelectedPlanId(planId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPlanId(null);
    setPlanDetail(null);
    setMeals([]);
    setMealsByDay([]);
    setProgress([]);
    setShowAllDays(false);
    hasInitializedDayRef.current = false;
    setLoadingDetail(false);
  }, []);

  const resolveActiveAssignment = useCallback(async () => {
    const fromList = plansRef.current.find((p) => getDietListStatus(p) === 'active') || null;
    if (fromList?.patient_diet_plan_id) return fromList;
    const res = await getDietPlans({ page: 1, page_size: 100 });
    if (res?.success === false) return null;
    const active = normalizeDietPlanList(res).find((p) => getDietListStatus(p) === 'active') || null;
    if (active) {
      setPlans((prev) => {
        const id = String(active.id);
        if (!id) return prev;
        if (prev.some((p) => String(p.id) === id)) {
          return prev.map((p) => (String(p.id) === id ? { ...p, ...active } : p));
        }
        return [active, ...prev];
      });
    }
    return active;
  }, []);

  const startPlan = useCallback(
    async (planId, options) => {
      const summary = plans.find((p) => String(p.id) === String(planId || selectedPlanId));
      const assignmentId = String(
        planDetail?.patient_diet_plan_id || summary?.patient_diet_plan_id || '',
      ).trim();
      const rawDetailId = String(planDetail?.id || '').trim();
      const detailCatalogId = String(planDetail?.diet_plan_id || '').trim();
      const safeDetailId = rawDetailId && rawDetailId !== assignmentId ? rawDetailId : '';
      const id = String(
        planId || selectedPlanId || detailCatalogId || safeDetailId || '',
      ).trim();
      if (!id || id === assignmentId) {
        showSuccessToast(
          'Couldn’t start this plan — open it again from the diet list and tap Start.',
          'error',
        );
        return false;
      }
      if (!(await requireAuth('Please login to start a diet plan'))) return false;

      const resumeAssignment = async (patientAssignmentId) => {
        const resumeRes = await updateDietPlanStatus(patientAssignmentId, { action: 'resume' });
        if (resumeRes?.success === false) {
          const errMsg = extractDietApiError(resumeRes, 'Unable to resume plan');
          if (isAlreadyActiveDietPlanError(errMsg)) {
            return { conflict: true, activePlan: await resolveActiveAssignment() };
          }
          showSuccessToast(errMsg, 'error');
          return false;
        }
        showSuccessToast(resumeRes?.message || 'Plan resumed — you’re tracking again.', 'success');
        await loadList();
        await loadDetail(id);
        return true;
      };

      try {
        setStarting(true);
        const assignmentStatus = String(
          planDetail?.patient_assignment_status || summary?.patient_assignment_status || '',
        ).toLowerCase();
        if (assignmentId && assignmentStatus.includes('pause')) {
          return await resumeAssignment(assignmentId);
        }
        if (assignmentId && assignmentStatus.includes('complete')) {
          showSuccessToast(
            'This plan is completed. Tap Repeat to start a new run from Day 1.',
            'error',
          );
          return false;
        }
        const res = await startDietPlan(id, options);
        if (res?.success === false) {
          const errMsg = extractDietApiError(res, 'Unable to start diet plan');
          if (isAlreadyActiveDietPlanError(errMsg)) {
            await loadList();
            return { conflict: true, activePlan: await resolveActiveAssignment() };
          }
          showSuccessToast(errMsg, 'error');
          return false;
        }
        showSuccessToast(res?.message || 'Diet plan started — you’re now tracking this plan.', 'success');
        await loadList();
        await loadDetail(id);
        return true;
      } catch (e) {
        const errMsg = extractDietApiError(e, e?.message || 'Unable to start plan');
        if (isAlreadyActiveDietPlanError(errMsg)) {
          await loadList();
          return { conflict: true, activePlan: await resolveActiveAssignment() };
        }
        showSuccessToast(errMsg, 'error');
        return false;
      } finally {
        setStarting(false);
      }
    },
    [selectedPlanId, planDetail, plans, loadDetail, loadList, resolveActiveAssignment],
  );

  const logMeal = useCallback(
    async (meal) => {
      if (!(await requireAuth('Please login to track meals'))) return false;
      if (!isDietPlanStarted(planDetail)) {
        showSuccessToast('Start the plan before logging meals', 'error');
        return false;
      }
      try {
        setLoggingMealId(meal.id);
        const markingDone = meal.status !== 'done';
        const completedAt = markingDone ? nowIso() : null;
        const res = await updateDietPlanProgress({
          day: meal.dayKey,
          meal: meal.mealKey,
          status: markingDone ? 'completed' : 'pending',
          completed_at: completedAt,
        });
        if (res?.success === false) {
          if (isNoActiveDietPlanError(res)) {
            await loadList();
            if (selectedPlanId) await loadDetail(selectedPlanId);
            showSuccessToast('This diet plan is not active. Resume or start it to track meals.', 'error');
            return false;
          }
          showSuccessToast(res?.message || 'Unable to update progress', 'error');
          return false;
        }
        const day = String(meal.dayKey).toLowerCase();
        const mealKey = String(meal.mealKey).toLowerCase();
        const filtered = progress.filter(
          (p) => !(String(p.day).toLowerCase() === day && String(p.meal).toLowerCase() === mealKey),
        );
        const optimistic = markingDone
          ? [...filtered, { day, meal: mealKey, status: 'completed', completed_at: completedAt }]
          : filtered;
        setProgress(optimistic);
        const assignmentId = planDetail?.patient_diet_plan_id || null;
        const fromApi = await loadProgress(assignmentId);
        const merged =
          fromApi.progressList?.length > 0
            ? fromApi.progressList
            : normalizeProgressList(res).length > 0
              ? normalizeProgressList(res)
              : optimistic;
        setProgress(merged);
        if (planDetail) {
          const nextDetail =
            fromApi.planJson || fromApi.startedAt
              ? {
                  ...planDetail,
                  ...(fromApi.planJson ? { plan_json: fromApi.planJson } : {}),
                  ...(fromApi.startedAt ? { started_at: fromApi.startedAt } : {}),
                }
              : planDetail;
          setPlanDetail(nextDetail);
          rebuildMeals(nextDetail, merged);
        }
        showSuccessToast(markingDone ? 'Meal completed' : 'Meal unmarked', 'success');
        return true;
      } catch (e) {
        showSuccessToast(e?.message || 'Unable to update progress', 'error');
        return false;
      } finally {
        setLoggingMealId(null);
      }
    },
    [planDetail, progress, loadProgress, rebuildMeals, loadList, loadDetail, selectedPlanId],
  );

  const updateWaterIntake = useCallback(
    async (nextMl) => {
      const dayKey = currentDayKeyRef.current || currentDayKey || 'day_1';
      const goal = getWaterGoalMl(planDetail);
      const clamped = Math.max(0, Math.min(Math.round(nextMl), goal));
      const prev = getWaterIntakeForDay(planDetail, dayKey);
      if (clamped === prev) return;
      if (!(await requireAuth('Please login to log water intake'))) return;
      setUpdatingWater(true);
      setWaterMl(clamped);
      setPlanDetail((detail) =>
        detail
          ? {
              ...detail,
              daily_water_intake_progress_json: buildWaterProgressPatch(detail, dayKey, clamped),
            }
          : detail,
      );
      try {
        const res = await updateDietPlanWater({ day: dayKey, intake_ml: clamped });
        if (res?.success === false) {
          setWaterMl(prev);
          setPlanDetail((detail) =>
            detail
              ? {
                  ...detail,
                  daily_water_intake_progress_json: buildWaterProgressPatch(detail, dayKey, prev),
                }
              : detail,
          );
          showSuccessToast(extractDietApiError(res, 'Unable to update water intake'), 'error');
          return;
        }
        const prevLiters = Math.floor(prev / WATER_LITER_ML);
        const nextLiters = Math.floor(clamped / WATER_LITER_ML);
        if (nextLiters > prevLiters) {
          showSuccessToast(`${nextLiters} L complete — great job!`, 'success');
        } else if (clamped >= goal && prev < goal) {
          showSuccessToast('Daily water goal reached!', 'success');
        }
      } catch (e) {
        setWaterMl(prev);
        showSuccessToast(e?.message || 'Unable to update water intake', 'error');
      } finally {
        setUpdatingWater(false);
      }
    },
    [currentDayKey, planDetail],
  );

  const selectedSummary =
    plans.find((p) => p.id === selectedPlanId) ||
    (planDetail && String(planDetail.id) === String(selectedPlanId)
      ? mapDietPlanSummary(planDetail)
      : null);

  const isStarted = useMemo(() => {
    if (planDetail && selectedPlanId) {
      const detailPlanId = String(planDetail.id || planDetail.diet_plan_id || '');
      if (detailPlanId && detailPlanId === String(selectedPlanId)) {
        return isDietPlanStarted(planDetail);
      }
    }
    return isDietPlanStarted(planDetail) || isDietPlanStarted(selectedSummary);
  }, [planDetail, selectedSummary, selectedPlanId]);

  const patientDietPlanId =
    (planDetail && String(planDetail.id) === String(selectedPlanId)
      ? planDetail?.patient_diet_plan_id
      : null) ||
    selectedSummary?.patient_diet_plan_id ||
    null;

  const listStatus = getDietListStatus(planDetail || selectedSummary);

  const updateStatus = useCallback(
    async (action, stop_reason, patientId) => {
      const id =
        action === 'repeat'
          ? String(patientId || lastCompletedAssignmentIdRef.current || patientDietPlanId || '').trim()
          : String(patientId || patientDietPlanId || planDetail?.patient_diet_plan_id || '').trim();
      if (!id) {
        showSuccessToast(
          action === 'repeat' ? 'No completed plan found to repeat.' : 'No diet assignment found.',
          'error',
        );
        return false;
      }
      if (!(await requireAuth('Please login to update diet plan'))) return false;
      setUpdatingStatus(true);
      try {
        const payload = { action };
        if (stop_reason) payload.stop_reason = stop_reason;
        const res = await updateDietPlanStatus(id, payload);
        if (res?.success === false) {
          const errMsg = extractDietApiError(res, `Unable to ${action} plan`);
          if (isAlreadyActiveDietPlanError(errMsg)) {
            return { conflict: true, activePlan: await resolveActiveAssignment() };
          }
          showSuccessToast(errMsg, 'error');
          return false;
        }
        showSuccessToast(res?.message || `Plan ${action}d.`, 'success');
        await loadList();
        if (selectedPlanId) await loadDetail(selectedPlanId);
        return true;
      } catch (e) {
        showSuccessToast(e?.message || `Unable to ${action} plan`, 'error');
        return false;
      } finally {
        setUpdatingStatus(false);
      }
    },
    [patientDietPlanId, planDetail, loadList, loadDetail, selectedPlanId, resolveActiveAssignment],
  );

  const pauseActiveAndStart = useCallback(
    async (activeAssignmentId, catalogId, options) => {
      if (!(await requireAuth('Please login to start a diet plan'))) return false;
      setUpdatingStatus(true);
      try {
        const pauseRes = await updateDietPlanStatus(activeAssignmentId, { action: 'pause' });
        if (pauseRes?.success === false) {
          showSuccessToast(extractDietApiError(pauseRes, 'Unable to pause the active plan'), 'error');
          return false;
        }
        setUpdatingStatus(false);
        return startPlan(catalogId, options);
      } finally {
        setUpdatingStatus(false);
      }
    },
    [startPlan],
  );

  return {
    plans,
    selectedPlanId,
    selectPlan,
    clearSelection,
    selectedSummary,
    planDetail,
    meals,
    mealsByDay,
    nutrition,
    waterMl,
    updatingWater,
    currentDayKey,
    todayDayKey,
    planDays,
    showAllDays,
    selectDay,
    selectAllDays: () => setShowAllDays(true),
    isStarted,
    loadingList,
    loadingDetail,
    starting,
    refresh: loadList,
    startPlan,
    logMeal,
    updateWaterIntake,
    updateStatus,
    pausePlan: () => updateStatus('pause'),
    stopPlan: () => updateStatus('stop', 'Stopped by user'),
    repeatPlan: () => updateStatus('repeat'),
    pauseActiveAndStart,
    updatingStatus,
    patientDietPlanId,
    listStatus,
    loadingMore,
    hasMore,
    loadMore,
    loggingMealId,
    resolveActiveAssignment,
  };
}
