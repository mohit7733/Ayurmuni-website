/**
 * Diet plan helpers — list / details / plan_json meals + frontend nutrition.
 */




/** True when avg_rating > 0 (plan already has a rating). */
export const isDietPlanReviewed = (plan) => {
  if (!plan) return false;

  const avg = Number(plan.avg_rating);
  if (Number.isFinite(avg) && avg > 0) return true;

  // Optimistic / local until API returns updated avg_rating
  const my = Number(plan.my_rating);
  if (Number.isFinite(my) && my > 0) return true;

  return false;
};

/** Show "Rate this diet plan" only when avg_rating is 0 or missing. */
export const canShowDietPlanRateButton = (plan) => {
  if (!plan) return false;
  return !isDietPlanReviewed(plan);
};

/** Rating label for list/detail cards — hide when no meaningful rating yet. */
export const getDietPlanRatingLabel = (plan) => {
  if (!plan) return null;

  const avgRaw = plan.avg_rating;
  const myRaw = plan.my_rating ?? plan.patient_rating ?? plan.review?.rating;

  const avg =
    avgRaw != null && avgRaw !== '' && Number.isFinite(Number(avgRaw))
      ? Number(avgRaw)
      : null;
  const my =
    myRaw != null && myRaw !== '' && Number.isFinite(Number(myRaw))
      ? Number(myRaw)
      : null;

  const totalReviews = Number(plan.total_reviews) || 0;
  const value =
    avg != null && avg > 0
      ? avg
      : my != null && my > 0
        ? my
        : avg != null && totalReviews > 0
          ? avg
          : null;

  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};


export const getDietPlanRatingMeta = (plan) => {
  const label = getDietPlanRatingLabel(plan);
  const totalReviews = Math.max(0, Number(plan?.total_reviews) || 0);
  return {
    label,
    totalReviews,
    hasRating: label != null,
  };
};

/** Badge text — avg rating only. */
export const formatDietPlanRatingBadgeText = (plan) =>
  getDietPlanRatingLabel(plan);


/** One glass = 250 ml (4 glasses = 1 L). */
export const WATER_GLASS_ML = 250;
export const WATER_LITER_ML = 1000;
export const DEFAULT_WATER_GOAL_ML = 3000;
export const MIN_WATER_GOAL_ML = 500;
export const MAX_WATER_GOAL_ML = 5000;
export const WATER_LITER_STEP_ML = 500;

export const clampWaterGoalMl = (ml) => {
  const n = Math.round(Number(ml) || 0);
  return Math.min(MAX_WATER_GOAL_ML, Math.max(MIN_WATER_GOAL_ML, n));
};

export const mlToGlasses = (ml) =>
  Math.max(1, Math.round((Number(ml) || 0) / WATER_GLASS_ML));

export const glassesToMl = (glasses) =>
  clampWaterGoalMl(Math.round(Number(glasses) || 0) * WATER_GLASS_ML);


export const WATER_GOAL_OPTIONS = [
  { label: '1.5 L', value: 1500 },
  { label: '2 L', value: 2000 },
  { label: '2.5 L', value: 2500 },
  { label: '3 L', value: 3000, recommended: true },
  { label: '3.5 L', value: 3500 },
];

export const getWaterGlassCount = (goalMl) =>
  Math.max(1, Math.ceil((Number(goalMl) || 0) / WATER_GLASS_ML));

export const parseWaterProgressJson = (plan) => {
  const raw =
    plan?.daily_water_intake_progress_json ??
    plan?.water_intake_progress_json ??
    null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  Object.entries(raw).forEach(([key, value]) => {
    const ml = Number(value);
    if (Number.isFinite(ml) && ml >= 0) {
      out[String(key).toLowerCase()] = ml;
    }
  });
  return out;
};

export const getWaterGoalMl = (plan) => {
  const goal = Number(
    plan?.daily_water_intake_goal ??
      plan?.water_intake_goal ??
      DEFAULT_WATER_GOAL_ML,
  );
  return Number.isFinite(goal) && goal > 0 ? goal : DEFAULT_WATER_GOAL_ML;
};

export const getWaterIntakeForDay = (plan, dayKey) => {
  const progress = parseWaterProgressJson(plan);
  const key = String(dayKey || 'day_1').toLowerCase();
  if (progress[key] != null) return progress[key];
  const match = Object.entries(progress).find(
    ([k]) => k.toLowerCase() === key,
  );
  return match ? Number(match[1]) : 0;
};

export const buildWaterProgressPatch = (
  plan,
  dayKey,
  intakeMl,
) => ({
  ...parseWaterProgressJson(plan),
  [String(dayKey || 'day_1').toLowerCase()]: Math.max(0, intakeMl),
});

