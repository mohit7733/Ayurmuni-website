import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import { Button, Disclaimer } from "../components/ui";
import { STATIC_COPY as T } from "../content/static";
import "../design/pages/static.css";

const VALUE_ICONS = [Stethoscope, HeartHandshake, ShieldCheck];

export default function About() {
  const navigate = useNavigate();

  return (
    <AppShell tab="profile">
      <section className="sx-page sx-about">
        <PageHeader
          className="sx-about__header"
          eyebrow="OUR STORY"
          title={T.aboutTitle}
          subtitle={T.aboutSubtitle}
          onBack={() => navigate(-1)}
        />

        <div className="sx-about__content">
          <section
            className="sx-about__story"
            aria-labelledby="sx-about-story-title"
          >
            <div className="sx-about__story-copy">
              <span className="sx-about__eyebrow">
                <Sparkles size={15} aria-hidden="true" />A thoughtful approach
                to Ayurveda
              </span>
              <h2 id="sx-about-story-title">
                Rooted in tradition. Made personal.
              </h2>
              <p>{T.aboutLead}</p>
            </div>
            <div className="sx-about__brand-panel" aria-hidden="true">
              <span
                className="sx-about__brand-orbit sx-about__brand-orbit--outer"
                aria-hidden="true"
              />
              <span
                className="sx-about__brand-orbit sx-about__brand-orbit--inner"
                aria-hidden="true"
              />
              <img src="/images/FinalLogo.png" alt="" />
              <span className="sx-about__brand-caption">
                Grounded in nature · Focused on you
              </span>
              <img
                className="sx-about__brand-leaf"
                src="/images/leaf1.png"
                alt=""
              />
            </div>
          </section>

          <section
            className="sx-about__values"
            aria-labelledby="sx-about-values-title"
          >
            <div className="sx-about__section-heading">
              <span className="sx-about__section-label">OUR APPROACH</span>
              <h2 id="sx-about-values-title">Wellness that starts with you</h2>
              <p>Thoughtful care, with the right support at every step.</p>
            </div>
            <div className="sx-points sx-about__points">
              {T.aboutPoints.map((item, index) => {
                const Icon = VALUE_ICONS[index];
                return (
                  <article
                    key={item.title}
                    className="sx-point sx-about__point"
                  >
                    <span className="sx-about__point-icon" aria-hidden="true">
                      <Icon size={21} strokeWidth={1.8} />
                    </span>
                    <span className="sx-about__point-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section
            className="sx-about__next"
            aria-labelledby="sx-about-next-title"
          >
            <div className="sx-about__next-copy">
              <span className="sx-about__next-label">
                YOUR WELLNESS JOURNEY
              </span>
              <h2 id="sx-about-next-title">
                A little guidance can go a long way.
              </h2>
              <p>Explore Ayurmuni or find the right care for your needs.</p>
            </div>
            <div className="sx-actions sx-about__actions">
              <Button
                variant="secondary"
                onClick={() => navigate("/home")}
                trailingIcon={<ArrowRight size={17} aria-hidden="true" />}
              >
                {T.aboutCtaHome}
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate("/consult/doctors")}
                trailingIcon={<ArrowRight size={17} aria-hidden="true" />}
                style={{ marginLeft: "var(--am-space-4)" }}
              >
                {T.aboutCtaConsult}
              </Button>
            </div>
          </section>

          <Disclaimer className="sx-about__disclaimer" />
        </div>
      </section>
    </AppShell>
  );
}
