import {
  ArrowRight,
  Check,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import AppShell from "../components/AppShell";
import DummyOfferCard from "../components/DummyOfferCard";
import PageHeader from "../components/PageHeader";
import { showSuccessToast } from "../config/key";
import { DUMMY_CONSULT_PACKAGES } from "../data/homeDummySections";
import "../design/pages/dummy-offers.css";
import "../design/pages/packages.css";

const HERO_IMG =
  "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80";

const comingSoon = () => {
  showSuccessToast("Package booking will be available soon.", "info");
};

export default function Packages() {
  const groups = [
    {
      id: "consult",
      name: "AyurMuni Consult",
      title: "Start with expert guidance",
      description:
        "A thoughtful first step, with a doctor who understands your needs.",
      icon: Stethoscope,
    },
    {
      id: "personalised",
      name: "Personalised Wellness",
      title: "Build a plan around you",
      description:
        "Personalised diet and lifestyle support for your day-to-day wellbeing.",
      icon: HeartPulse,
    },
    {
      id: "long-term",
      name: "Long-Term Journey",
      title: "Make lasting progress",
      description:
        "Ongoing guidance to help you stay consistent on your wellness journey.",
      icon: Sparkles,
    },
  ];

  return (
    <AppShell tab="home">
      <section className="pk-page">
        <PageHeader
          title="Consultation Packages"
          subtitle="Personalised Ayurvedic care, thoughtfully planned around you."
          backTo="/home"
        />

        <section className="pk-hero" aria-labelledby="pk-hero-title">
          <img className="pk-hero__image" src={HERO_IMG} alt="" />
          <div className="pk-hero__content">
            <span className="pk-hero__eyebrow">
              <Sparkles size={15} aria-hidden /> CARE THAT GROWS WITH YOU
            </span>
            <h2 id="pk-hero-title">
              Small steps.
              <br />A healthier you.
            </h2>
            <p>
              Choose a care plan that brings expert advice, personalised
              wellness, and steady support together.
            </p>
            <div className="pk-hero__trust">
              <span>
                <Check size={15} aria-hidden /> Experienced practitioners
              </span>
              <span>
                <Check size={15} aria-hidden /> Personalised guidance
              </span>
            </div>
          </div>
          <div className="pk-hero__seal" aria-label="Care led by experts">
            <ShieldCheck size={19} aria-hidden />
            <span>
              Care led
              <br />
              by experts
            </span>
          </div>
        </section>

        <div className="pk-intro">
          <div>
            <p className="pk-intro__eyebrow">FIND YOUR FIT</p>
            <h2>Care for every stage</h2>
          </div>
          <p>Explore flexible plans designed to meet you.</p>
        </div>

        <div className="pk-groups">
          {groups.map((group) => {
            const plans = DUMMY_CONSULT_PACKAGES.filter(
              (item) => item.group === group.name,
            );
            const Icon = group.icon;
            if (!plans.length) return null;

            return (
              <section
                className="pk-group"
                key={group.id}
                aria-labelledby={`pk-${group.id}`}
              >
                <header className="pk-group__header">
                  <span className="pk-group__icon">
                    <Icon size={20} aria-hidden />
                  </span>
                  <div className="pk-group__copy">
                    <h3 id={`pk-${group.id}`}>{group.title}</h3>
                    <p>{group.description}</p>
                  </div>
                  <span className="pk-group__count">
                    {plans.length} {plans.length === 1 ? "plan" : "plans"}
                  </span>
                </header>
                <div className="pk-grid">
                  {plans.map((item) => (
                    <DummyOfferCard
                      key={item.id}
                      item={item}
                      kind="package"
                      onClick={comingSoon}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <button type="button" className="pk-cta" onClick={comingSoon}>
          <span className="pk-cta__icon">
            <HeartPulse size={22} aria-hidden />
          </span>
          <span className="pk-cta__copy">
            <strong>Not sure where to start?</strong>
            <span>Our care team can help you find the right plan.</span>
          </span>
          <span className="pk-cta__action">
            Talk to our team <ArrowRight size={17} aria-hidden />
          </span>
        </button>
      </section>
    </AppShell>
  );
}