export const formatWaterLiters = (ml) =>
  `${((Number(ml) || 0) / 1000).toFixed(1)} L`;


const FALLBACK_MEAL_IMAGE = "";

const MEAL_ORDER = ['morning', 'breakfast', 'midday', 'lunch', 'dinner'];

const MEAL_LABELS = {
  morning: 'MORNING',
  breakfast: 'BREAKFAST',
  midday: 'MIDDAY',
  lunch: 'LUNCH',
  dinner: 'DINNER',
};

const MEAL_TIMES = {
  morning: '07:00 AM',
  breakfast: '08:30 AM',
  midday: '11:00 AM',
  lunch: '01:15 PM',
  dinner: '07:45 PM',
};

/** API may send diet as strings OR { name, notes, quantity } objects. */
export const normalizeDietFoodItem = (item) => {
  if (item == null) return null;

  if (typeof item === 'string' || typeof item === 'number') {
    const name = String(item).trim();
    if (!name) return null;
    return { name, notes: '', quantity: '', label: name };
  }

  if (typeof item === 'object') {
    const name = String(
      item.name ?? item.title ?? item.food ?? item.item ?? '',
    ).trim();
    const quantity = String(
      item.quantity ?? item.qty ?? item.amount ?? '',
    ).trim();
    const notes = String(item.notes ?? item.note ?? item.description ?? '').trim();

    const parts = [
      name,
      quantity ? `(${quantity})` : '',
      notes,
    ].filter(Boolean);
    const label = parts.join(' ').trim();
    if (!label) return null;

    return { name: name || label, notes, quantity, label };
  }

  return null;
};

export const normalizeDietFoodItems = (diet) => {
  if (!Array.isArray(diet)) return [];
  return diet
    .map(normalizeDietFoodItem)
    .filter((item) => !!item?.label);
};

const toSafeText = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object') {
    return (
      normalizeDietFoodItem(value)?.label ||
      String(value.name ?? value.title ?? value.label ?? '')
    );
  }
  return '';
};


/** Plan-level gallery: API uses diet_plan_gallery (list) and/or diet_gallery (detail). */
const getPlanGalleryArray = (item) => {
  if (Array.isArray(item?.diet_plan_gallery) && item.diet_plan_gallery.length) {
    return item.diet_plan_gallery;
  }
  if (Array.isArray(item?.diet_gallery) && item.diet_gallery.length) {
    return item.diet_gallery;
  }
  if (Array.isArray(item?.gallery) && item.gallery.length) {
    return item.gallery;
  }
  return [];
};

const galleryItemUrl = (g) =>
  String(
    g?.image_url || g?.media_url || g?.url || g?.image || '',
  ).trim();

/** Prefer cover from diet_plan_gallery / diet_gallery, else legacy fields. */
export const getDietPlanCoverUrl = (item) => {
  const gallery = getPlanGalleryArray(item);

  const cover =
    gallery.find((g) => g?.is_cover && galleryItemUrl(g)) ||
    gallery.find((g) => galleryItemUrl(g));

  const uri =
    galleryItemUrl(cover) ||
    item?.thumbnail_url ||
    item?.image_url ||
    item?.cover_image ||
    item?.banner_url ||
    (typeof item?.image === 'string' ? item.image : null) ||
    '';

  return String(uri || '').trim();
};

/** Full plan gallery for detail carousel (Detailimages-compatible). */
export const getDietPlanGallery = (item) => {
  const gallery = getPlanGalleryArray(item);

  const fromGallery = gallery
    .map((g) => {
      const url = galleryItemUrl(g);
      return {
        image_url: url,
        caption: String(g?.caption || ''),
        is_cover: Boolean(g?.is_cover),
        media_url: url,
      };
    })
    .filter((g) => !!g.image_url);

  if (fromGallery.length) {
    return [...fromGallery].sort(
      (a, b) => Number(b.is_cover) - Number(a.is_cover),
    );
  }

  const fallback = getDietPlanCoverUrl(item);
  return fallback
    ? [{ image_url: fallback, caption: '', is_cover: true, media_url: fallback }]
    : [];
};

export const resolveDietImage = (item) => getDietPlanCoverUrl(item) || '';

/** Meal-level gallery from plan_json.*.diet_gallery */
export const getMealGalleryUrl = (mealRaw) => {
  if (!mealRaw || typeof mealRaw !== 'object') return '';

  const gallery = Array.isArray(mealRaw?.diet_gallery)
    ? mealRaw.diet_gallery
    : Array.isArray(mealRaw?.gallery)
      ? mealRaw.gallery
      : [];

  const first = gallery.find((g) => galleryItemUrl(g));
  const fromGallery = galleryItemUrl(first);
  if (fromGallery) return fromGallery;

  return String(
    mealRaw?.image_url ||
      mealRaw?.thumbnail_url ||
      (typeof mealRaw?.image === 'string' ? mealRaw.image : '') ||
      '',
  ).trim();
};

