import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Award, Calendar, Check, HeartPulse, ShieldCheck, Sparkles, Star, Stethoscope } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Button, EmptyState, ErrorState, SkeletonGrid } from "../components/ui";
import { formatRupee } from "../home/catalog";
import PlanTransferModal from "../components/PlanTransferModal";
import usePackagePurchase from "../hooks/usePackagePurchase";
import { isAuthenticated, requireAuth } from "../services/guestAuth";
import { loadPackageKinds, loadPackagesWithStatus } from "../services/packageService";
import PlanMark from "../packages/PlanMark";
import { getPlanTheme, isCarePlan, planCta, planDiscount, planDuration, themeStyle } from "../packages/planTheme";
import "../design/pages/packages-premium.css";
import "../design/pages/plan-cards.css";

const TRUST = ["Experienced practitioners", "Personalised guidance", "Care led by experts"];
const MAX_LIST = 3;

const iconFor = (name) => {
  const label = String(name || "").toLowerCase();
  if (label.includes("consult") || label.includes("doctor")) return Stethoscope;
  if (label.includes("personal") || label.includes("diet") || label.includes("wellness")) return HeartPulse;
  return Sparkles;
};

function PlanCard({ item, busy, onAction }) {
  const theme = getPlanTheme(item);
  const care = isCarePlan(item);
  const discount = planDiscount(item);
  const owned = item.mode === "purchase" && item.purchased;
  const lines = item.includes || [];
  const extra = lines.length - Math.min(lines.length, MAX_LIST);
  return (
    <article className={`am-plan${care ? " is-care" : ""}`} style={themeStyle(theme)} aria-label={item.name}>
      <div className="am-plan__top">
        <div className="am-plan__row">
          <span className="am-plan__chip">
            <PlanMark name={theme.icon} size={12} color={theme.accent} />
            {item.group || "Plan"}
          </span>
          {care ? (
            <span className="am-plan__ribbon"><Star size={10} aria-hidden /> CARE PLAN</span>
          ) : null}
        </div>
        <div className="am-plan__title">
          <div>
            <h3>
              <Link to={`/packages/${encodeURIComponent(item.id)}`}>{item.name}</Link>
            </h3>
            <p className="am-plan__dur"><Calendar size={12} aria-hidden /> {planDuration(item)}</p>
          </div>
          <span className="am-plan__bubble">
            {item.image ? <img src={item.image} alt="" /> : <PlanMark name={theme.icon} size={22} color={theme.accent} />}
          </span>
        </div>
      </div>
      <div className="am-plan__body">
        {item.description ? <p className="am-plan__desc">{item.description}</p> : null}
        {lines.length ? (
          <ul className="am-plan__list">
            {lines.slice(0, MAX_LIST).map((line) => (
              <li key={line}>
                <span className="am-plan__check"><Check size={10} strokeWidth={3} aria-hidden /></span>
                <span>{line}</span>
              </li>
            ))}
            {extra > 0 ? <li className="am-plan__more">+{extra} more benefit{extra > 1 ? "s" : ""}</li> : null}
          </ul>
        ) : null}
        <div className="am-plan__spacer" />
        <p className="am-plan__price">
          <strong>{formatRupee(item.price)}</strong>
          {item.mrp > item.price ? <s>{formatRupee(item.mrp)}</s> : null}
          {discount > 0 ? <span className="am-plan__off">{discount}% OFF</span> : null}
        </p>
        <button type="button" className="am-plan__cta" disabled={busy} onClick={() => onAction(item)}>
          {busy ? "Please wait..." : planCta(item, { owned })} {!busy ? <ArrowRight size={14} aria-hidden /> : null}
        </button>
      </div>
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
    if (!isCarePlan(item)) {
      requireAuth("Sign in to book a consultation.").then((ok) => {
        if (ok) navigate("/consult");
      });
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
