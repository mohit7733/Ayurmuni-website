import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Flower2, Gauge, HeartPulse, ListOrdered, NotebookPen, Play, Stethoscope, Target, UserRound } from 'lucide-react';
import AppShell from '../components/AppShell';
import ShareButton from '../components/ShareButton';
import { Button } from '../components/ui';
import { yogaView } from '../yoga/present';
import { YOGA_COPY as Y } from '../content/yoga';
import {
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  InfoGrid,
  MetaChip,
  PersonCard,
  Steps,
} from '../components/detail/Detail';
import yogaPosterImg from '/images/login/8.webp';
import { getYogaSessionDetail } from '../services/yogaService';
import {
  getYogaInstructor,
  getYogaSessionBreakdown,
  mapYogaSessionForList,
  normalizeYogaSessionList,
  resolveYogaThumbnailUri,
  resolveYogaVideoUri,
} from '../yoga/utils';

const formatDuration = (value) => {
  const text = String(value ?? '').trim();
  if (!text || /^0+(\.0+)?$/.test(text)) return '';
  return /^\d+$/.test(text) ? `${text} min` : text;
};

const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '');

export default function YogaSession() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const location = useLocation();
  const videoRef = useRef(null);
  const routeItem = location.state?.item || null;
  const [session, setSession] = useState(routeItem || null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(!routeItem);
  useEffect(() => {
    const id = sessionId || routeItem?.id;
    if (id == null) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getYogaSessionDetail(id);
        const list = normalizeYogaSessionList(res);
        const payload = res?.data && !Array.isArray(res.data) ? res.data : res;
        const mapped =
          mapYogaSessionForList(payload) ||
          list.find((item) => item.id === String(id)) ||
          list[0];
        if (!cancelled && mapped) {
          setSession((prev) => ({ ...(prev || {}), ...mapped }));
        }
      } catch {
        /* keep route item */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, routeItem?.id]);

  const videoUri = useMemo(() => resolveYogaVideoUri(session), [session]);
  const posterUri = useMemo(
    () => resolveYogaThumbnailUri(session) || yogaPosterImg,
    [session],
  );
  const breakdown = useMemo(() => getYogaSessionBreakdown(session), [session]);
  const instructor = useMemo(() => getYogaInstructor(session), [session]);
  const difficulty = capitalize(
    String(session?.difficulty || session?.level || session?.production_level || '').trim(),
  );
  const durationLabel = formatDuration(session?.duration || session?.duration_minutes);
  const notes = String(
    session?.notes || session?.instruction || session?.instructions || '',
  ).trim();
  const title = session?.title || session?.name || 'Yoga session';
  const rawDescription = String(session?.short_description || session?.description || '').trim();
  const description =
    rawDescription && rawDescription.toLowerCase() !== difficulty.toLowerCase()
      ? rawDescription
      : Y.fallbackLede;
  const view = useMemo(() => yogaView(session), [session]);

  const playFrom = (startSeconds) => {
    const video = videoRef.current;
    if (!video) return;
    if (Number.isFinite(startSeconds)) video.currentTime = Math.max(0, startSeconds);
    video.scrollIntoView({ behavior: 'smooth', block: 'center' });
    video.play().catch(() => {});
  };

  const onPickStep = (item, index) => {
    setActiveIndex(index);
    playFrom(item.startSeconds);
  };

  return (
    <AppShell tab="home">
      <DetailPage>
        <DetailTop
          backTo="/yoga"
          backLabel="Yoga"
          actions={
            session ? (
              <ShareButton
                title={`${title} - Ayurmuni`}
                text={description || 'A guided yoga session on Ayurmuni.'}
                url={`${window.location.origin}/yoga/${session.id || sessionId}`}
                variant="soft"
                size="sm"
              />
            ) : null
          }
        />

        {loading && !session ? (
          <DetailSkeleton label="Loading session" />
        ) : !session ? (
          <DetailEmpty
            icon={Flower2}
            title={Y.unavailableTitle}
            text={Y.unavailableText}
            action={<Button onClick={() => navigate('/yoga')}>{Y.ctaBrowse}</Button>}
          />
        ) : (
          <>
            <DetailHero
              titleId="yoga-title"
              mediaClassName={videoUri ? 'dx-hero__media--video' : undefined}
              media={
                videoUri ? (
                  <video
                    ref={videoRef}
                    src={videoUri}
                    poster={posterUri}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img src={posterUri} alt="" />
                )
              }
              eyebrow={Y.eyebrow}
              title={title}
              lede={description}
              chips={
                <>
                  {difficulty ? (
                    <MetaChip icon={Gauge} tone="gold">
                      {difficulty}
                    </MetaChip>
                  ) : null}
                  {durationLabel ? <MetaChip icon={Clock}>{durationLabel}</MetaChip> : null}
                  {breakdown.length ? (
                    <MetaChip icon={ListOrdered}>
                      {breakdown.length} {breakdown.length === 1 ? 'pose' : 'poses'}
                    </MetaChip>
                  ) : null}
                </>
              }
            >
              <div className="dx-actions dx-actions--row">
                {videoUri ? (
                  <Button
                    variant="primary"
                    leadingIcon={<Play size={16} aria-hidden />}
                    onClick={() => playFrom(breakdown[activeIndex]?.startSeconds)}
                  >
                    {Y.start}
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  leadingIcon={<Stethoscope size={16} aria-hidden />}
                  onClick={() => navigate('/consult/doctors')}
                >
                  {Y.ctaConsult}
                </Button>
              </div>
            </DetailHero>

            <DetailLayout
              aside={
                <>
                  <DetailCard id="yoga-about" title={Y.quickFacts} icon={Flower2}>
                    <InfoGrid
                      columns={2}
                      items={[
                        { label: 'Level', value: difficulty },
                        { label: 'Duration', value: durationLabel },
                        { label: 'Poses', value: breakdown.length || '' },
                        { label: 'Format', value: videoUri ? 'Guided video' : 'Self-paced' },
                      ]}
                    />
                  </DetailCard>
                  {instructor ? (
                    <DetailCard id="yoga-mentor" title="Your mentor" icon={UserRound}>
                      <PersonCard
                        image={instructor.imageUri}
                        name={instructor.name}
                        role={instructor.subtitle || 'Yoga mentor'}
                        onClick={() => navigate('/mentor/consult')}
                      />
                      <p className="dx-prose">
                        {instructor.description ||
                          'Guided alignment and breathwork for a complete session.'}
                      </p>
                    </DetailCard>
                  ) : null}
                </>
              }
            >
              {view?.benefits.length ? (
                <DetailCard id="yoga-benefits" title={Y.benefits} icon={HeartPulse}>
                  <ul className="yg-list">
                    {view.benefits.map((b) => (
                      <li key={b}>
                        <CheckCircle2 size={16} aria-hidden /> {b}
                      </li>
                    ))}
                  </ul>
                </DetailCard>
              ) : null}

              {view?.focus.length ? (
                <DetailCard id="yoga-focus" title={Y.focus} icon={Target}>
                  <div className="dx-chips yg-tags">
                    {view.focus.map((f) => (
                      <MetaChip key={f}>{f}</MetaChip>
                    ))}
                  </div>
                </DetailCard>
              ) : null}

              {notes ? (
                <DetailCard id="yoga-notes" title={Y.before} icon={NotebookPen} tone="accent">
                  <p className="dx-prose">{notes}</p>
                </DetailCard>
              ) : null}

              <DetailCard
                id="yoga-breakdown"
                title={Y.steps}
                icon={ListOrdered}
                meta={breakdown.length && videoUri ? Y.stepsHint : undefined}
              >
                {breakdown.length ? (
                  <Steps
                    items={breakdown.map((item) => ({
                      id: item.id,
                      title: item.title,
                      meta: item.time,
                      startSeconds: item.startSeconds,
                    }))}
                    activeIndex={activeIndex}
                    onPick={videoUri ? onPickStep : undefined}
                  />
                ) : (
                  <p className="dx-prose">{Y.stepsEmpty}</p>
                )}
              </DetailCard>

              {view?.precautions?.length ? (
                <DetailCard id="yoga-safety" title={Y.precautions} icon={AlertTriangle}>
                  <ul className="yg-list yg-list--caution">
                    {view.precautions.map((c) => (
                      <li key={c}>
                        <AlertTriangle size={15} aria-hidden /> {c}
                      </li>
                    ))}
                  </ul>
                </DetailCard>
              ) : null}
            </DetailLayout>

          </>
        )}
      </DetailPage>
    </AppShell>
  );
}