export const resolveMealImage = (mealRaw) => getMealGalleryUrl(mealRaw) || '';

const isHttpUrl = (value) => /^https?:\/\//i.test(value);

const normalizeVideoUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (isHttpUrl(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  if (/^(www\.)?(youtube\.com|youtu\.be)\//i.test(raw)) {
    return `https://${raw.replace(/^https?:\/\//i, '')}`;
  }
  // bare youtu.be id / watch query sometimes arrives without host
  if (/^[\w-]{11}$/.test(raw)) {
    return `https://youtu.be/${raw}`;
  }
  return null;
};

const extractUrlsFromText = (text) => {
  const matches = String(text || '').match(
    /https?:\/\/[^\s<>"']+|www\.(?:youtube\.com|youtu\.be)\/[^\s<>"']+/gi,
  );
  if (!matches) return [];
  return matches
    .map(normalizeVideoUrl)
    .filter((url) => Boolean(url));
};

/** Collect preparation video URLs from common API field shapes. */
export const resolveMealPreparationVideos = (mealRaw) => {
  if (!mealRaw || typeof mealRaw !== 'object') return [];

  const collected = [];
  const push = (value) => {
    if (typeof value === 'string') {
      const direct = normalizeVideoUrl(value);
      if (direct && !collected.includes(direct)) {
        collected.push(direct);
      }
      extractUrlsFromText(value).forEach(url => {
        if (!collected.includes(url)) collected.push(url);
      });
      return;
    }
    if (value && typeof value === 'object') {
      const obj = value;
      push(
        obj.url ||
          obj.video_url ||
          obj.link ||
          obj.youtube_url ||
          obj.preparation_video ||
          obj.preparation_video_url,
      );
    }
  };

  const candidates = [
    mealRaw.preparation_video,
    mealRaw.preparation_video_url,
    mealRaw.preparation_videos,
    mealRaw.video_url,
    mealRaw.video_link,
    mealRaw.youtube_url,
    mealRaw.youtube_link,
    mealRaw.prep_video,
    mealRaw.prep_videos,
    mealRaw.videos,
    mealRaw.preparation_steps,
    mealRaw.diet,
  ];

  candidates.forEach(candidate => {
    if (Array.isArray(candidate)) {
      candidate.forEach(push);
    } else {
      push(candidate);
    }
  });

  return collected;
};

/**
 * Progress plan_json often omits diet_gallery — copy meal images from catalog detail.
 */
export const mergePlanJsonWithGalleries = (
  catalogJson,
  progressJson,
) => {
  if (!progressJson || typeof progressJson !== 'object') {
    return catalogJson || progressJson;
  }
  if (!catalogJson || typeof catalogJson !== 'object') {
    return progressJson;
  }

  const merged = { ...progressJson };

  Object.keys(progressJson).forEach(dayKey => {
    const pDay = progressJson[dayKey];
    const cDay = catalogJson[dayKey];
    if (!pDay || typeof pDay !== 'object' || Array.isArray(pDay) || !cDay) {
      return;
    }

    const dayMerged = { ...pDay };
    Object.keys(pDay).forEach(mealKey => {
      const pMeal = pDay[mealKey];
      const cMeal = cDay?.[mealKey];
      if (!pMeal || typeof pMeal !== 'object' || Array.isArray(pMeal)) return;
      if (!cMeal || typeof cMeal !== 'object') return;

      const hasGallery = !!getMealGalleryUrl(pMeal);
      if (!hasGallery && getMealGalleryUrl(cMeal)) {
        dayMerged[mealKey] = {
          ...pMeal,
          diet_gallery: cMeal.diet_gallery || cMeal.gallery,
        };
      }
    });
    merged[dayKey] = dayMerged;
  });

  return merged;
};

/** Flatten API error shapes like { id: ['…'] } or message: ['…'] */
export const extractDietApiError = (
  res,
  fallback = 'Something went wrong',
) => {
  const pickString = (value) => {
    if (typeof value === 'string') return value.trim();
    return '';
  };
  /** DRF validation: only arrays are field errors (avoid treating UUID `id` as message). */
  const pickFieldError = (value) => {
    if (Array.isArray(value) && value.length) return String(value[0]).trim();
    return '';
  };

  const GENERIC = new Set([
    'something went wrong',
    'network error',
    'session expired',
  ]);

  const bodies = [res?.data, res].filter(
    (b) =>
      !!b && typeof b === 'object' && !Array.isArray(b),
  );

  for (const body of bodies) {
    for (const key of ['diet_plan_id', 'id', 'non_field_errors']) {
      const msg = pickFieldError(body[key]);
      if (msg) return msg;
    }
    const detail = pickString(body.detail) || pickFieldError(body.detail);
    if (detail) return detail;
    const err = pickString(body.error) || pickFieldError(body.error);
    if (err) return err;
  }

  for (const body of bodies) {
    const msg =
      pickString(body.message) || pickFieldError(body.message);
    if (msg && !GENERIC.has(msg.toLowerCase())) return msg;
  }

  return fallback;
};

export const isDietPlanStarted = (plan) => {
  if (!plan) return false;
  const status = String(
    plan?.patient_assignment_status || plan?.status || '',
  ).toLowerCase();
  if (
    status.includes('pause') ||
    status.includes('stop') ||
    status.includes('complete') ||
    status.includes('cancel')
  ) {
    return false;
  }
  if (plan?.patient_diet_plan_id && status) {
    if (status === 'active' || status.includes('start')) return true;
  }
  return (
    status === 'active' ||
    status.includes('started') ||
    status.includes('in_progress') ||
    status.includes('ongoing')
  );
};

export const getDietRepeatCount = (plan) => {
  if (!plan) return 0;
  const raw =
    plan?.repeat_count ??
    plan?.patient_repeat_count ??
    plan?.times_repeated ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** Human label: first run vs repeat #N */
export const getDietRunLabel = (plan) => {
  const count = getDietRepeatCount(plan);
  if (count <= 0) return 'First time';
  return `Repeat #${count}`;
};

/** Next repeat cycle number after a completed run (1 = first repeat). */
export const getDietNextRepeatNumber = (plan) =>
  getDietRepeatCount(plan) + 1;

/** Completed-plan summary for repeat UI */
export const getDietRepeatSummary = (plan) => {
  const count = getDietRepeatCount(plan);
  const next = count + 1;
  if (count <= 0) {
    return 'First completion — next run will be Repeat #1';
  }
  return `Completed ${count} repeat${count === 1 ? '' : 's'} — next run will be Repeat #${next}`;
};

/** Display status for diet plan list cards */

export const getDietListStatus = (plan) => {
  // Prefer assignment status only — never treat meal/progress "completed" as plan status.
  const status = String(
    plan?.patient_assignment_status ||
      plan?.assignment_status ||
      plan?.patient_diet_status ||
      '',
  )
    .toLowerCase()
    .trim();
  // Exact tokens only (avoid matching "incomplete" / "not_completed")
  if (status === 'completed' || status === 'complete') return 'completed';
  if (status === 'paused' || status === 'pause') return 'paused';
  if (
    status === 'stopped' ||
    status === 'stop' ||
    status === 'cancelled' ||
    status === 'canceled'
  ) {
    return 'stopped';
  }
  if (
    status === 'active' ||
    status === 'started' ||
    status === 'in_progress' ||
    status === 'ongoing'
  ) {
    return 'active';
  }
  if (status.includes('pause')) return 'paused';
  if (status.startsWith('stop') || status.includes('cancel')) return 'stopped';
  if (status.startsWith('completed')) return 'completed';
  if (
    status.includes('in_progress') ||
    status.includes('ongoing') ||
    (status.includes('start') && !status.includes('not'))
  ) {
    return 'active';
  }
  // Assignment id alone without status is not enough to treat as paused —
  // that left users stuck on Resume with nothing to start.
  return 'not_started';
};

/** Backend said another diet plan is already active (cannot start/repeat yet). */
export const isAlreadyActiveDietPlanError = (resOrMessage) => {
  const msg = String(
    typeof resOrMessage === 'string'
      ? resOrMessage
      : extractDietApiError(resOrMessage, resOrMessage?.message || ''),
  )
    .toLowerCase()
    .trim();
  if (!msg) return false;
  if (msg.includes('no active')) return false;
  return (
    msg.includes('already has an active') ||
    (msg.includes('already') && msg.includes('active')) ||
    (msg.includes('active diet') && msg.includes('already')) ||
    (msg.includes('only one') && msg.includes('active'))
  );
};

export const isNoActiveDietPlanError = (res) => {
  if (!res) return false;
  const code = String(
    res?.code || res?.data?.code || res?.errors?.code || '',
  ).toLowerCase();
  if (code === 'no_active_plan') return true;
  const msg = String(res?.message || res?.data?.message || '').toLowerCase();
  if (msg.includes('no active diet') || msg.includes('not currently active')) {
    return true;
  }
  const idErr = res?.errors?.id || res?.data?.errors?.id;
  if (Array.isArray(idErr)) {
    return idErr.some((e) =>
      String(e || '')
        .toLowerCase()
        .includes('not currently active'),
    );
  }
  return res?.status === 404 && msg.includes('diet');
};

const assignmentStatusRank = (plan) => {
  const s = getDietListStatus(plan);
  if (s === 'active') return 4;
  if (s === 'paused') return 3;
  if (s === 'completed') return 2;
  if (s === 'stopped') return 1;
  return 0;
};

const assignmentStartedMs = (plan) => {
  const t = Date.parse(String(plan?.started_at || ''));
  return Number.isFinite(t) ? t : 0;
};

/**
 * Overlay patient assignment fields from suggested / assigned list onto catalog rows.
 * Never let a stale overlay (e.g. old paused) win over a fresher catalog assignment
 * (e.g. stopped after reset) for the same diet plan id.
 */
export const mergePlanAssignmentFields = (
  plans,
  assignmentPlans,
) => {
  if (!plans.length || !assignmentPlans.length) return plans;

  const byCatalogId = new Map();
  assignmentPlans.forEach(p => {
    const keys = [
      String(p.id || '').trim(),
      String(p.diet_plan_id || '').trim(),
    ].filter(Boolean);
    if (!keys.length) return;
    if (!(p.patient_diet_plan_id || p.patient_assignment_status)) return;
    keys.forEach(id => {
      const prev = byCatalogId.get(id);
      if (!prev) {
        byCatalogId.set(id, p);
        return;
      }
      const rankP = assignmentStatusRank(p);
      const rankPrev = assignmentStatusRank(prev);
      if (
        rankP > rankPrev ||
        (rankP === rankPrev && assignmentStartedMs(p) >= assignmentStartedMs(prev))
      ) {
        byCatalogId.set(id, p);
      }
    });
  });

  if (!byCatalogId.size) return plans;

  return plans.map(plan => {
    const overlay =
      byCatalogId.get(String(plan.id)) ||
      byCatalogId.get(String(plan.diet_plan_id || ''));
    if (!overlay) return plan;

    const planHasAssignment = Boolean(
      plan.patient_diet_plan_id || plan.patient_assignment_status,
    );
    if (!planHasAssignment) {
      return {
        ...plan,
        patient_diet_plan_id: overlay.patient_diet_plan_id ?? null,
        patient_assignment_status: overlay.patient_assignment_status ?? null,
        started_at: overlay.started_at ?? plan.started_at,
        ended_at: overlay.ended_at ?? plan.ended_at,
        stop_reason: overlay.stop_reason ?? plan.stop_reason,
        repeat_count: overlay.repeat_count ?? plan.repeat_count,
      };
    }

    // Both have assignment — keep the more relevant / newer one
    const preferOverlay =
      assignmentStatusRank(overlay) > assignmentStatusRank(plan) ||
      (assignmentStatusRank(overlay) === assignmentStatusRank(plan) &&
        assignmentStartedMs(overlay) > assignmentStartedMs(plan));

    const chosen = preferOverlay ? overlay : plan;
    return {
      ...plan,
      patient_diet_plan_id:
        chosen.patient_diet_plan_id ?? plan.patient_diet_plan_id,
      patient_assignment_status:
        chosen.patient_assignment_status ?? plan.patient_assignment_status,
      started_at: chosen.started_at ?? plan.started_at,
      ended_at: chosen.ended_at ?? plan.ended_at,
      stop_reason: chosen.stop_reason ?? plan.stop_reason,
      repeat_count: chosen.repeat_count ?? plan.repeat_count,
    };
  });
};

export const mapDietPlanSummary = (item) => {
  const diseases = Array.isArray(item?.health_diseases)
    ? item.health_diseases
    : [];
  const diseaseNames = diseases
    .map((d) => d?.name)
    .filter(Boolean)
    .join(', ');

  return {
    ...item,
    id: String(item?.id ?? ''),
    name: String(item?.name ?? item?.title ?? 'Diet Plan'),
    title: String(item?.name ?? item?.title ?? 'Diet Plan'),
    short_description: diseaseNames || item?.season || item?.prakriti || '',
    health_diseases: diseases,
    patient_diet_plan_id: item?.patient_diet_plan_id ?? null,
    patient_assignment_status:
      item?.patient_assignment_status ??
      item?.assignment_status ??
      item?.patient_diet_status ??
      null,
    started_at: item?.started_at ?? null,
    repeat_count:
      item?.repeat_count ??
      item?.patient_repeat_count ??
      item?.times_repeated ??
      0,
  };
};

export const normalizeDietPlanList = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) {
    return response.map(mapDietPlanSummary).filter(p => p.id);
  }

  const data = response?.data ?? response?.results ?? response;
  if (Array.isArray(data)) {
    return data.map(mapDietPlanSummary).filter(p => p.id);
  }

  if (data && typeof data === 'object') {
    const list =
      data.results ||
      data.diet_plans ||
      data.plans ||
      data.items ||
      data.all ||
      data.catalog ||
      null;
    if (Array.isArray(list)) {
      return list.map(mapDietPlanSummary).filter(p => p.id);
    }
    if (data.id || data.name) {
      return [mapDietPlanSummary(data)];
    }
  }

  const numericKeys = Object.keys(response)
    .filter(key => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b));
  if (numericKeys.length > 0) {
    return numericKeys
      .map(key => mapDietPlanSummary(response[key]))
      .filter(p => p.id);
  }

  return [];
};

