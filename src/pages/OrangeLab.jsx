import { ArrowRight, Check, Clock, FileText, FlaskConical, Heart, Shield, Zap } from 'lucide-react';
import AppShell from '../components/AppShell';
import DummyOfferCard from '../components/DummyOfferCard';
import PageHeader from '../components/PageHeader';
import { showSuccessToast } from '../config/key';
import { DUMMY_LAB_TESTS, DUMMY_ORANGE_LAB_FEATURES } from '../data/homeDummySections';
import '../design/pages/dummy-offers.css';
import '../design/pages/orange-lab.css';

const HERO_IMG =
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=900&q=80';

const FEATURE_ICON = {
  flask: FlaskConical,
  report: FileText,
  bolt: Zap,
  shield: Shield,
  clock: Clock,
  heart: Heart,
};

const comingSoon = () => {
  showSuccessToast('Lab booking will be available soon.', 'info');
};

export default function OrangeLab() {
  const features = DUMMY_ORANGE_LAB_FEATURES.slice(0, 4);

  return (
    <AppShell tab="home">
      <section className="ol-page">
        <PageHeader
          title="Health Lab"
          subtitle="Reliable testing, with the convenience of home collection."
          backTo="/home"
        />

        <section className="ol-hero" aria-labelledby="ol-hero-title">
          <img className="ol-hero__image" src={HERO_IMG} alt="" />
          <div className="ol-hero__content">
            <span className="ol-hero__eyebrow"><FlaskConical size={15} aria-hidden /> CARE STARTS WITH CLARITY</span>
            <h2 id="ol-hero-title">Your health, in focus.</h2>
            <p>Get the insights you need with convenient at-home sample collection and reports you can share with your doctor.</p>
            <div className="ol-hero__trust">
              <span><Check size={15} aria-hidden /> At-home sample collection</span>
              <span><Check size={15} aria-hidden /> Clear, doctor-ready reports</span>
            </div>
          </div>
          <span className="ol-hero__note"><Shield size={17} aria-hidden /> Trusted testing partners</span>
        </section>

        <section className="ol-benefits" aria-label="What to expect">
          {features.map((item) => {
            const Icon = FEATURE_ICON[item.icon] || FlaskConical;
            return (
              <article key={item.id} className="ol-benefit">
                <span className="ol-benefit__icon"><Icon size={19} aria-hidden /></span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.subtitle}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="ol-catalog" aria-labelledby="ol-catalog-title">
          <header className="ol-catalog__header">
            <div>
              <p className="ol-catalog__eyebrow">TESTS &amp; PANELS</p>
              <h2 id="ol-catalog-title">Popular health checks</h2>
            </div>
            <p>Choose a panel to see what it checks.</p>
          </header>
          <div className="ol-grid">
            {DUMMY_LAB_TESTS.map((item) => (
              <DummyOfferCard key={item.id} item={item} kind="lab" onClick={comingSoon} />
            ))}
          </div>
        </section>

        <button type="button" className="ol-cta" onClick={comingSoon}>
          <span className="ol-cta__icon"><Heart size={22} aria-hidden /></span>
          <span className="ol-cta__copy">
            <strong>Looking for a complete health check?</strong>
            <span>Explore curated panels with convenient home collection.</span>
          </span>
          <span className="ol-cta__action">Explore panels <ArrowRight size={17} aria-hidden /></span>
        </button>
      </section>
    </AppShell>
  );
}
