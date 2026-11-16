import { Button } from '../components/ui';
import AppShell from '../components/AppShell';
import { ABOUT as T, isEmailAddress } from '../content/about';
import '../design/pages/about.css';

function mailHref(value) {
  return isEmailAddress(value) ? `mailto:${value.trim()}` : null;
}

function ContactValue({ value }) {
  const href = mailHref(value);
  if (!href) return value;
  return <a href={href}>{value}</a>;
}

function HeroCast() {
  return (
    <svg
      className="ab-hero__art"
      viewBox="0 0 1120 360"
      role="img"
      aria-label="A doctor, families, a yoga practice and a medicine delivery, together"
    >
      <ellipse cx="560" cy="332" rx="420" ry="16" fill="#d5e8dc" />
      <ellipse cx="560" cy="328" rx="300" ry="8" fill="#eaf4ee" />

      <g transform="translate(70 18) scale(0.88)">
      {/* Woman with a tulsi pot */}
      <g transform="translate(48 78)">
        <ellipse cx="78" cy="248" rx="36" ry="7" fill="#0a2f27" opacity="0.08" />
        <path d="M46 118c-18 8-28 36-24 78l8 52h96l6-48c4-40-8-72-28-84-8 10-22 14-34 8-8-2-16-2-24-6z" fill="#1f6b56" />
        <path d="M58 124c18-6 36 2 48 16 8 28-2 52-18 64" fill="none" stroke="#e4c47a" strokeWidth="10" strokeLinecap="round" />
        <circle cx="78" cy="62" r="28" fill="#f0c7a4" />
        <path d="M50 58c2-28 18-42 32-44 16-2 30 10 32 28 2 8-2 14-8 16-8-16-20-20-32-16-10 4-16 10-24 16z" fill="#3a2a22" />
        <circle cx="78" cy="22" r="11" fill="#3a2a22" />
        <circle cx="68" cy="64" r="2" fill="#3a2a22" />
        <circle cx="88" cy="64" r="2" fill="#3a2a22" />
        <path d="M70 76c4 4 12 4 16 0" fill="none" stroke="#a15c45" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M122 168c16 4 28 16 30 30" fill="none" stroke="#f0c7a4" strokeWidth="10" strokeLinecap="round" />
        <rect x="138" y="186" width="28" height="22" rx="6" fill="#c9972f" />
        <path d="M152 186c0-16 8-22 8-22s8 6 8 22" fill="#2c7a5e" />
        <path d="M148 176c-10-14-4-26 2-30 8 6 12 16 8 28" fill="#569a7b" />
      </g>

      {/* Doctor */}
      <g transform="translate(230 52)">
        <ellipse cx="86" cy="274" rx="40" ry="7" fill="#0a2f27" opacity="0.08" />
        <path d="M40 128h92c8 0 16 8 16 20v108c0 10-8 16-16 16H40c-8 0-16-6-16-16V148c0-12 8-20 16-20z" fill="#ffffff" />
        <path d="M58 128l28 36 28-36" fill="#0d614e" />
        <path d="M70 150c8 22 28 22 36 0" fill="none" stroke="#8bbba2" strokeWidth="3" />
        <circle cx="108" cy="176" r="7" fill="#8bbba2" />
        <circle cx="86" cy="64" r="28" fill="#c68642" />
        <path d="M58 62c0-26 14-40 28-42 18-2 32 12 32 32 0 6-2 10-6 12-6-14-16-18-28-14-8 2-16 8-26 12z" fill="#2a211c" />
        <circle cx="76" cy="66" r="2" fill="#2a211c" />
        <circle cx="96" cy="66" r="2" fill="#2a211c" />
        <path d="M78 78c5 4 12 4 16 0" fill="none" stroke="#8a4b2f" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="118" y="168" width="46" height="58" rx="6" fill="#f7f4ec" stroke="#d6c6a6" />
        <path d="M128 182h26M128 192h22M128 202h18" stroke="#8bbba2" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 160c-8 20-6 40 4 52" fill="none" stroke="#f7f4ec" strokeWidth="12" strokeLinecap="round" />
      </g>

      {/* Person holding a medicine box */}
      <g transform="translate(410 46)">
        <ellipse cx="86" cy="280" rx="40" ry="8" fill="#0a2f27" opacity="0.08" />
        <path d="M58 236h56v36c0 6-8 10-16 10H74c-8 0-16-4-16-10v-36z" fill="#0b4136" />
        <path d="M46 118c-4 34 2 70 10 118h68c8-48 14-84 10-118-14 12-32 16-44 16s-30-4-44-16z" fill="#f7f1e4" />
        <path d="M72 118h28v16H72z" fill="#0d614e" />
        <circle cx="86" cy="58" r="28" fill="#e4b08a" />
        <path d="M58 56c2-28 16-42 30-44 18 0 32 14 32 34 0 6-4 12-8 14-8-16-18-22-30-18-10 4-16 8-24 14z" fill="#1c1917" />
        <circle cx="76" cy="60" r="2.1" fill="#1c1917" />
        <circle cx="96" cy="60" r="2.1" fill="#1c1917" />
        <path d="M78 74c5 4 12 4 16 0" fill="none" stroke="#a15c45" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M28 168c6 18 10 28 16 34" fill="none" stroke="#e4b08a" strokeWidth="11" strokeLinecap="round" />
        <path d="M144 168c-6 18-10 28-16 34" fill="none" stroke="#e4b08a" strokeWidth="11" strokeLinecap="round" />
        <rect x="48" y="186" width="76" height="48" rx="8" fill="#0d614e" />
        <path d="M74 200c8-10 18-10 24 0-8 2-16 2-24 0z" fill="#e4c47a" />
        <path d="M86 198v14" stroke="#e4c47a" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Child with a leaf */}
      <g transform="translate(650 128)">
        <ellipse cx="58" cy="196" rx="28" ry="6" fill="#0a2f27" opacity="0.08" />
        <path d="M30 86c-8 22-6 52 2 86h52c8-34 10-64 2-86-10 8-22 12-28 12s-18-4-28-12z" fill="#e4c47a" />
        <circle cx="58" cy="46" r="22" fill="#f6d2b4" />
        <path d="M38 44c2-20 12-30 22-32 12 0 22 8 24 20-6-8-14-10-22-8-8 2-16 8-24 20z" fill="#4a3428" />
        <circle cx="50" cy="48" r="1.7" fill="#4a3428" />
        <circle cx="66" cy="48" r="1.7" fill="#4a3428" />
        <path d="M52 58c3 3 9 3 12 0" fill="none" stroke="#a15c45" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M96 70c14-18 28-16 34-4-12 2-22 8-28 16-4-4-6-8-6-12z" fill="#2c7a5e" />
        <path d="M108 78c8 10 6 18-2 20" fill="none" stroke="#f6d2b4" strokeWidth="7" strokeLinecap="round" />
      </g>

      {/* Seated yoga */}
      <g transform="translate(790 150)">
        <ellipse cx="78" cy="176" rx="62" ry="14" fill="#b9d7c6" />
        <ellipse cx="78" cy="172" rx="48" ry="8" fill="#2c7a5e" />
        <path d="M28 150c8 16 28 28 50 28s42-12 50-28c-14 8-32 12-50 12s-36-4-50-12z" fill="#f7f1e4" />
        <path d="M52 78c-4 28 2 52 26 62 24-10 30-34 26-62-8 10-20 16-26 16s-18-6-26-16z" fill="#f7f1e4" />
        <circle cx="78" cy="52" r="22" fill="#8d5524" />
        <path d="M56 50c2-22 14-34 24-34 14 2 26 14 26 30-8-10-16-12-26-10-8 2-16 8-24 14z" fill="#1c1410" />
        <path d="M62 92c-2 16 4 28 16 32 12-4 18-16 16-32" fill="none" stroke="#8d5524" strokeWidth="8" strokeLinecap="round" />
        <circle cx="70" cy="54" r="1.6" fill="#1c1410" />
        <circle cx="86" cy="54" r="1.6" fill="#1c1410" />
      </g>

      {/* Delivery */}
      <g transform="translate(930 64)">
        <ellipse cx="78" cy="256" rx="36" ry="7" fill="#0a2f27" opacity="0.08" />
        <path d="M52 236h52v22c0 4-8 8-16 8H66c-6 0-14-4-14-8v-22z" fill="#13231e" />
        <path d="M40 118c-4 34 2 72 10 118h56c8-46 14-84 10-118-12 10-28 14-38 14s-26-4-38-14z" fill="#0d614e" />
        <path d="M58 118h40l-6 28H64l-6-28z" fill="#0b5142" />
        <circle cx="78" cy="70" r="26" fill="#d4a574" />
        <path d="M50 66c4-28 18-42 30-42 16 2 28 16 28 34 0 4-8 2-12-2-4-16-14-22-24-18-8 2-14 10-22 28z" fill="#0b4136" />
        <path d="M46 58h64c4 8 4 16 0 22H46c-4-6-4-14 0-22z" fill="#0b4136" />
        <path d="M52 66h52" stroke="#cfe3d6" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <rect x="28" y="156" width="48" height="40" rx="6" fill="#e7f2ec" />
        <path d="M44 168c6-8 14-8 18 0-6 2-12 2-18 0z" fill="#2c7a5e" />
        <circle cx="70" cy="72" r="1.8" fill="#2a211c" />
        <circle cx="86" cy="72" r="1.8" fill="#2a211c" />
      </g>
      </g>
    </svg>
  );
}

