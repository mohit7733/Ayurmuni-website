import { Clock, FileText, FlaskConical, Heart, Shield, Zap } from 'lucide-react';
import AppShell from '../components/AppShell';
import DummyOfferCard from '../components/DummyOfferCard';
import PageHeader from '../components/PageHeader';
import { showSuccessToast } from '../config/key';
import { DUMMY_LAB_TESTS, DUMMY_ORANGE_LAB_FEATURES } from '../data/homeDummySections';
import '../design/pages/dummy-offers.css';

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
      <section className="do-page">
        <PageHeader title="Health Lab" subtitle="At-home collection · dummy catalog" backTo="/home" />

        <div className="do-hero">
          <img src={HERO_IMG} alt="" />
          <div className="do-hero__copy">
            <p>At-home collection</p>
            <h2>Lab tests, made simple</h2>
            <span>Safe · NABL partners · Doctor-ready reports</span>
          </div>
        </div>

        <div className="do-chips" aria-label="Lab highlights">
          {features.map((item) => {
            const Icon = FEATURE_ICON[item.icon] || FlaskConical;
            return (
              <span key={item.id} className="do-chip">
                <Icon size={14} aria-hidden />
                {item.title}
              </span>
            );
          })}
        </div>

        <h2 className="am-section-header__title">Popular packages</h2>
        <div className="do-grid">
          {DUMMY_LAB_TESTS.map((item) => (
            <DummyOfferCard key={item.id} item={item} kind="lab" onClick={comingSoon} />
          ))}
        </div>

        <button type="button" className="do-cta" onClick={comingSoon}>
          <div>
            <h3>Full body checkup?</h3>
            <p>Curated panels · home collection</p>
          </div>
          <span>Explore</span>
        </button>
      </section>
    </AppShell>
  );
}