export const extractDietPlanDetail = (response) => {
  if (!response) return null;
  if (response.success === false) return null;
  const data = response?.data ?? response;
  if (!data || typeof data !== 'object') return null;
  if (data.success === false && !data.plan_json && !data.name) return null;
  if (Array.isArray(data)) return data[0] ?? null;
  if (data?.diet_plan) return data.diet_plan;
  if (data?.plan) return data.plan;
  if (data?.id || data?.name || data?.plan_json) return data;
  return null;
};

const nutritionValue = (nutrition, key) => {
  const node = nutrition?.[key];
  if (node == null) return 0;
  if (typeof node === 'number') return node;
  const v = Number(node?.value ?? node);
  return Number.isFinite(v) ? v : 0;
};

export const getPlanJsonDays = (plan) => {
  const json = plan?.plan_json ?? plan?.data?.plan_json;
  if (!json || typeof json !== 'object') return [];
  // Keep original keys from plan_json (day_1, day_2, ...)
  return Object.keys(json)
    .filter(k => /^day_\d+$/i.test(k))
    .sort((a, b) => {
      const na = Number(a.replace(/\D/g, '')) || 0;
      const nb = Number(b.replace(/\D/g, '')) || 0;
      return na - nb;
    });
};

const COMPLETED_STATUSES = new Set([
  'completed',
  'complete',
  'done',
  'logged',
  'true',
  '1',
]);

