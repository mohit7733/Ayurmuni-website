import {
  ArrowRight,
  Check,
  Clock3,
  FileText,
  FlaskConical,
  Heart,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import DummyOfferCard from '../components/DummyOfferCard';
import PageHeader from '../components/PageHeader';
import { showSuccessToast } from '../config/key';
import { HOME_COPY as T } from '../content/home';
import {
  DUMMY_LAB_TESTS,
  DUMMY_ORANGE_LAB_FEATURES,
} from '../data/homeDummySections';
import '../design/pages/dummy-offers.css';
import '../design/pages/packages.css';
import '../design/pages/orange-lab.css';

const HERO_IMG =
  'https://i.pinimg.com/736x/ee/8e/f4/ee8ef4209318f635bbf36fe592fdf4c7.jpg';

const FEATURE_ICONS = {
  flask: FlaskConical,
  report: FileText,
  bolt: Zap,
  shield: ShieldCheck,
  clock: Clock3,
  heart: Heart,
};

const comingSoon = () => {
  showSuccessToast(T.labComingSoonToast, 'info');
};

export default function OrangeLab() {
  const features = DUMMY_ORANGE_LAB_FEATURES.slice(0, 4);

  return (
    <AppShell tab="home">
      <section className="pk-page">
        <PageHeader title={T.labPageTitle} subtitle={T.labPageSubtitle} backTo="/home" />

        <section className="pk-hero" aria-labelledby="ol-hero-title">
          <img className="pk-hero__image" src={HERO_IMG} alt="" />
          <div className="pk-hero__content">
            <span className="pk-hero__eyebrow">
              <Sparkles size={15} aria-hidden /> {T.labHeroEyebrow.toUpperCase()}
            </span>
            <h2 id="ol-hero-title">{T.labHeroTitle}</h2>
            <p>{T.labHeroSub}</p>
            <div className="pk-hero__trust">
              <span>
                <Check size={15} aria-hidden /> {T.labTrustSafe}
              </span>
              <span>
                <Check size={15} aria-hidden /> {T.labTrustNabl}
              </span>
              <span>
                <Check size={15} aria-hidden /> {T.labTrustReports}
              </span>
            </div>
          </div>
          <div className="pk-hero__seal" aria-label={T.labTrustNabl}>
            <ShieldCheck size={19} aria-hidden />
            <span>
              NABL
              <br />
              partner labs
            </span>
          </div>
        </section>

        <ul className="ol-features" aria-label={T.labFeaturesLabel}>
          {features.map((item) => {
            const Icon = FEATURE_ICONS[item.icon] || FlaskConical;
            return (
              <li key={item.id} className="ol-feature">
                <span className="ol-feature__icon" aria-hidden>
                  <Icon size={18} />
                </span>
                <span className="ol-feature__copy">
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
              </li>
            );
          })}
        </ul>

        <section className="pk-group" aria-labelledby="ol-tests-title">
          <header className="pk-group__header">
            <span className="pk-group__icon">
              <FlaskConical size={20} aria-hidden />
            </span>
            <div className="pk-group__copy">
              <h3 id="ol-tests-title">{T.labPopularTitle}</h3>
              <p>{T.labPopularText}</p>
            </div>
            <span className="pk-group__count">
              {DUMMY_LAB_TESTS.length} tests
            </span>
          </header>
          <div className="pk-grid">
            {DUMMY_LAB_TESTS.map((item) => (
              <DummyOfferCard key={item.id} item={item} kind="lab" onClick={comingSoon} />
            ))}
          </div>
        </section>

        <button type="button" className="pk-cta" onClick={comingSoon}>
          <span className="pk-cta__icon">
            <FlaskConical size={22} aria-hidden />
          </span>
          <span className="pk-cta__copy">
            <strong>{T.labCtaTitle}</strong>
            <span>{T.labCtaText}</span>
          </span>
          <span className="pk-cta__action">
            {T.labCtaAction} <ArrowRight size={17} aria-hidden />
          </span>
        </button>
      </section>
    </AppShell>
  );
}