function StoryWave() {
  return (
    <svg className="ab-story__wave" viewBox="0 0 48 220" aria-hidden="true">
      <path
        d="M24 4c14 18 14 32 0 48s-14 30 0 48 14 30 0 48-14 30 0 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function About() {
  const partnerHref = mailHref(T.partnerEmail);
  const corporateAddress = T.contacts.find((item) => item.id === 'corporate')?.value || '';
  const mapQuery = corporateAddress.startsWith('[') ? T.mapQuery : corporateAddress;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=11&output=embed`;

  return (
    <AppShell tab="profile">
      <article className="ab-page">
        <header className="ab-hero">
          <div className="ab-wrap ab-hero__inner">
            <h1>{T.heroTitle}</h1>
            <div className="ab-hero__actions">
              <Button variant="primary" size="lg" to="/consult/doctors">
                {T.ctaConsult}
              </Button>
              <Button variant="secondary" size="lg" to="/patient-faq">
                {T.ctaPrakriti}
              </Button>
            </div>
            <HeroCast />
          </div>
        </header>

        <section className="ab-services" aria-labelledby="ab-services-title">
          <div className="ab-wrap">
            <h2 id="ab-services-title">{T.servicesTitle}</h2>
            <ul className="ab-services__row">
              {T.services.map((item, index) => (
                <li key={item.id}>
                  <article className="ab-service">
                    <div className={`ab-service__media${item.fit === 'contain' ? ' is-contain' : ''}`}>
                      <img src={item.image} alt={item.alt} />
                    </div>
                    <div className="ab-service__copy">
                      <span className="ab-service__index" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="ab-org" aria-labelledby="ab-org-title">
          <div className="ab-wrap ab-org__grid">
            <div className="ab-org__copy">
              <h2 id="ab-org-title">{T.orgTitle}</h2>
              <h3>{T.corporateTitle}</h3>
              <p>{T.corporateText}</p>
            </div>
            <aside className="ab-partner">
              <h3>{T.partnerTitle}</h3>
              <p>{T.partnerText}</p>
              {partnerHref ? (
                <a className="ab-partner__btn" href={partnerHref}>
                  {T.partnerCta}
                </a>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="ab-story" aria-labelledby="ab-story-title">
          <div className="ab-wrap">
            <h2 id="ab-story-title">{T.storyTitle}</h2>
            <div className="ab-story__grid">
              <div>
                <h3>{T.ideaTitle}</h3>
                <p>{T.ideaText}</p>
              </div>
              <StoryWave />
              <div>
                <h3>{T.todayTitle}</h3>
                <p>{T.todayText}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="ab-reach" aria-labelledby="ab-reach-title">
          <div className="ab-wrap ab-reach__grid">
            <div>
              <h2 id="ab-reach-title">{T.reachTitle}</h2>
              <ul className="ab-reach__list">
                {T.contacts.map((item) => (
                  <li key={item.id}>
                    <span>{item.label}:</span> <ContactValue value={item.value} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="ab-map-frame">
              <iframe
                className="ab-map"
                title={T.mapTitle}
                src={mapSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </section>

        <p className="ab-compliance">{T.compliance}</p>
      </article>
    </AppShell>
  );
}
