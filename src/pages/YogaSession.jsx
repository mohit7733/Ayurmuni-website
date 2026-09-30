import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ShareButton from '../components/ShareButton';
import yogaPosterImg from '/images/login/8.png';
import { getYogaSessionDetail } from '../services/yogaService';
import {
  getYogaInstructor,
  getYogaSessionBreakdown,
  mapYogaSessionForList,
  normalizeYogaSessionList,
  resolveYogaThumbnailUri,
  resolveYogaVideoUri,
} from '../yoga/utils';

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
  const difficulty = String(
    session?.difficulty || session?.level || session?.production_level || '',
  ).trim();
  const durationLabel = String(session?.duration || session?.duration_minutes || '').trim();
  const notes = String(
    session?.notes || session?.instruction || session?.instructions || '',
  ).trim();

  const onPickStep = (index, startSeconds) => {
    setActiveIndex(index);
    const video = videoRef.current;
    if (video && Number.isFinite(startSeconds)) {
      video.currentTime = Math.max(0, startSeconds);
      video.play().catch(() => {});
    }
  };

  return (
    <AppShell tab="home">
      <section className="catalog-page yoga-session-page">
        <header className="catalog-head">
          <div>
            <button type="button" className="text-back" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <h1>Yoga Session</h1>
            <p>Guided practice</p>
          </div>
          {session ? (
            <ShareButton
              title={`${session.title || session.name || 'Yoga session'} - Ayurmuni`}
              text={session.short_description || session.description || 'A guided yoga session on Ayurmuni.'}
              url={`${window.location.origin}/yoga/${session.id || sessionId}`}
              variant="soft"
              size="sm"
            />
          ) : null}
        </header>

        {loading && !session ? (
          <p className="muted">Loading session…</p>
        ) : !session ? (
          <div className="empty-copy">
            <strong>Session unavailable</strong>
            <p>This yoga session could not be loaded.</p>
          </div>
        ) : (
          <>
            <div className="yoga-player">
              {videoUri ? (
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
              )}
            </div>

            <div className="yoga-badges">
              {difficulty ? <span className="yoga-badge level">{difficulty.toUpperCase()}</span> : null}
              {durationLabel ? <span className="yoga-badge">{durationLabel}</span> : null}
            </div>

            <h2 className="yoga-title">{session.title || session.name || 'Yoga Session'}</h2>
            {session.short_description || session.description ? (
              <p className="yoga-subtitle">{session.short_description || session.description}</p>
            ) : null}

            {notes ? (
              <div className="yoga-notes">
                <strong>Notes</strong>
                <p>{notes}</p>
              </div>
            ) : null}

            <h3 className="yoga-section">Session Breakdown</h3>
            {!breakdown.length ? (
              <p className="muted">
                Pose-by-pose timing will appear here when this session includes a breakdown.
              </p>
            ) : (
              <ol className="yoga-steps">
                {breakdown.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={index === activeIndex ? 'on' : ''}
                      onClick={() => onPickStep(index, item.startSeconds)}
                    >
                      <span className="yoga-step-num">{index + 1}</span>
                      <span className="yoga-step-copy">
                        <strong>{item.title}</strong>
                        <small>{item.time}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {instructor ? (
              <button
                type="button"
                className="yoga-mentor"
                onClick={() => navigate('/mentor/consult')}
              >
                {instructor.imageUri ? (
                  <img src={instructor.imageUri} alt="" />
                ) : (
                  <span className="yoga-mentor-fallback">🧘</span>
                )}
                <div>
                  <strong>{instructor.name}</strong>
                  <small>{instructor.subtitle || 'Yoga Mentor'}</small>
                  <p>
                    {instructor.description ||
                      'Guided alignment and breathwork for a complete session.'}
                  </p>
                </div>
              </button>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}
