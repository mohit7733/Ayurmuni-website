import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import yogaPosterImg from '/images/login/8.png';
import { getYogaSession } from '../services/yogaService';
import {
  itemMatchesHealthConcern,
  matchesYogaSearch,
  normalizeYogaSessionList,
  resolveYogaThumbnailUri,
  resolveYogaVideoUri,
} from '../yoga/utils';

function YogaListThumb({ item }) {
  const videoUri = resolveYogaVideoUri(item);
  const thumbUri = resolveYogaThumbnailUri(item);
  const [failed, setFailed] = useState(false);
  const poster = thumbUri || yogaPosterImg;

  if (!videoUri || failed) {
    return (
      <div className="yoga-thumb">
        <img src={poster} alt="" />
        <span className="yoga-play">▶</span>
      </div>
    );
  }

  return (
    <div className="yoga-thumb">
      {thumbUri ? <img src={thumbUri} alt="" className="yoga-thumb-poster" /> : null}
      <video
        src={videoUri}
        poster={thumbUri || undefined}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        onError={() => setFailed(true)}
      />
      <span className="yoga-play">▶</span>
    </div>
  );
}

export default function Yoga() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const healthCategoryId = params.get('category') || params.get('health_category_id') || '';
  const healthDiseaseId = params.get('disease') || params.get('health_disease_id') || '';
  const categoryName = (params.get('name') || '').trim();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const concernMatch = useMemo(
    () => ({
      healthCategoryId: healthCategoryId || null,
      healthDiseaseId: healthDiseaseId || null,
      categoryName: categoryName || null,
    }),
    [healthCategoryId, healthDiseaseId, categoryName],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getYogaSession({
        ...(healthDiseaseId
          ? { health_disease_id: healthDiseaseId }
          : healthCategoryId
            ? { health_category_id: healthCategoryId }
            : {}),
      });
      setSessions(
        normalizeYogaSessionList(res).filter((item) => itemMatchesHealthConcern(item, concernMatch)),
      );
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [healthCategoryId, healthDiseaseId, concernMatch]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const filtered = useMemo(
    () => sessions.filter((item) => matchesYogaSearch(debounced, item)),
    [sessions, debounced],
  );

  const openSession = (item) => {
    navigate(`/yoga/${item.id}`, { state: { item } });
  };

  return (
    <AppShell tab="home">
      <section className="catalog-page yoga-page">
        <header className="catalog-head">
          <div>
            <button type="button" className="text-back" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <h1>{categoryName ? `${categoryName} Yoga` : 'Yoga Sessions'}</h1>
            <p>Practice with guided videos</p>
          </div>
        </header>

        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setDebounced(search.trim());
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search yoga sessions..."
          />
          <button type="submit" className="cta">
            Search
          </button>
        </form>

        {loading && sessions.length === 0 ? (
          <p className="muted">Loading sessions…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-copy">
            <strong>No yoga sessions</strong>
            <p>
              {debounced
                ? 'Try another search.'
                : 'Sessions for this concern will appear here when available.'}
            </p>
          </div>
        ) : (
          <div className="yoga-list">
            {filtered.map((item) => {
              const meta = [item.difficulty, item.duration].filter(Boolean).join(' • ');
              return (
                <button
                  key={item.id}
                  type="button"
                  className="yoga-row"
                  onClick={() => openSession(item)}
                >
                  <YogaListThumb item={item} />
                  <div className="yoga-row-copy">
                    <strong>{item.title || item.name}</strong>
                    {meta ? <small>{meta}</small> : null}
                    {item.short_description ? <p>{item.short_description}</p> : null}
                  </div>
                  <span className="yoga-row-icon" aria-hidden>
                    ▶
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