const isCompletedStatus = (status) => {
  if (status === true || status === 1) return true;
  const s = String(status ?? '').toLowerCase().trim();
  return COMPLETED_STATUSES.has(s);
};

/** Day index from started_at (1-based), clamped to available plan_json days */
export const resolveCurrentDayKey = (
  plan,
  progress,
) => {
  const days = getPlanJsonDays(plan);
  if (days.length === 0) return 'day_1';

  // Walk from day_1 upward: the active day is the first day that is NOT fully
  // completed.  A user must complete a day before the next one unlocks.
  if (Array.isArray(progress) && progress.length > 0) {
    for (let i = 0; i < days.length; i++) {
      const dayKey = days[i];
      const dayMeals = progress.filter(
        p => String(p.day ?? '').toLowerCase() === dayKey.toLowerCase(),
      );
      const allDone = MEAL_ORDER.every(m =>
        dayMeals.some(
          p =>
            String(p.meal ?? '').toLowerCase() === m &&
            isCompletedStatus(p.status),
        ),
      );
      if (!allDone) return dayKey; // this day still has work to do
    }
    // All days completed — stay on the last day
    return days[days.length - 1];
  }

  // No progress at all → always start on day 1, regardless of calendar days
  return days[0];
};

const mapProgressRow = (p) => {
  if (!p || typeof p !== 'object') return null;
  const day = String(p.day ?? p.day_key ?? p.day_name ?? '')
    .toLowerCase()
    .trim();
  const meal = String(p.meal ?? p.meal_type ?? p.meal_key ?? p.slot ?? '')
    .toLowerCase()
    .trim();
  if (!day || !meal) return null;

  let status = String(p.status ?? '').toLowerCase().trim();
  if (!status && (p.completed || p.is_completed || p.is_logged || p.logged)) {
    status = 'completed';
  }
  if (!status && p.completed_at) {
    status = 'completed';
  }

  return {
    day,
    meal,
    status: status || 'pending',
    completed_at: p.completed_at ?? null,
  };
};

