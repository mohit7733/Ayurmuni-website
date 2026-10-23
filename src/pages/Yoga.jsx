import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flower2, Play } from 'lucide-react';
import AppShell from '../components/AppShell';
import yogaPosterImg from '/images/login/8.webp';
import { getYogaSession } from '../services/yogaService';
import {
  itemMatchesHealthConcern,
  matchesYogaSearch,
  normalizeYogaSessionList,
  resolveYogaThumbnailUri,
} from '../yoga/utils';
import { EmptyState, SearchField, searchSuggestions, SkeletonGrid } from '../components/ui';
import { HOME_COPY as H } from '../content/home';
import '../design/pages/yoga.css';

const clip = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > 28 ? '' : text;
};

const sessionTitle = (item) => item.title || item.name || 'Yoga session';

function SessionArt({ item }) {
  const src = resolveYogaThumbnailUri(item) || yogaPosterImg;
  return <img src={src} alt="" loading="lazy" decoding="async" />;
}

function FeatureSession({ item, onOpen }) {
  const level = clip(item.difficulty);
  const duration = clip(item.duration);
  return (
    <article className="yg-feature">
      <SessionArt item={item} />
      <div className="yg-feature__shade" aria-hidden />
      <div className="yg-feature__body">
        {level ? <span className="yg-chip">{level}</span> : null}
        <h2>
          <button type="button" className="am-stretched" onClick={() => onOpen(item)}>
            {sessionTitle(item)}
          </button>
        </h2>
        <p>{duration || 'Guided practice'}</p>
      </div>
      <span className="yg-play" aria-hidden>
        <Play size={16} fill="currentColor" />
      </span>
    </article>
  );
}

function SideSession({ item, onOpen }) {
  const level = clip(item.difficulty);
  const duration = clip(item.duration);
  return (
    <article className="yg-mini">
      <div className="yg-mini__art">
        <SessionArt item={item} />
      </div>
      <div className="yg-mini__body">
        {level ? <span className="yg-chip">{level}</span> : null}
        <h3>
          <button type="button" className="am-stretched" onClick={() => onOpen(item)}>
            {sessionTitle(item)}
          </button>
        </h3>
        <p>{duration || 'Guided practice'}</p>
      </div>
      <span className="yg-play yg-play--sm" aria-hidden>
        <Play size={12} fill="currentColor" />
      </span>
    </article>
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
      <div className="hm-page svc-page yg-page">
        <div className="hm-body">
          <section className="yg-studio" aria-labelledby="yg-list-title">
            <header className="yg-mast">
              <div className="yg-mast__copy">
                <p className="yg-mast__kicker">Practice</p>
                <h1 id="yg-list-title">
                  {categoryName ? `${categoryName} yoga` : H.yogaTitle}
                </h1>
                <p>
                  {categoryName
                    ? `Practices selected for ${categoryName}.`
                    : 'Guided practices for breath, strength, and calm.'}
                </p>
              </div>
              <SearchField
                value={search}
                onChange={setSearch}
                onSubmit={(value) => setDebounced(String(value || '').trim())}
                placeholder="Search sessions"
                label="Search yoga sessions"
                submitLabel={false}
                suggestions={searchSuggestions(sessions)}
              />
            </header>
            {loading && sessions.length === 0 ? (
              <SkeletonGrid count={4} className="yg-stage" label="Loading sessions" />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Flower2 size={28} />}
                title="No yoga sessions"
                description={
                  debounced
                    ? 'Try another search.'
                    : 'Sessions for this concern will appear here when available.'
                }
              />
            ) : (
              <>
                <div className={`yg-stage${filtered.length === 1 ? ' is-solo' : ''}`}>
                  <FeatureSession item={filtered[0]} onOpen={openSession} />
                  {filtered.length > 1 ? (
                    <ul className="yg-side">
                      {filtered.slice(1, 4).map((item) => (
                        <li key={item.id}>
                          <SideSession item={item} onOpen={openSession} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {filtered.length > 4 ? (
                  <ul className="yg-more">
                    {filtered.slice(4).map((item) => (
                      <li key={item.id}>
                        <SideSession item={item} onOpen={openSession} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
