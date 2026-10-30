import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import ShareButton from "../components/ShareButton";
import yogaPosterImg from "/images/login/8.png";
import { getYogaSessionDetail } from "../services/yogaService";
import {
  getYogaInstructor,
  getYogaSessionBreakdown,
  mapYogaSessionForList,
  normalizeYogaSessionList,
  resolveYogaThumbnailUri,
  resolveYogaVideoUri,
} from "../yoga/utils";
import "../design/yoga-session.css";

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
      cancelled = false;
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
    session?.difficulty || session?.level || session?.production_level || "",
  ).trim();
  const durationLabel = String(
    session?.duration || session?.duration_minutes || "",
  ).trim();
  const notes = String(
    session?.notes || session?.instruction || session?.instructions || "",
  ).trim();
  const description = session?.short_description || session?.description || "";

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
            <button
              type="button"
              className="text-back"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
            <h1>Yoga Session</h1>
            <p>Guided practice</p>
          </div>

          {session ? (
            <ShareButton
              title={`${session.title || session.name || "Yoga session"} - Ayurmuni`}
              text={description || "A guided yoga session on Ayurmuni."}
              url={`${window.location.origin}/yoga/${session.id || sessionId}`}
              variant="soft"
              size="sm"
            />
          ) : null}
        </header>

        <div className="yoga-session-content">
          {loading && !session ? (
            <p className="yoga-session-loading">Loading session…</p>
          ) : !session ? (
            <div className="yoga-session-empty">
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

              <section
                className="yoga-session-meta"
                aria-label="Session details"
              >
                <div className="yoga-session-meta-head">
                  <h2 className="yoga-title">
                    {session.title || session.name || "Yoga Session"}
                  </h2>

                  <div className="yoga-session-tags">
                    {difficulty ? (
                      <span className="yoga-session-tag level">
                        <i aria-hidden="true" />
                        {difficulty.toUpperCase()}
                      </span>
                    ) : null}

                    {durationLabel ? (
                      <span className="yoga-session-tag">
                        <i aria-hidden="true" />
                        {durationLabel}
                      </span>
                    ) : null}
                  </div>
                </div>

                {description ? (
                  <p className="yoga-subtitle">{description}</p>
                ) : null}
              </section>

              {notes ? (
                <section className="yoga-notes" aria-label="Session notes">
                  <strong>Notes</strong>
                  <p>{notes}</p>
                </section>
              ) : null}

              <section
                className="yoga-breakdown-card"
                aria-label="Session breakdown"
              >
                <div className="yoga-breakdown-head">
                  <div>
                    <h3>Session Breakdown</h3>
                    <p>Pose-by-pose guidance and timing</p>
                  </div>
                </div>

                {!breakdown.length ? (
                  <div className="yoga-breakdown-empty">
                    <span aria-hidden="true">🧘</span>
                    <p>
                      Pose-by-pose timing will appear here when this session
                      includes a breakdown.
                    </p>
                  </div>
                ) : (
                  <ol className="yoga-steps">
                    {breakdown.map((item, index) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={index === activeIndex ? "on" : ""}
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
              </section>

              {instructor ? (
                <button
                  type="button"
                  className="yoga-mentor"
                  onClick={() => navigate("/mentor/consult")}
                >
                  {instructor.imageUri ? (
                    <img src={instructor.imageUri} alt="" />
                  ) : (
                    <span className="yoga-mentor-fallback">🧘</span>
                  )}

                  <div>
                    <strong>{instructor.name}</strong>
                    <small>{instructor.subtitle || "Yoga Mentor"}</small>
                    <p>
                      {instructor.description ||
                        "Guided alignment and breathwork for a complete session."}
                    </p>
                  </div>
                </button>
              ) : null}
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}
