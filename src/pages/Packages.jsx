import AppShell from '../components/AppShell';
import DummyOfferCard from '../components/DummyOfferCard';
import PageHeader from '../components/PageHeader';
import { showSuccessToast } from '../config/key';
import { DUMMY_CONSULT_PACKAGES } from '../data/homeDummySections';
import '../design/pages/dummy-offers.css';

const HERO_IMG =
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80';

const comingSoon = () => {
  showSuccessToast('Package booking will be available soon.', 'info');
};

export default function Packages() {
  return (
    <AppShell tab="home">
      <section className="do-page">
        <PageHeader
          title="Consultation Packages"
          subtitle="Dummy catalog · same as the app"
          backTo="/home"
        />

        <div className="do-hero">
          <img src={HERO_IMG} alt="" />
          <div className="do-hero__copy">
            <p>Ayurvedic care</p>
            <h2>Plans that fit your journey</h2>
            <span>Consult · Diet · Long-term wellness</span>
          </div>
        </div>

        <h2 className="am-section-header__title">All packages</h2>
        <div className="do-grid">
          {DUMMY_CONSULT_PACKAGES.map((item) => (
            <DummyOfferCard key={item.id} item={item} kind="package" onClick={comingSoon} />
          ))}
        </div>

        <button type="button" className="do-cta do-cta--packages" onClick={comingSoon}>
          <div>
            <h3>Need a longer plan?</h3>
            <p>Consult · diet · wellness journeys</p>
          </div>
          <span>Explore</span>
        </button>
      </section>
    </AppShell>
  );
}
