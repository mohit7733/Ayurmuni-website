import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Award, Check, CheckCircle2, Clock, HeartPulse, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Button, EmptyState, ErrorState, SkeletonGrid } from "../components/ui";
import { formatRupee } from "../home/catalog";
import PlanTransferModal from "../components/PlanTransferModal";
import usePackagePurchase from "../hooks/usePackagePurchase";
import { isAuthenticated, requireAuth } from "../services/guestAuth";
import { loadPackageKinds, loadPackagesWithStatus } from "../services/packageService";
import "../design/pages/packages-premium.css";

const FEATURED_BADGES = new Set(["POPULAR", "BESTSELLER"]);
const TRUST = ["Experienced practitioners", "Personalised guidance", "Care led by experts"];
const MAX_LIST = 3;

const iconFor = (name) => {
  const label = String(name || "").toLowerCase();
  if (label.includes("consult") || label.includes("doctor")) return Stethoscope;
  if (label.includes("personal") || label.includes("diet") || label.includes("wellness")) return HeartPulse;
  return Sparkles;
};

function PlanCard({ item, busy, onAction }) {
  const hasMrp = item.mrp && item.mrp > item.price;
  const off = hasMrp ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;
  const featured = FEATURED_BADGES.has(String(item.badge || "").toUpperCase());
  const owned = item.mode === "purchase" && item.purchased;
  const label = owned ? "View plan" : item.mode === "purchase" ? "Buy plan" : "Book consult";
  const lines = item.includes || [];
  return (
    <article className={`pp-card${featured ? " is-featured" : ""}${owned ? " is-owned" : ""}`} aria-label={item.name}>
      <div className="pp-card__top">
        {owned ? (
          <span className="pp-card__owned"><CheckCircle2 size={12} aria-hidden /> Purchased</span>
        ) : item.badge ? (
          <span className="pp-card__badge">{item.badge}</span>
        ) : <span />}
        {off > 0 && !owned ? <span className="pp-card__off">{off}% off</span> : null}
      </div>
      <h3 className="pp-card__name">
        <Link to={`/packages/${encodeURIComponent(item.id)}`} className="pp-card__link">{item.name}</Link>
      </h3>
      <p className="pp-card__price">
        <strong>{formatRupee(item.price)}</strong>
        {hasMrp ? <s>{formatRupee(item.mrp)}</s> : null}
        {item.duration ? <span className="pp-card__dur"><Clock size={12} aria-hidden /> {item.duration}</span> : null}
      </p>
      {lines.length ? (
        <ul className="pp-card__list">
          {lines.slice(0, MAX_LIST).map((line) => (
            <li key={line}>
              <Check size={13} aria-hidden />
              <span>{line}</span>
            </li>
          ))}
          {lines.length > MAX_LIST ? <li className="pp-card__more">+{lines.length - MAX_LIST} more</li> : null}
        </ul>
      ) : null}
      <button
        type="button"
        className={`pp-card__cta${owned ? " is-owned" : ""}`}
        disabled={busy}
        onClick={() => onAction(item)}
      >
        {busy ? "Please wait..." : label} {!busy ? <ArrowRight size={14} aria-hidden /> : null}
      </button>
    </article>
  );
}

export default function Packages() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);


  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    const authed = await isAuthenticated();
    if (!authed) {
      setNeedsLogin(true);
      setPlans([]);
      setKinds([]);
      setLoading(false);
      return;
    }
    setNeedsLogin(false);
    try {
      const [nextPlans, nextKinds] = await Promise.all([loadPackagesWithStatus(), loadPackageKinds()]);
      setPlans(nextPlans);
      setKinds(nextKinds);
    } catch (err) {
      if (silent) return;
      setPlans([]);
      setError(err?.message || "Could not load consultation packages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const byName = new Map();
    plans.forEach((plan) => {
      const key = plan.group || "Packages";
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(plan);
    });
    const ordered = kinds
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((kind) => ({
        id: kind.id || kind.code || kind.name,
        name: kind.name,
        description: kind.description,
        plans: byName.get(kind.name) || [],
      }))
      .filter((group) => group.plans.length);
    const named = new Set(ordered.map((group) => group.name));
    byName.forEach((items, name) => {
      if (!named.has(name)) {
        ordered.push({ id: name, name, description: "", plans: items });
      }
    });
    return ordered;
  }, [kinds, plans]);

  // verify-payment succeeded: cache already dropped, reload so the card flips to "Purchased" (then My Plans opens).
  const onPurchased = useCallback(
    async (item) => {
      setPlans((current) => current.map((plan) => (plan.id === item.id ? { ...plan, purchased: true } : plan)));
      await load({ silent: true });
    },
    [load],
  );
  const { start: buyPlan, busyId: buyingId, prompt: transferPrompt, confirm: confirmTransfer, cancel: cancelTransfer } =
    usePackagePurchase({ onPurchased });

  const onAction = (item) => {
    if (item.mode === "consult") {
      requireAuth("Sign in to book a consultation.").then((ok) => {
        if (ok) navigate("/consult");
      });
      return;
    }
    if (item.purchased) {
      navigate(`/packages/${encodeURIComponent(item.id)}`);
      return;
    }
    buyPlan(item);
  };

  const talkToTeam = () => {
    requireAuth("Sign in to talk to our care team.").then((ok) => {
      if (ok) navigate("/consult");
    });
  };

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
          {!needsLogin ? (
            <Link to="/profile/plans" className="pp-head__plans">
              <Award size={14} aria-hidden /> My Plans
            </Link>
          ) : null}
        </header>

        <ul className="pp-trust" aria-label="Why AyurMuni">
          {TRUST.map((t, i) => (
            <li key={t}>
              {i === 2 ? <ShieldCheck size={14} aria-hidden /> : <Check size={14} aria-hidden />}
              {t}
            </li>
          ))}
        </ul>

        {loading ? <SkeletonGrid count={4} variant="product" label="Loading packages" /> : null}

        {!loading && needsLogin ? (
          <EmptyState
            title="Sign in to view packages"
            description="Consultation packages and booking are available on your AyurMuni account."
            action={<Button variant="primary" onClick={() => requireAuth("Sign in to view packages.")}>Sign in</Button>}
          />
        ) : null}

        {!loading && error ? (
          <ErrorState title="Could not load packages" description={error} onRetry={() => load()} />
        ) : null}

        {!loading && !needsLogin && !error && !plans.length ? (
          <EmptyState title="No packages right now" description="New consultation plans will show up here when they are published." />
        ) : null}

        {!loading && !error
          ? groups.map((group) => {
              const Icon = iconFor(group.name);
              return (
                <section className="pp-group" key={group.id} aria-labelledby={`pp-${group.id}`}>
                  <header className="pp-group__head">
                    <span className="pp-group__icon"><Icon size={16} aria-hidden /></span>
                    <h2 id={`pp-${group.id}`}>{group.name}</h2>
                    <p>{group.description || "Plans in this category."}</p>
                    <span className="pp-group__count">{group.plans.length} {group.plans.length === 1 ? "plan" : "plans"}</span>
                  </header>
                  <div className="pp-grid">
                    {group.plans.map((item) => (
                      <PlanCard key={item.id} item={item} busy={buyingId === item.id} onAction={onAction} />
                    ))}
                  </div>
                </section>
              );
            })
          : null}

        <PlanTransferModal prompt={transferPrompt} onYes={confirmTransfer} onNo={cancelTransfer} />

        <button type="button" className="pp-help" onClick={talkToTeam}>
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
