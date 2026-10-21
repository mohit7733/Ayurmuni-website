import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flower2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import BannerCarousel from '../components/BannerCarousel';
import yogaPosterImg from '/images/login/8.webp';
import { SectionHead, YogaSessionCard } from '../components/ServiceHome';
import { loadBannerCarouselForScreen } from '../services/bannerService';
import { resolveBannerNavigation } from '../home/serviceCategories';
import { getYogaSession } from '../services/yogaService';
import {
  itemMatchesHealthConcern,
  matchesYogaSearch,
  normalizeYogaSessionList,
  resolveYogaThumbnailUri,
} from '../yoga/utils';
import { EmptyState, PageBar, SearchField, SkeletonGrid } from '../components/ui';
import { HOME_COPY as H } from '../content/home';

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
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const items = await loadBannerCarouselForScreen('yoga');
      if (!alive) return;
      setBanners(items);
      setBannersLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  const openBanner = (item) => {
    const target = resolveBannerNavigation(item);
    if (!target) return;
    if (target.external) {
      window.open(target.href, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(target.path);
  };

  return (
    <AppShell tab="home">
      <div className="hm-page svc-page">
        <div className="hm-body">
          {bannersLoading || banners.length > 0 ? (
            <BannerCarousel
              items={banners}
              loading={bannersLoading}
              interval={6000}
              onSelect={openBanner}
              copy={{
                label: H.offersLabel,
                open: H.openOffer,
                of: H.of,
                show: H.showOffer,
                pause: H.pauseOffers,
                play: H.playOffers,
              }}
            />
          ) : null}

          <PageBar id="yg-hero" title={`${title} sessions`}>
            <SearchField
              value={search}
              onChange={setSearch}
              onSubmit={(value) => setDebounced(String(value || '').trim())}
              placeholder="Search yoga sessions"
              label="Search yoga sessions"
            />
          </PageBar>
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