const parseDayMealObject = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const items = [];

  Object.keys(data).forEach(dayRaw => {
    if (!/^day_\d+$/i.test(dayRaw)) return;
    const day = dayRaw.toLowerCase();
    const meals = data[dayRaw];
    if (!meals || typeof meals !== 'object' || Array.isArray(meals)) return;

    Object.keys(meals).forEach(mealRaw => {
      const meal = mealRaw.toLowerCase();
      const val = meals[mealRaw];
      let status = '';
      let completed_at = null;

      if (typeof val === 'string' || typeof val === 'boolean' || typeof val === 'number') {
        status = String(val);
      } else if (val && typeof val === 'object') {
        status = String(val.status ?? (val.completed || val.is_completed ? 'completed' : ''));
        completed_at = val.completed_at ?? null;
        if (!status && completed_at) status = 'completed';
      }

      if (status || completed_at) {
        items.push({
          day,
          meal,
          status: status || 'completed',
          completed_at,
        });
      }
    });
  });

  return items;
};

/**
 * Parse GET /patients/diet-plans/progress/ response.
 * Completed meals live under data.progress_json:
 * { day_1: { morning: { status: "completed", completed_at }, ... }, ... }
 */
export const normalizeProgressList = (response) => {
  if (!response) return [];

  const root = response?.data ?? response;

  // Primary shape from API: data.progress_json.day_N.meal.status
  const fromProgressJson = parseDayMealObject(root?.progress_json);
  if (fromProgressJson.length) return fromProgressJson;
  const fromTopLevel = parseDayMealObject(response?.progress_json);
  if (fromTopLevel.length) return fromTopLevel;

  const pools = [
    root?.progress,
    root?.meal_progress,
    root?.items,
    root?.results,
    response?.progress,
    response?.meal_progress,
    response?.results,
    root,
    response,
  ];

  for (const pool of pools) {
    if (Array.isArray(pool)) {
      const items = pool
        .map(mapProgressRow)
        .filter(Boolean);
      if (items.length) return items;
    }
  }

  for (const pool of pools) {
    if (pool && typeof pool === 'object' && !Array.isArray(pool)) {
      const candidates = [
        parseDayMealObject(pool.progress_json),
        parseDayMealObject(pool),
        parseDayMealObject(pool.progress),
        parseDayMealObject(pool.days),
        parseDayMealObject(pool.plan_progress),
        parseDayMealObject(pool.meal_progress),
      ];
      for (const items of candidates) {
        if (items.length) return items;
      }
    }
  }

  return [];
};

