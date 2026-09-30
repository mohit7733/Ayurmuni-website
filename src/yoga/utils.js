export const resolveYogaVideoUri = (item) => {
  if (!item || typeof item !== 'object') return null;
  const candidates = [
    item.video_url,
    item.session_video,
    item.session_video_url,
    item.preview_video,
    item.preview_video_url,
    item.media_url,
    item.video,
    item.file_url,
    item.file,
    item.hls_url,
    item.stream_url,
    item.media?.video_url,
    item.media?.url,
    item.media?.file,
    item.session?.video_url,
    item.session?.media_url,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

export const resolveYogaThumbnailUri = (item) => {
  if (!item || typeof item !== 'object') return '';
  const candidates = [
    item.thumbnail_url,
    item.thumbnail,
    item.cover_image,
    item.image_url,
    item.image,
    item.poster_url,
    item.banner_url,
    item.media?.thumbnail_url,
    item.media?.image_url,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export const mapYogaSessionForList = (item) => {
  if (!item || typeof item !== 'object') return null;
  const id = item.id ?? item.session_id;
  if (id == null) return null;
  const video_url = resolveYogaVideoUri(item);
  const thumbnail_url = resolveYogaThumbnailUri(item);
  return {
    ...item,
    id: String(id),
    type: 'yoga',
    title: String(item.title ?? item.name ?? 'Yoga Session'),
    name: String(item.name ?? item.title ?? 'Yoga Session'),
    short_description:
      item.short_description ||
      item.description ||
      item.difficulty ||
      item.duration ||
      '',
    difficulty: item.difficulty ?? item.level ?? '',
    duration:
      item.duration ||
      (Number(item.duration_minutes) > 0 ? `${item.duration_minutes} min` : ''),
    thumbnail_url,
    video_url: video_url || item.video_url,
  };
};

export const parseTimeToSeconds = (value) => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  const raw = String(value).trim();
  if (!raw) return 0;
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.max(0, Number(raw));
  const parts = raw.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
};

export const formatYogaTime = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
};

const toBreakdownItem = (raw, index) => {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const title = raw.trim();
    if (!title) return null;
    return {
      id: `pose-${index}`,
      title,
      time: formatYogaTime(0),
      startSeconds: 0,
    };
  }
  const title = String(
    raw.title ?? raw.name ?? raw.pose ?? raw.asana ?? raw.label ?? '',
  ).trim();
  if (!title) return null;
  const startSeconds = parseTimeToSeconds(
    raw.start_seconds ??
      raw.start_time ??
      raw.timestamp ??
      raw.time_seconds ??
      raw.time ??
      raw.offset ??
      0,
  );
  return {
    id: String(raw.id ?? `pose-${index}`),
    title,
    time: formatYogaTime(startSeconds),
    startSeconds,
  };
};

export const getYogaSessionBreakdown = (item) => {
  if (!item || typeof item !== 'object') return [];
  const candidates = [
    item.session_breakdown,
    item.breakdown,
    item.poses,
    item.yoga_poses,
    item.asanas,
    item.steps,
    item.segments,
    item.chapters,
    item.sequence,
    item.timeline,
    item.sections,
  ];
  for (const list of candidates) {
    if (!Array.isArray(list) || !list.length) continue;
    const mapped = list.map((row, i) => toBreakdownItem(row, i)).filter(Boolean);
    if (mapped.length) return mapped;
  }
  return [];
};

export const getYogaInstructor = (item) => {
  const src =
    item?.instructor ||
    item?.mentor ||
    item?.teacher ||
    item?.guided_by ||
    item?.coach ||
    null;
  if (!src) return null;
  if (typeof src === 'string') {
    return { name: src, subtitle: '', description: '', imageUri: '' };
  }
  return {
    name: String(src.full_name || src.name || 'Yoga Mentor'),
    subtitle: String(src.designation || src.specialization || src.title || ''),
    description: String(src.bio || src.description || ''),
    imageUri: String(src.profile_image || src.image_url || src.image || ''),
  };
};

export const normalizeYogaSessionList = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) {
    return response.map(mapYogaSessionForList).filter(Boolean);
  }
  const data = response?.data ?? response?.results ?? response;
  if (Array.isArray(data)) {
    return data.map(mapYogaSessionForList).filter(Boolean);
  }
  if (data && typeof data === 'object') {
    const list =
      data.results || data.sessions || data.yoga_sessions || data.items || null;
    if (Array.isArray(list)) {
      return list.map(mapYogaSessionForList).filter(Boolean);
    }
    if (data.id || data.title || data.name) {
      const mapped = mapYogaSessionForList(data);
      return mapped ? [mapped] : [];
    }
  }
  return [];
};

export const itemMatchesHealthConcern = (item, opts = {}) => {
  if (!item) return false;
  const categoryId = String(opts.healthCategoryId || '').trim();
  const diseaseId = String(opts.healthDiseaseId || '').trim();
  const categoryName = String(opts.categoryName || '')
    .trim()
    .toLowerCase();
  const diseaseName = String(opts.diseaseName || '')
    .trim()
    .toLowerCase();

  if (!categoryId && !diseaseId && !categoryName && !diseaseName) return true;

  const ids = new Set();
  const names = new Set();
  const pushId = (value) => {
    const id = String(value ?? '').trim();
    if (id) ids.add(id);
  };
  const pushName = (value) => {
    const name = String(value ?? '')
      .trim()
      .toLowerCase();
    if (name) names.add(name);
  };

  pushId(item?.health_category_id);
  pushId(item?.health_disease_id);
  pushId(item?.category_id);
  pushId(item?.disease_id);
  pushName(item?.health_category_name);
  pushName(item?.category_name);
  pushName(item?.disease_name);
  pushName(item?.health_disease_name);

  const collect = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((entry) => {
      if (typeof entry === 'string' || typeof entry === 'number') {
        pushId(entry);
        pushName(entry);
        return;
      }
      pushId(entry?.id);
      pushId(entry?.health_category_id);
      pushId(entry?.health_disease_id);
      pushName(entry?.name);
      pushName(entry?.title);
    });
  };

  collect(item?.health_categories);
  collect(item?.health_category);
  collect(item?.categories);
  collect(item?.health_diseases);
  collect(item?.diseases);
  collect(item?.tags);

  if (diseaseId && ids.has(diseaseId)) return true;
  if (categoryId && ids.has(categoryId)) return true;
  if (diseaseName && [...names].some((n) => n.includes(diseaseName) || diseaseName.includes(n))) {
    return true;
  }
  if (categoryName && [...names].some((n) => n.includes(categoryName) || categoryName.includes(n))) {
    return true;
  }

  const hasHealthMeta =
    ids.size > 0 ||
    names.size > 0 ||
    item?.health_category_id != null ||
    item?.health_disease_id != null ||
    Array.isArray(item?.health_diseases) ||
    Array.isArray(item?.health_categories);
  return !hasHealthMeta;
};

export const matchesYogaSearch = (keyword, item) => {
  const q = String(keyword || '')
    .trim()
    .toLowerCase();
  if (!q) return true;
  return [item?.title, item?.name, item?.short_description, item?.difficulty, item?.duration].some(
    (field) => String(field || '').toLowerCase().includes(q),
  );
};
