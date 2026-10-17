import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Flower2, Leaf } from 'lucide-react';
import AppShell from '../components/AppShell';
import yogaPosterImg from '/images/login/8.png';
import { SectionHead, ServiceHero, YogaSessionCard } from '../components/ServiceHome';
import { getYogaSession } from '../services/yogaService';
import {
  itemMatchesHealthConcern,
  matchesYogaSearch,
  normalizeYogaSessionList,
  resolveYogaThumbnailUri,
} from '../yoga/utils';
import { EmptyState, SearchField, SkeletonGrid } from '../components/ui';
import { HOME_COPY as H } from '../content/home';

const TRUST = [
  { icon: Flower2, label: 'Guided practice' },
  { icon: Leaf, label: 'Breath and strength' },
  { icon: BadgeCheck, label: 'Made for your routine' },
];

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

  const title = categoryName ? `${categoryName}` : 'Yoga';

  return (
    <AppShell tab="home">
      <div className="hm-page svc-page">
        <ServiceHero
          id="yg-hero"
          eyebrow="Move"
          title={title}
          accent="sessions."
          lede={H.yogaText}
          trust={TRUST}
        >
          <div className="svc-search">
            <SearchField
              value={search}
              onChange={setSearch}
              onSubmit={(value) => setDebounced(String(value || '').trim())}
              placeholder="Search yoga sessions"
              label="Search yoga sessions"
            />
          </div>
        </ServiceHero>

        <div className="hm-body">
          <section className="hm-well hm-well--move" aria-labelledby="yg-list-title">
            <SectionHead
              id="yg-list-title"
              title={H.yogaTitle}
              description={
                categoryName
                  ? `Practices selected for ${categoryName}.`
                  : 'Guided practices for breath, strength, and calm.'
              }
            />
            {loading && sessions.length === 0 ? (
              <SkeletonGrid count={6} className="svc-pose-grid" label="Loading sessions" />
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
              <ul className="svc-pose-grid">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <YogaSessionCard
                      item={{
                        ...item,
                        title: item.title || item.name,
                        thumbnail_url: resolveYogaThumbnailUri(item) || yogaPosterImg,
                      }}
                      onClick={() => openSession(item)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