/** Extra fields from progress API payload */
export const extractProgressPayload = (response) => {
  const data = response?.data ?? response;
  if (!data || typeof data !== 'object') {
    return {
      progressList: [],
      planJson: null,
      startedAt: null,
      assignmentId: null,
      dietPlanId: null,
      status: null,
    };
  }

  return {
    progressList: normalizeProgressList(response),
    planJson: data.plan_json ?? null,
    startedAt: data.started_at ?? null,
    assignmentId: data.id ? String(data.id) : null,
    dietPlanId: data.diet_plan_id ? String(data.diet_plan_id) : null,
    status: data.status ? String(data.status) : null,
  };
};

export const isMealCompleted = (
  progress,
  dayKey,
  mealKey,
) => {
  const day = String(dayKey || '').toLowerCase();
  const meal = String(mealKey || '').toLowerCase();
  return progress.some(
    p =>
      String(p.day || '').toLowerCase() === day &&
      String(p.meal || '').toLowerCase() === meal &&
      isCompletedStatus(p.status),
  );
};


/** Build day chips for plan_json + progress_json */
export const buildDietDayChips = (
  plan,
  progress = [],
  todayDayKey,
) => {
  const days = getPlanJsonDays(plan);
  const activeKey = String(todayDayKey || resolveCurrentDayKey(plan, progress)).toLowerCase();
  const activeIdx = days.findIndex(d => d.toLowerCase() === activeKey);

  return days.map((dayKey, idx) => {
    const meals = mapPlanJsonMeals(plan, dayKey, progress);
    const mealsTotal = meals.length;
    const mealsDone = meals.filter(m => m.status === 'done').length;
    const dayNumber = Number(String(dayKey).replace(/\D/g, '')) || 0;
    const isCompleted = mealsTotal > 0 && mealsDone === mealsTotal;
    // Days after the active day are locked until the active day is completed
    const isLocked = idx > activeIdx;
    return {
      dayKey,
      label: `Day ${dayNumber || dayKey}`,
      dayNumber,
      isToday: String(dayKey).toLowerCase() === activeKey,
      mealsTotal,
      mealsDone,
      progressPct:
        mealsTotal > 0 ? Math.round((mealsDone / mealsTotal) * 100) : 0,
      isCompleted,
      isLocked,
    };
  });
};

