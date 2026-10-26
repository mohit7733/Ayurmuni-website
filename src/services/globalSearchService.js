/** Port of the app's services/GlobalSearchService.ts (same endpoints, params and parsing). */
import { apiClient } from "./apiClient";

import { formatRupee } from "../home/catalog";

/** Same as the app's utils/imageUtils resolveImageUri + sanitizeImageUri. */
const resolveImageUri = (image) => {
  if (!image) return "";
  const raw = typeof image === "string" ? image : typeof image === "object" && image.uri != null ? String(image.uri) : "";
  const value = raw.trim();
  const lower = value.toLowerCase();
  if (!value || lower.includes("example.com") || lower.includes("placeholder") || lower.includes("picsum.photos") || lower.endsWith("/null") || lower === "null" || lower === "undefined") return "";
  return value;
};
const DEFAULT_SEARCH_TYPES = "products,medicines,brands,doctors,yoga_sessions,diet_plans";
const emptyGrouped = () => ({
  products: [],
  medicines: [],
  doctors: [],
  brands: [],
  categories: [],
  banners: [],
  yoga_sessions: [],
  diet_plans: [],
  other: []
});
const sectionResults = (root, key) => {
  if (!root || typeof root !== "object") return [];
  const block = root[key];
  if (Array.isArray(block)) return block.filter(Boolean);
  if (block && typeof block === "object") {
    if (Array.isArray(block.results)) return block.results.filter(Boolean);
    if (Array.isArray(block.items)) return block.items.filter(Boolean);
    if (Array.isArray(block.data)) return block.data.filter(Boolean);
  }
  return [];
};
const sectionHasMore = (root, key) => {
  const block = root?.[key];
  return Boolean(block && typeof block === "object" && block.has_more === true);
};
const mapApiType = (raw) => {
  const t = String(raw || "").trim().toLowerCase();
  if (!t) return null;
  if (t === "products" || t === "product") return "product";
  if (t === "medicines" || t === "medicine") return "medicine";
  if (t === "doctors" || t === "doctor") return "doctor";
  if (t === "brands" || t === "brand") return "brand";
  if (t === "yoga_sessions" || t === "yoga_session" || t === "yoga") {
    return "yoga_session";
  }
  if (t === "diet_plans" || t === "diet_plan" || t === "diets") {
    return "diet_plan";
  }
  if (t.includes("categor")) return "category";
  if (t.includes("banner")) return "banner";
  return null;
};
const detectType = (item, fallback = "other") => {
  const fromField = mapApiType(
    item?.type || item?.entity_type || item?.result_type || ""
  );
  if (fromField) return fromField;
  if (item?.variant_id || item?.product_id || item?.product_name) {
    return "product";
  }
  if (item?.doctor_id || item?.full_name || item?.specialization) {
    return "doctor";
  }
  if (item?.yoga_session_id || item?.session_name) return "yoga_session";
  if (item?.diet_plan_id || item?.plan_name) return "diet_plan";
  if (item?.brand_id || item?.brand_name) return "brand";
  return fallback;
};
const formatPrice = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return formatRupee(n, {
    decimals: n % 1 === 0 ? false : 2
  });
};
const pickTitle = (item, type) => {
  const byType = type === "product" || type === "medicine" ? [item?.product_name, item?.variant_title, item?.name, item?.title] : type === "doctor" ? [item?.full_name, item?.doctor_name, item?.name, item?.title] : type === "brand" ? [item?.brand_name, item?.name, item?.title] : type === "yoga_session" ? [item?.session_name, item?.name, item?.title] : type === "diet_plan" ? [item?.plan_name, item?.name, item?.title] : [
    item?.name,
    item?.title,
    item?.product_name,
    item?.variant_title,
    item?.full_name,
    item?.brand_name
  ];
  for (const c of byType) {
    if (c != null && String(c).trim()) return String(c).trim();
  }
  return "";
};
const pickSubtitle = (item, type) => {
  if (type === "doctor") {
    return String(
      item?.specialization || item?.speciality || item?.experience_years || item?.experience || ""
    ).trim() || "Ayurveda doctor";
  }
  if (type === "product" || type === "medicine") {
    const parts = [
      item?.brand_name ? String(item.brand_name) : "",
      item?.selling_price != null || item?.mrp != null ? formatPrice(item?.selling_price ?? item?.mrp) : "",
      item?.out_of_stock ? "Out of stock" : ""
    ].filter(Boolean);
    return parts.join(" \xB7 ");
  }
  if (type === "brand") return "Brand";
  if (type === "yoga_session") {
    return String(
      item?.duration || item?.level || item?.instructor || "Yoga"
    ).trim();
  }
  if (type === "diet_plan") {
    const diseases = Array.isArray(item?.health_diseases) ? item.health_diseases.map((d) => d?.name).filter(Boolean).slice(0, 2).join(", ") : "";
    return [
      item?.prakriti,
      diseases,
      item?.total_days != null ? `${item.total_days} days` : "",
      item?.is_paid === false || Number(item?.price) === 0 ? "Free" : ""
    ].filter(Boolean).join(" \xB7 ") || "Diet plan";
  }
  return String(item?.description || item?.subtitle || "").trim();
};
const pickImage = (item) => {
  const gallery = Array.isArray(item?.diet_plan_gallery) ? item.diet_plan_gallery : [];
  const cover = gallery.find((g) => g?.is_cover) || gallery[0] || null;
  return resolveImageUri(
    cover?.image_url || item?.image_url || item?.image || item?.profile_image || item?.logo || item?.banner_image || item?.thumbnail || item?.thumbnail_url || item?.cover_image
  );
};
const unwrapHitPayload = (item) => {
  if (!item || typeof item !== "object") return item;
  if (item.data && typeof item.data === "object" && !Array.isArray(item.data)) {
    return {
      ...item.data,
      type: item.type || item.data.type,
      relevance_score: item.score ?? item.data.relevance_score
    };
  }
  return item;
};
const normalizeSearchHit = (item, fallbackType, _index) => {
  const payload = unwrapHitPayload(item);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  if ((payload.results || payload.has_more != null || payload.returned != null) && !payload.variant_id && !payload.product_id && !payload.brand_id && !payload.name && !payload.product_name) {
    return null;
  }
  const type = detectType(payload, fallbackType);
  const title = pickTitle(payload, type);
  if (!title) return null;
  const idRaw = payload?.variant_id ?? payload?.product_id ?? payload?.id ?? payload?.uuid ?? payload?.doctor_id ?? payload?.brand_id ?? payload?.brand_name_id ?? payload?.yoga_session_id ?? payload?.session_id ?? payload?.diet_plan_id ?? payload?.plan_id;
  if (idRaw == null || String(idRaw).trim() === "") return null;
  return {
    id: String(idRaw).trim(),
    type,
    title,
    subtitle: pickSubtitle(payload, type),
    image: pickImage(payload) || void 0,
    raw: payload
  };
};
const pushHits = (grouped, list, fallbackType, seen) => {
  list.forEach((item, index) => {
    const hit = normalizeSearchHit(item, fallbackType, index);
    if (!hit) return;
    const key = `${hit.type}:${hit.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    switch (hit.type) {
      case "medicine":
        grouped.medicines.push(hit);
        break;
      case "product":
        grouped.products.push(hit);
        break;
      case "doctor":
        grouped.doctors.push(hit);
        break;
      case "brand":
        grouped.brands.push(hit);
        break;
      case "category":
        grouped.categories.push(hit);
        break;
      case "banner":
        grouped.banners.push(hit);
        break;
      case "yoga_session":
        grouped.yoga_sessions.push(hit);
        break;
      case "diet_plan":
        grouped.diet_plans.push(hit);
        break;
      default:
        grouped.other.push(hit);
    }
  });
};
const parseGlobalSearchResponse = (response) => {
  const grouped = emptyGrouped();
  const seen = /* @__PURE__ */ new Set();
  const root = response?.data ?? response ?? {};
  pushHits(grouped, sectionResults(root, "products"), "product", seen);
  pushHits(grouped, sectionResults(root, "medicines"), "medicine", seen);
  pushHits(grouped, sectionResults(root, "doctors"), "doctor", seen);
  pushHits(grouped, sectionResults(root, "brands"), "brand", seen);
  pushHits(grouped, sectionResults(root, "yoga_sessions"), "yoga_session", seen);
  pushHits(grouped, sectionResults(root, "diet_plans"), "diet_plan", seen);
  pushHits(grouped, sectionResults(root, "categories"), "category", seen);
  pushHits(grouped, sectionResults(root, "banners"), "banner", seen);
  const top = Array.isArray(root?.top) ? root.top : [];
  if (top.length) {
    pushHits(grouped, top, "other", seen);
  }
  return grouped;
};
const countGlobalSearchHits = (grouped) => grouped.products.length + grouped.medicines.length + grouped.doctors.length + grouped.brands.length + grouped.categories.length + grouped.banners.length + grouped.yoga_sessions.length + grouped.diet_plans.length + grouped.other.length;
const mergeGlobalSearchGroups = (base, next) => {
  const merge = (a, b) => {
    const seen = new Set(a.map((h) => `${h.type}:${h.id}`));
    const out = [...a];
    b.forEach((h) => {
      const key = `${h.type}:${h.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(h);
      }
    });
    return out;
  };
  return {
    products: merge(base.products, next.products),
    medicines: merge(base.medicines, next.medicines),
    doctors: merge(base.doctors, next.doctors),
    brands: merge(base.brands, next.brands),
    categories: merge(base.categories, next.categories),
    banners: merge(base.banners, next.banners),
    yoga_sessions: merge(base.yoga_sessions, next.yoga_sessions),
    diet_plans: merge(base.diet_plans, next.diet_plans),
    other: merge(base.other, next.other)
  };
};
const anySearchSectionHasMore = (response) => {
  const root = response?.data ?? response ?? {};
  return sectionHasMore(root, "products") || sectionHasMore(root, "medicines") || sectionHasMore(root, "doctors") || sectionHasMore(root, "brands") || sectionHasMore(root, "yoga_sessions") || sectionHasMore(root, "diet_plans") || sectionHasMore(root, "categories") || sectionHasMore(root, "banners");
};
const globalSearch = async (params) => {
  const opts = typeof params === "string" ? { search: params } : params;
  const search = String(opts.search || "").trim();
  if (!search) {
    return { grouped: emptyGrouped(), raw: null, hasMore: false };
  }
  const qs = new URLSearchParams();
  qs.set("search", search);
  qs.set("types", opts.types || DEFAULT_SEARCH_TYPES);
  qs.set(
    "include_top",
    String(opts.include_top !== void 0 ? opts.include_top : true)
  );
  qs.set(
    "exact_count",
    String(opts.exact_count !== void 0 ? opts.exact_count : false)
  );
  qs.set(
    "save_recent",
    String(opts.save_recent !== void 0 ? opts.save_recent : false)
  );
  qs.set("page", String(opts.page || 1));
  qs.set("page_size", String(opts.page_size || 10));
  const response = await apiClient(`customers/search/?${qs.toString()}`, {
    method: "GET"
  });
  const grouped = parseGlobalSearchResponse(response);
  const hasMore = anySearchSectionHasMore(response);
  return { grouped, raw: response, hasMore };
};
const normalizeRecentItem = (raw, index) => {
  if (typeof raw === "string") {
    const query2 = raw.trim();
    if (!query2) return null;
    return {
      id: `q-${index}-${query2}`,
      query: query2,
      types: null,
      search_type: null,
      search_count: null,
      created_at: null,
      last_searched_at: null,
      last_variant_id: null,
      raw
    };
  }
  if (!raw || typeof raw !== "object") return null;
  const query = String(
    raw.query || raw.search || raw.term || raw.keyword || raw.search_query || raw.search_term || raw.search_text || raw.text || raw.name || raw.title || ""
  ).trim();
  if (!query) return null;
  const id = String(
    raw.id || raw.uuid || raw.recent_search_id || `q-${index}-${query}`
  );
  return {
    id,
    query,
    types: raw.types || raw.search_types || null,
    search_type: raw.search_type || null,
    search_count: raw.search_count ?? null,
    created_at: raw.created_at || null,
    last_searched_at: raw.last_searched_at || raw.searched_at || null,
    last_variant_id: raw.last_variant_id || null,
    raw
  };
};
const extractRecentList = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  const candidates = [
    response?.data?.results,
    response?.data?.recent_searches,
    response?.data?.search_history,
    response?.data?.history,
    response?.data?.searches,
    response?.data?.items,
    response?.data?.recent,
    response?.data?.data,
    response?.results,
    response?.recent_searches,
    response?.search_history,
    response?.history,
    response?.searches,
    response?.items,
    response?.recent,
    response?.data
  ];
  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }
  const numericKeys = Object.keys(response).filter((key) => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b));
  if (numericKeys.length > 0) {
    return numericKeys.map((key) => response[key]).filter(Boolean);
  }
  return [];
};
const getRecentSearches = async (limit = 10) => {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit > 0 ? limit : 10));
  const response = await apiClient(`customers/search/recent/?${qs.toString()}`, {
    method: "GET"
  });
  if (response?.success === false) {

    return [];
  }
  return extractRecentList(response).map((item, index) => normalizeRecentItem(item, index)).filter(Boolean);
};
const deleteRecentSearches = async (opts) => {
  const qs = new URLSearchParams();
  const id = String(opts?.id || "").trim();
  const query = String(opts?.query || "").trim();
  if (id) qs.set("id", id);
  else if (query) qs.set("query", query);
  const endpoint = qs.toString() ? `customers/search/recent/?${qs.toString()}` : "customers/search/recent/";
  const response = await apiClient(endpoint, {
    method: "DELETE"
  });
  if (response?.success === false) {
    throw new Error(response?.message || "Unable to delete recent search");
  }
  return response;
};
const clearAllRecentSearches = async () => deleteRecentSearches();
const deleteRecentSearchById = async (id) => deleteRecentSearches({ id });
const deleteRecentSearchByQuery = async (query) => deleteRecentSearches({ query });
const getRecentSearchResults = async (recentSearchId) => {
  const id = String(recentSearchId || "").trim();
  if (!id) {
    return {
      grouped: emptyGrouped(),
      query: "",
      hasMore: false,
      raw: null,
      recent_search_id: ""
    };
  }
  const response = await apiClient(
    `customers/search/recent/?id=${encodeURIComponent(id)}`,
    { method: "GET" }
  );
  if (response?.success === false) {
    throw new Error(
      response?.message || "Unable to load recent search results"
    );
  }
  const root = response?.data ?? response ?? {};
  const grouped = parseGlobalSearchResponse(response);
  const query = String(
    root.search || root.query || response?.search || ""
  ).trim();
  return {
    grouped,
    query,
    hasMore: anySearchSectionHasMore(response),
    raw: response,
    recent_search_id: String(root.recent_search_id || id)
  };
};
const getRecentSearchById = async (id) => {
  const res = await getRecentSearchResults(id);
  if (!res.query && countGlobalSearchHits(res.grouped) === 0) return null;
  return {
    id: res.recent_search_id || id,
    query: res.query,
    types: null,
    raw: res.raw
  };
};
export {
  DEFAULT_SEARCH_TYPES,
  anySearchSectionHasMore,
  clearAllRecentSearches,
  countGlobalSearchHits,
  deleteRecentSearchById,
  deleteRecentSearchByQuery,
  deleteRecentSearches,
  emptyGrouped,
  getRecentSearchById,
  getRecentSearchResults,
  getRecentSearches,
  globalSearch,
  mergeGlobalSearchGroups,
  normalizeSearchHit,
  parseGlobalSearchResponse
};
