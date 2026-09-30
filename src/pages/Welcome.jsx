import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Images, Videos } from '../common/images';
import { Button } from '../components/ui';
import { AUTH_COPY as T } from '../content/auth';
import '../design/pages/auth.css';

const IMAGE_AUTO_MS = 4200;

const STORY_SOURCES = {
  consult: Images.journeyConsult,
  medicine: Images.journeyMedicine,
  delivery: Images.journeyDelivery,
  lifestyle: Images.journeyDiet,
  transform: Images.journeyYoga,
};

export default function Welcome() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoKey, setVideoKey] = useState(0);
  const indexRef = useRef(0);
  const stories = T.stories;
  const videoIndex = stories.findIndex((s) => s.kind === 'video');

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const goTo = useCallback(
    (next) => {
      const clamped = ((next % stories.length) + stories.length) % stories.length;
      if (clamped === videoIndex) {
        setVideoKey((k) => k + 1);
      }
      setIndex(clamped);
    },
    [stories.length, videoIndex],
  );

  useEffect(() => {
    const slide = stories[index];
    const onVideoSlide = slide?.kind === 'video' && !videoFailed;
    if (onVideoSlide) return undefined;

    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % stories.length;
        if (next === videoIndex) setVideoKey((k) => k + 1);
        return next;
      });
    }, IMAGE_AUTO_MS);

    return () => clearInterval(timer);
  }, [index, videoFailed, videoIndex, stories]);

  const onVideoEnd = () => {
    if (indexRef.current !== videoIndex) return;
    goTo(videoIndex + 1);
  };

  const active = stories[index] ?? stories[0];

  return (
    <section className="au-page au-welcome">
      <div className="au-welcome__media">
        <div
          className="au-welcome__track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {stories.map((item) => (
            <div className="au-welcome__slide" key={item.key}>
              {item.kind === 'video' && !videoFailed ? (
                <video
                  key={`welcome-video-${videoKey}`}
                  src={Videos.welcome}
                  autoPlay
                  muted
                  playsInline
                  onEnded={onVideoEnd}
                  onError={() => setVideoFailed(true)}
                />
              ) : (
                <img
                  src={STORY_SOURCES[item.key] || Images.journeyConsult}
                  alt={item.title}
                />
              )}
              <div className="au-welcome__fade" />
            </div>
          ))}
        </div>
      </div>

      <div className="au-welcome__panel">
        <div className="au-welcome__brand">
          <div className="au-welcome__logo">
            <img src={Images.FinalLogo2} alt="" />
          </div>
          <div>
            <strong>{T.brand}</strong>
            <span>{T.tagline}</span>
          </div>
        </div>

        <div className="au-welcome__copy">
          <p className="au-welcome__kicker">{active.eyebrow}</p>
          <h2>{active.title}</h2>
          <p>{active.body}</p>

          <div className="au-welcome__progress" role="tablist" aria-label={T.welcomeStoriesLabel}>
            {stories.map((s, i) => (
              <button
                key={s.key}
                type="button"
                className={i === index ? 'is-on' : ''}
                onClick={() => goTo(i)}
                aria-label={s.title}
                aria-selected={i === index}
              />
            ))}
          </div>

          <Button
            variant="primary"
            block
            trailingIcon={<ArrowRight size={18} aria-hidden />}
            onClick={() => navigate('/login')}
          >
            {T.welcomeCta}
          </Button>
        </div>
      </div>
    </section>
  );
}
