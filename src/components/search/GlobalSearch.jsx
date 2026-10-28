import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../AppShell';
import RecentSearchList from './RecentSearchList';
import ProductCard from '../ProductCard';
import { PremiumSearch } from '../ui';
import AdvanceLoad from '../ui/AdvanceLoad';
import useCategoryProducts from '../../hooks/useCategoryProducts';
import { useGlobalSearch, useRecentSearches } from '../../hooks/useServerSearch';
import {
  countGlobalSearchHits,
  emptyGrouped,
  getRecentSearchResults,
} from '../../services/globalSearchService';
import { invalidateRecentSearchQueries } from '../../hooks/useRecentSearchQueries';
import '../../design/global-search.css';

/** Same sections and order as the app's ProductSearchScreen SECTION_META. */
const SECTION_META = [
  { key: 'products', title: 'Products' },
  { key: 'medicines', title: 'Ayurveda Medicines' },
  { key: 'brands', title: 'Brands' },
  { key: 'doctors', title: 'Doctors' },
  { key: 'yoga_sessions', title: 'Yoga Sessions' },
  { key: 'diet_plans', title: 'Diet Plans' },
];

const DEBOUNCE_MS = 350; // app: 350ms debounce before live search

/**
 * Port of the app's ProductSearchScreen: idle browse + recent chips, live grouped search,
 * recent-chip results via customers/search/recent/?id=. Only a clicked hit is saved to recent.
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') || '');
  const [query, setQuery] = useState(text.trim());
  const [source, setSource] = useState(text.trim() ? 'live' : 'idle');
  const [recentOverride, setRecentOverride] = useState(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState(null);
  const [activeRecentId, setActiveRecentId] = useState(null);
  const [clearing, setClearing] = useState(false);
  const recentReq = useRef(0);
  const appliedRecent = useRef('');

  useEffect(() => {
    if (source !== 'live') return undefined;
    const t = window.setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [text, source]);

  useEffect(() => {
    const q = query.trim();
    const next = new URLSearchParams(params);
    if (q) next.set('q', q);
    else next.delete('q');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useGlobalSearch(query, source === 'live' && !!query);
  const recent = useRecentSearches(true);
  const browse = useCategoryProducts({}, [], { enabled: source === 'idle' });

  const results = source === 'recent' && recentOverride ? recentOverride : live.results;
  const isSearching = source !== 'idle' && !!text.trim();
  const busy = source === 'recent' ? recentLoading : live.loading || (source === 'live' && text.trim() !== query);

  const onChange = useCallback((value) => {
    recentReq.current += 1;
    appliedRecent.current = '';
    setText(value);
    setRecentOverride(null);
    setActiveRecentId(null);
    setRecentLoading(false);
    setSource(value.trim() ? 'live' : 'idle');
    if (!value.trim()) setQuery('');
    if (params.get('recent')) {
      const next = new URLSearchParams(params);
      next.delete('recent');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  // Keyboard submit only runs the search; it does not save recent (app behaviour).
  const onSubmit = useCallback(() => {
    const q = text.trim();
    if (!q) return;
    setSource('live');
    setQuery(q);
  }, [text]);

  const applyRecent = useCallback(async (item) => {
    const reqId = ++recentReq.current;
    const chipQuery = String(item.query || '').trim();
    setSource('recent');
    setActiveRecentId(item.id);
    setRecentOverride(null);
    setRecentError(null);
    setRecentLoading(true);
    setText(chipQuery);
    try {
      const res = await getRecentSearchResults(item.id);
      if (reqId !== recentReq.current) return;
      const nextQuery = (res.query || chipQuery).trim();
      if (nextQuery) setText(nextQuery);
      const grouped = res.grouped || emptyGrouped();
      if (countGlobalSearchHits(grouped) === 0 && nextQuery) {
        setActiveRecentId(null);
        setSource('live');
        setQuery(nextQuery);
        return;
      }
      setRecentOverride(grouped);
    } catch (e) {
      if (reqId !== recentReq.current) return;
      setRecentError(e?.message || 'Unable to load recent search');
      setActiveRecentId(null);
      setSource(chipQuery ? 'live' : 'idle');
      setQuery(chipQuery);
    } finally {
      if (reqId === recentReq.current) setRecentLoading(false);
    }
  }, []);

  const recentParam = params.get('recent') || '';
  useEffect(() => {
    if (!recentParam || appliedRecent.current === recentParam) return undefined;
    appliedRecent.current = recentParam;
    applyRecent({ id: recentParam, query: params.get('q') || '' });
    return undefined;
  }, [recentParam, applyRecent, params]);

  const onClearRecent = useCallback(async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await recent.clearAll();
      invalidateRecentSearchQueries();
    } catch (e) {
      setRecentError(e?.message || 'Unable to clear recent searches');
      recent.refresh();
    } finally {
      setClearing(false);
    }
  }, [clearing, recent]);

  const onRemoveRecent = useCallback(
    async (item) => {
      try {
        await recent.removeOne({ id: item.id, query: item.query });
        invalidateRecentSearchQueries();
      } catch (e) {
        setRecentError(e?.message || 'Unable to remove recent search');
      }
    },
    [recent],
  );

  const openHit = useCallback(
    (hit) => {
      const clicked = String(hit.title || '').trim() || text.trim();
      if (clicked) live.commitRecentSearch(clicked).then(() => {
        invalidateRecentSearchQueries();
        recent.refresh();
      });
      const raw = hit.raw || {};
      switch (hit.type) {
        case 'product':
        case 'medicine': {
          const id = raw.variant_id ?? raw.product_id ?? raw.id ?? hit.id;
          if (id) navigate(`/products/${id}`, { state: { item: raw } });
          break;
        }
        case 'doctor': {
          const id = raw.id ?? raw.doctor_id ?? hit.id;
          if (id) navigate(`/consult/doctors/${id}`, { state: { doctor: { ...raw, id } } });
          break;
        }
        case 'brand': {
          const id = String(raw.brand_id ?? raw.brand_name_id ?? raw.id ?? hit.id);
          navigate(`/products/category?mode=product&brand=${encodeURIComponent(id)}&name=${encodeURIComponent(hit.title)}`);
          break;
        }
        case 'category': {
          const id = String(raw.id ?? raw.category_id ?? raw.product_category_id ?? hit.id);
          const mode = raw.health_category_id ? 'health' : 'product';
          navigate(`/products/category?mode=${mode}&category=${encodeURIComponent(id)}&name=${encodeURIComponent(hit.title)}`);
          break;
        }
        case 'yoga_session': {
          const id = raw.id ?? raw.yoga_session_id ?? hit.id;
          if (id) navigate(`/yoga/${id}`, { state: { item: raw } });
          break;
        }
        case 'diet_plan': {
          const planId = String(raw.id ?? raw.diet_plan_id ?? hit.id ?? '').trim();
          if (planId) navigate(`/diet/${planId}`, { state: { item: { ...raw, id: raw.id ?? hit.id, diet_plan_id: raw.diet_plan_id ?? raw.id ?? hit.id, name: raw.name || hit.title } } });
          break;
        }
        case 'banner': {
          const url = String(raw.redirect_url || raw.link || raw.url || '').trim();
          if (url) window.open(url, '_blank', 'noopener');
          break;
        }
        default:
          break;
      }
    },
    [text, live, recent, navigate],
  );

  const sections = useMemo(
    () =>
      SECTION_META.map((s) => ({
        ...s,
        hits: (results[s.key] || []).filter((h) => h && String(h.title || '').trim()),
      })).filter((s) => s.hits.length > 0),
    [results],
  );

  const suggestions = recent.items.map((r) => r.query);

  return (
    <AppShell tab="products">
      <section className="catalog-page store-page search-page gs-page">
        <header className="catalog-head store-head">
          <div>
            <button type="button" className="text-back" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <h1>Search</h1>
            <p>Products, medicines, doctors, yoga and diet plans</p>
          </div>
        </header>
        <PremiumSearch
          value={text}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="Search products, doctors, yoga…"
          label="Search Ayurmuni"
          suggestions={suggestions}
          autoFocus={!text}
          className="gs-field"
        />

        {source === 'idle' ? (
          <RecentSearchList
            items={recent.items}
            loading={recent.loading}
            clearing={clearing}
            onPick={applyRecent}
            onClear={onClearRecent}
            onRemove={onRemoveRecent}
          />
        ) : null}
        {source === 'live' && text.trim() ? (
          <p className="gs-recent__hint">Suggestions — tap one to open and save in Recent</p>
        ) : null}
        {recentError ? <p className="gs-error" role="alert">{recentError}</p> : null}

        {isSearching ? (
          busy && sections.length === 0 ? (
            <p className="muted">Searching…</p>
          ) : source === 'live' && live.error ? (
            <div className="gs-state">
              <p className="empty-copy">{live.error}</p>
              <button type="button" className="gs-link" onClick={live.reload}>Try again</button>
            </div>
          ) : sections.length === 0 ? (
            <p className="empty-copy">No results for “{text.trim()}”</p>
          ) : (
            <div className="gs-results">
              {sections.map((section) => (
                <section key={section.key} className="gs-section" aria-label={section.title}>
                  <h2 className="gs-section__title">
                    {section.title} <span>{section.hits.length}</span>
                  </h2>
                  <ul className="gs-hits">
                    {section.hits.map((hit) => (
                      <li key={`${hit.type}:${hit.id}`}>
                        <button type="button" className="gs-hit" onClick={() => openHit(hit)}>
                          <span className={`gs-hit__img gs-hit__img--${hit.type}`}>
                            {hit.image ? <img src={hit.image} alt="" loading="lazy" /> : <span aria-hidden>{hit.title.charAt(0)}</span>}
                          </span>
                          <span className="gs-hit__text">
                            <strong>{hit.title}</strong>
                            {hit.subtitle ? <small>{hit.subtitle}</small> : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {source === 'live' && live.hasMore ? (
                <div className="load-more-wrap">
                  <button type="button" onClick={live.loadMore} disabled={live.loadingMore}>
                    {live.loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              ) : null}
            </div>
          )
        ) : (
          <>
            {browse.loading && browse.products.length === 0 ? (
              <AdvanceLoad variant="cards" count={4} label="Loading products" />
            ) : browse.products.length === 0 ? (
              <p className="empty-copy">No products found</p>
            ) : (
              <div className="catalog-grid">
                {browse.products.map((item) => (
                  <ProductCard key={item.variant_id || item.id} item={item} />
                ))}
              </div>
            )}
            {browse.hasMore ? (
              <div className="load-more-wrap">
                <button type="button" onClick={browse.loadMore} disabled={browse.loadingMore}>
                  {browse.loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}
