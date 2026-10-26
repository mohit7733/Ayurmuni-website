import { ArrowLeft, ArrowRight, Check, HeartPulse, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { showSuccessToast } from "../config/key";
import { DUMMY_CONSULT_PACKAGES } from "../data/homeDummySections";
import { formatRupee } from "../home/catalog";
import "../design/pages/packages-premium.css";

const comingSoon = () => {
  showSuccessToast("Package booking will be available soon.", "info");
};

/* Gold foil only where the data itself marks a plan as the popular pick. */
const FEATURED_BADGES = new Set(["POPULAR", "BESTSELLER"]);

const GROUPS = [
  { id: "consult", name: "AyurMuni Consult", title: "Start with expert guidance", description: "A thoughtful first step, with a doctor who understands your needs.", icon: Stethoscope },
  { id: "personalised", name: "Personalised Wellness", title: "Build a plan around you", description: "Personalised diet and lifestyle support for your day-to-day wellbeing.", icon: HeartPulse },
  { id: "long-term", name: "Long-Term Journey", title: "Make lasting progress", description: "Ongoing guidance to help you stay consistent on your wellness journey.", icon: Sparkles },
];

const TRUST = ["Experienced practitioners", "Personalised guidance", "Care led by experts"];

function PlanCard({ item }) {
  const hasMrp = item.mrp && item.mrp > item.price;
  const off = hasMrp ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;
  const featured = FEATURED_BADGES.has(item.badge);
  return (
    <article className={`pp-card${featured ? " is-featured" : ""}`} aria-label={item.name}>
      <div className="pp-card__top">
        {item.badge ? <span className="pp-card__badge">{item.badge}</span> : <span />}
        {off > 0 ? <span className="pp-card__off">{off}% off</span> : null}
      </div>
      <h3 className="pp-card__name">{item.name}</h3>
      <p className="pp-card__price">
        <strong>{formatRupee(item.price)}</strong>
        {hasMrp ? <s>{formatRupee(item.mrp)}</s> : null}
      </p>
      {item.includes?.length ? (
        <ul className="pp-card__list">
          {item.includes.map((line) => (
            <li key={line}>
              <Check size={14} aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="pp-card__cta" onClick={comingSoon}>
        Buy plan <ArrowRight size={15} aria-hidden />
      </button>
    </article>
  );
}

export default function Packages() {
  const navigate = useNavigate();
  return (
    <AppShell tab="home">
      <section className="pp-page">
        <header className="pp-head">
          <button type="button" className="pp-head__back" onClick={() => navigate("/home")} aria-label="Back to home">
            <ArrowLeft size={18} aria-hidden />
          </button>
          <div className="pp-head__copy">
            <h1 className="pp-head__title">Consultation Packages</h1>
            <p className="pp-head__desc">Personalised Ayurvedic care, thoughtfully planned around you.</p>
          </div>
        </header>

        <ul className="pp-trust" aria-label="Why AyurMuni">
          {TRUST.map((t, i) => (
            <li key={t}>
              {i === 2 ? <ShieldCheck size={14} aria-hidden /> : <Check size={14} aria-hidden />}
              {t}
            </li>
          ))}
        </ul>

        {GROUPS.map((group) => {
          const plans = DUMMY_CONSULT_PACKAGES.filter((item) => item.group === group.name);
          if (!plans.length) return null;
          const Icon = group.icon;
          return (
            <section className="pp-group" key={group.id} aria-labelledby={`pp-${group.id}`}>
              <header className="pp-group__head">
                <span className="pp-group__icon"><Icon size={16} aria-hidden /></span>
                <h2 id={`pp-${group.id}`}>{group.title}</h2>
                <p>{group.description}</p>
                <span className="pp-group__count">{plans.length} {plans.length === 1 ? "plan" : "plans"}</span>
              </header>
              <div className="pp-grid">
                {plans.map((item) => <PlanCard key={item.id} item={item} />)}
              </div>
            </section>
          );
        })}

        <button type="button" className="pp-help" onClick={comingSoon}>
          <span className="pp-group__icon"><HeartPulse size={16} aria-hidden /></span>
          <span className="pp-help__copy">
            <strong>Not sure where to start?</strong>
            <span>Our care team can help you find the right plan.</span>
          </span>
          <span className="pp-help__action">Talk to our team <ArrowRight size={15} aria-hidden /></span>
        </button>
      </section>
    </AppShell>
  );
}
