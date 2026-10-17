import { ArrowRight, Check, Flower2, Leaf, Sparkles } from 'lucide-react';
import AppShell from '../components/AppShell';
import DummyOfferCard from '../components/DummyOfferCard';
import PageHeader from '../components/PageHeader';
import { showSuccessToast } from '../config/key';
import { HOME_COPY as T } from '../content/home';
import { DUMMY_PANCHAKARMA } from '../data/homeDummySections';
import '../design/pages/dummy-offers.css';
import '../design/pages/packages.css';

const HERO_IMG =
  'https://i.pinimg.com/1200x/5d/b9/bb/5db9bb336f64106f79babe97c418fb5c.jpg';

const comingSoon = () => {
  showSuccessToast(T.panchakarmaComingSoonToast, 'info');
};

export default function Panchakarma() {
  return (
    <AppShell tab="home">
      <section className="pk-page">
        <PageHeader
          title={T.panchakarmaTitle}
          subtitle={T.panchakarmaPageSubtitle}
          backTo="/home"
        />

        <section className="pk-hero" aria-labelledby="pkarm-hero-title">
          <img className="pk-hero__image" src={HERO_IMG} alt="" />
          <div className="pk-hero__content">
            <span className="pk-hero__eyebrow">
              <Sparkles size={15} aria-hidden /> {T.panchakarmaHeroEyebrow.toUpperCase()}
            </span>
            <h2 id="pkarm-hero-title">{T.panchakarmaHeroTitle}</h2>
            <p>{T.panchakarmaHeroSub}</p>
            <div className="pk-hero__trust">
              <span>
                <Check size={15} aria-hidden /> {T.panchakarmaTrustClassic}
              </span>
              <span>
                <Check size={15} aria-hidden /> {T.panchakarmaTrustGuided}
              </span>
            </div>
          </div>
          <div className="pk-hero__seal" aria-label={T.panchakarmaTrustGuided}>
            <Leaf size={19} aria-hidden />
            <span>
              Classical
              <br />
              protocols
            </span>
          </div>
        </section>

        <div className="pk-intro">
          <div>
            <p className="pk-intro__eyebrow">{T.panchakarmaListEyebrow.toUpperCase()}</p>
            <h2>{T.panchakarmaListTitle}</h2>
          </div>
          <p>{T.panchakarmaText}</p>
        </div>

        <section className="pk-group" aria-labelledby="pkarm-list-title">
          <header className="pk-group__header">
            <span className="pk-group__icon">
              <Flower2 size={20} aria-hidden />
            </span>
            <div className="pk-group__copy">
              <h3 id="pkarm-list-title">Signature therapies</h3>
              <p>Each session is planned around your prakriti and comfort.</p>
            </div>
            <span className="pk-group__count">
              {DUMMY_PANCHAKARMA.length} therapies
            </span>
          </header>
          <div className="pk-grid pk-grid--four">
            {DUMMY_PANCHAKARMA.map((item) => (
              <DummyOfferCard key={item.id} item={item} kind="therapy" onClick={comingSoon} />
            ))}
          </div>
        </section>

        <button type="button" className="pk-cta" onClick={comingSoon}>
          <span className="pk-cta__icon">
            <Flower2 size={22} aria-hidden />
          </span>
          <span className="pk-cta__copy">
            <strong>{T.panchakarmaCtaTitle}</strong>
            <span>{T.panchakarmaCtaText}</span>
          </span>
          <span className="pk-cta__action">
            {T.panchakarmaCtaAction} <ArrowRight size={17} aria-hidden />
          </span>
        </button>
      </section>
    </AppShell>
  );
}