/** Map plan_json day meals into MealCard-ready list */
export const mapPlanJsonMeals = (
  plan,
  dayKey,
  progress = [],
) => {
  const planJson = plan?.plan_json || {};
  const resolvedDayKey =
    Object.keys(planJson).find(
      k => k.toLowerCase() === String(dayKey || '').toLowerCase(),
    ) || dayKey;
  const dayData = planJson?.[resolvedDayKey];
  if (!dayData || typeof dayData !== 'object') return [];

  const mealKeys = [
    ...MEAL_ORDER.filter(k => dayData[k]),
    ...Object.keys(dayData).filter(
      k => !MEAL_ORDER.includes(k) && dayData[k]?.diet,
    ),
  ];

  return mealKeys.map(mealKey => {
    const raw = dayData[mealKey] || {};
    const dietItemDetails = normalizeDietFoodItems(raw.diet);
    const dietItems = dietItemDetails.map(item => item.label);
    const steps = Array.isArray(raw.preparation_steps)
      ? raw.preparation_steps.map(toSafeText).filter(Boolean)
      : [];
    const preparationVideos = resolveMealPreparationVideos(raw);
    const nutrition = raw.nutrition || {};
    const kcal = nutritionValue(nutrition, 'total_calories');
    const carbs = nutritionValue(nutrition, 'carbs');
    const protein = nutritionValue(nutrition, 'protein');
    const fat = nutritionValue(nutrition, 'fat');
    const done = isMealCompleted(progress, dayKey, mealKey);
    const mealImage = resolveMealImage(raw);

    return {
      id: `${dayKey}-${mealKey}`,
      dayKey,
      mealKey,
      type: MEAL_LABELS[mealKey] || mealKey.toUpperCase(),
      time: MEAL_TIMES[mealKey] || '',
      title:
        dietItemDetails[0]?.name ||
        dietItems[0] ||
        MEAL_LABELS[mealKey] ||
        mealKey,
      subtitle:
        dietItemDetails
          .slice(1)
          .map(d => d.name)
          .filter(Boolean)
          .join(' · ') ||
        dietItems.slice(1).join(' · ') ||
        steps[0] ||
        '',
      kcal,
      carbs,
      protein,
      fat,
      dietItems,
      dietItemDetails,
      preparationSteps: steps,
      preparationVideos,
      image: mealImage,
      status: done ? 'done' : 'log',
      raw,
    };
  });
};

/** Day goal = sum of all meal calories for that day */
export const calculateDayGoalKcal = (plan, dayKey) => {
  const meals = mapPlanJsonMeals(plan, dayKey, []);
  const total = meals.reduce((sum, m) => sum + (m.kcal || 0), 0);
  return total > 0 ? total : 2200;
};

export const calculateDietNutrition = (
  meals,
  plan,
  dayKey,
  extras,
) => {
  const logged = meals.filter(m => m.status === 'done');
  const eatenKcal = logged.reduce((sum, m) => sum + (Number(m.kcal) || 0), 0);
  const carbsG = logged.reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
  const proteinG = logged.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
  const fatG = logged.reduce((sum, m) => sum + (Number(m.fat) || 0), 0);

  const goalKcal =
    (dayKey && plan ? calculateDayGoalKcal(plan, dayKey) : 0) ||
    meals.reduce((sum, m) => sum + (m.kcal || 0), 0) ||
    2200;

  const burnedKcal = Number(extras?.burnedKcal ?? 0);
  const waterMl = Number(extras?.waterMl ?? 0);
  const waterGoalMl = plan ? getWaterGoalMl(plan) : DEFAULT_WATER_GOAL_ML;

  const macroTotal = carbsG * 4 + proteinG * 4 + fatG * 9;
  const carbsPct =
    macroTotal > 0 ? Math.round(((carbsG * 4) / macroTotal) * 100) : 0;
  const proteinPct =
    macroTotal > 0 ? Math.round(((proteinG * 4) / macroTotal) * 100) : 0;
  const fatPct =
    macroTotal > 0 ? Math.round(((fatG * 9) / macroTotal) * 100) : 0;

  const mealsDone = logged.length;
  const mealsTotal = meals.length;

  return {
    goalKcal,
    eatenKcal,
    burnedKcal,
    leftKcal: Math.max(0, goalKcal - eatenKcal + burnedKcal),
    carbsPct,
    proteinPct,
    fatPct,
    carbsG,
    proteinG,
    fatG,
    waterMl,
    waterGoalMl,
    mealsDone,
    mealsTotal,
    mealProgressPct:
      mealsTotal > 0 ? Math.round((mealsDone / mealsTotal) * 100) : 0,
  };
};

/** ISO timestamp without ms — e.g. 2026-07-15T07:15:00Z */
export const nowIso = () =>
  new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
