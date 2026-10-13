import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Leaf,
  Stethoscope,
  Package,
  Bike,
  Salad,
} from "lucide-react";
import consultImg from "/images/login/10.png";
import medicineImg from "/images/login/9.png";
import deliveryImg from "/images/login/delivery.png";
import dietImg from "/images/login/14.jpg";
import yogaImg from "/images/login/8.png";
import logoImg from "/images/FinalLogo2.png";
import welcomeVideo from "/videos/welcome.mp4";
import { Button } from "../components/ui";
import { AUTH_COPY as T } from "../content/auth";
import "../design/pages/auth.css";

const IMAGE_AUTO_MS = 4500;

const STORY_SOURCES = {
  consult: consultImg,
  medicine: medicineImg,
  delivery: deliveryImg,
  lifestyle: dietImg,
  transform: yogaImg,
};

const PILLS = [
  { icon: Stethoscope, label: "Expert Consult" },
  { icon: Package, label: "Medicines" },
  { icon: Bike, label: "Same-day Delivery" },
  { icon: Salad, label: "Diet & Yoga" },
];

const FEATURES = [
  { icon: Stethoscope, title: "Expert Consult", sub: "MD Ayurvedic doctors" },
  { icon: Package, title: "Medicines", sub: "Matched to your Prakriti" },
  { icon: Bike, title: "Same-day Delivery", sub: "Right to your doorstep" },
  { icon: Salad, title: "Diet & Yoga", sub: "Personalised daily care" },
];

export default function Welcome() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoKey, setVideoKey] = useState(0);
  const indexRef = useRef(0);
  const stories = T.stories;
  const videoIndex = stories.findIndex((s) => s.kind === "video");

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const goTo = useCallback(
    (next) => {
      const clamped =
        ((next % stories.length) + stories.length) % stories.length;
      setPrev(indexRef.current);
      if (clamped === videoIndex) setVideoKey((k) => k + 1);
      setIndex(clamped);
    },
    [stories.length, videoIndex],
  );

  useEffect(() => {
    const slide = stories[index];
    if (slide?.kind === "video" && !videoFailed) return undefined;
    const timer = setInterval(() => goTo(index + 1), IMAGE_AUTO_MS);
    return () => clearInterval(timer);
  }, [index, videoFailed, goTo, stories]);

  const onVideoEnd = () => {
    if (indexRef.current !== videoIndex) return;
    goTo(videoIndex + 1);
  };

  const active = stories[index] ?? stories[0];

  return (
    <section className="wlc-root" aria-label="Welcome to Ayurmuni">
      {/* ── Media side ── */}
      <div className="wlc-media" aria-hidden="true">
        {stories.map((item, i) => (
          <div
            key={item.key}
            className={`wlc-slide ${i === index ? "is-active" : ""} ${i === prev ? "is-prev" : ""}`}
          >
            {item.kind === "video" && !videoFailed ? (
              <video
                key={`wv-${videoKey}`}
                src={welcomeVideo}
                autoPlay
                muted
                playsInline
                onEnded={onVideoEnd}
                onError={() => setVideoFailed(true)}
              />
            ) : (
              <img src={STORY_SOURCES[item.key] || consultImg} alt="" />
            )}
          </div>
        ))}

        {/* Gradient veil */}
        <div className="wlc-veil" />

        {/* Floating pills */}
        <ul className="wlc-pills" aria-hidden="true">
          {PILLS.map(({ icon: Icon, label }) => (
            <li key={label} className="wlc-pill">
              <Icon size={13} strokeWidth={2.2} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Content panel ── */}
      <div className="wlc-panel">
        {/* Brand — pinned top */}
        <div className="wlc-brand">
          <img src={logoImg} alt={T.brand} className="wlc-logo" />
          <span className="wlc-tagline">{T.tagline}</span>
        </div>

        {/* Story copy — centred middle */}
        <div className="wlc-copy" key={index}>
          <p className="wlc-eyebrow">
            <Leaf size={13} strokeWidth={2.5} aria-hidden />
            {active.eyebrow}
          </p>
          <h2 className="wlc-title">{active.title}</h2>
          <p className="wlc-body">{active.body}</p>

          {/* Feature grid inside copy zone */}
          <ul className="wlc-features">
            {FEATURES.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="wlc-feature">
                <span className="wlc-feature__icon">
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <span className="wlc-feature__text">
                  <strong>{title}</strong>
                  <span>{sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Progress + CTA — pinned bottom */}
        <div className="wlc-footer">
          <div
            className="wlc-dots"
            role="tablist"
            aria-label={T.welcomeStoriesLabel}
          >
            {stories.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={s.title}
                className={`wlc-dot ${i === index ? "is-on" : ""}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>

          <Button
            variant="primary"
            block
            className="wlc-cta"
            trailingIcon={<ArrowRight size={17} aria-hidden />}
            onClick={() => navigate("/login")}
          >
            {T.welcomeCta}
          </Button>
        </div>
      </div>
    </section>
  );
}
