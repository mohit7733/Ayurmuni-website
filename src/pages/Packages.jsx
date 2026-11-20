import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Award, Calendar, Check, HeartPulse, Leaf, ShieldCheck, Sparkles, Star, Stethoscope } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Button, EmptyState, ErrorState, SkeletonGrid } from "../components/ui";
import { formatPlanMoney, getPlanTheme, isCarePlan, planCta, planDiscount, planDuration, railThemeTones, themeStyle } from "../packages/planTheme";
import PackagePaymentModal from "../components/PackagePaymentModal";
import usePackagePurchase from "../hooks/usePackagePurchase";
import { isAuthenticated, requireAuth } from "../services/guestAuth";
import { loadPackageKinds, loadPackagesWithStatus } from "../services/packageService";
import "../design/pages/packages-premium.css";

const TRUST = ["Experienced practitioners", "Personalised guidance", "Care led by experts"];
const MAX_LIST = 3;

const iconFor = (name) => {
  const label = String(name || "").toLowerCase();
  if (label.includes("consult") || label.includes("doctor")) return Stethoscope;
  if (label.includes("personal") || label.includes("diet") || label.includes("wellness")) return HeartPulse;
  return Sparkles;
};

function PlanCard({ item, busy, onAction, highlight = false, tone = 0 }) {
  const [imageFailed, setImageFailed] = useState(false);
  const care = isCarePlan(item);
  const discount = planDiscount(item);
  const lines = item.includes || [];
  const shown = lines.slice(0, MAX_LIST);
  const extra = lines.length - shown.length;
  const detailPath = `/packages/${encodeURIComponent(item.id)}`;
  const saving = item.mrp > item.price ? item.mrp - item.price : 0;
  const banner = Boolean(item.image) && !imageFailed;

  return (
    <article
      className={`pp-card${highlight ? " is-highlight" : ""}`}
      style={themeStyle(getPlanTheme(item, tone))}
      aria-label={item.name}
    >
      <div className="pp-card__banner" aria-hidden>
        {banner ? (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="pp-card__fall">
            <Leaf size={26} strokeWidth={1.5} />
            <span>AyurMuni Care</span>
          </div>
        )}
        <span className="pp-card__shade" />
        <div className="pp-card__flags">
          {care ? (
            <span className="pp-card__badge"><Star size={10} aria-hidden /> Care plan</span>
          ) : (
            <span className="pp-card__badge is-quiet">{item.group || "Plan"}</span>
          )}
          {discount > 0 ? <span className="pp-card__off">{discount}% OFF</span> : null}
        </div>
      </div>

      <div className="pp-card__content">
        <h3 className="pp-card__name">
          <Link className="pp-card__link" to={detailPath}>
            {item.name}
          </Link>
        </h3>
        <p className="pp-card__dur">
          <Calendar size={11} aria-hidden />
          {planDuration(item)}
        </p>

        {shown.length ? (
          <ul className="pp-card__list">
            {shown.map((line, index) => (
              <li key={`${line}-${index}`}>
                <Check size={12} strokeWidth={3} aria-hidden />
                <span>{line}</span>
              </li>
            ))}
            {extra > 0 ? <li className="pp-card__more">+{extra} more benefits</li> : null}
          </ul>
        ) : null}

        <div className="pp-card__price">
          <div className="pp-card__price-main">
            <strong>{formatPlanMoney(item.price)}</strong>
            {item.mrp > item.price ? <s>{formatPlanMoney(item.mrp)}</s> : null}
          </div>
          {saving > 0 ? <span className="pp-card__save">Save {formatPlanMoney(saving)}</span> : null}
        </div>

        <button
          type="button"
          className="pp-card__cta"
          disabled={busy}
          onClick={() => onAction(item)}
        >
          {busy ? "Please wait..." : planCta(item)}
          {!busy ? <ArrowRight size={14} aria-hidden /> : null}
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

  // verify-payment succeeded: reload the catalog. The card stays buyable.
  const onPurchased = useCallback(async () => {
    await load({ silent: true });
  }, [load]);
  const { start: buyPlan, busyId: buyingId, sheet: paymentSheet } = usePackagePurchase({ onPurchased });

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
        <div className="pp-atmosphere" aria-hidden />
        <header className="pp-head">
          <button type="button" className="pp-head__back" onClick={() => navigate("/home")} aria-label="Back to home">
            <ArrowLeft size={18} aria-hidden />
          </button>
          <div className="pp-head__copy">
            <p className="pp-head__eyebrow">AyurMuni care</p>
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
              const highlightId = group.plans.reduce((best, plan) => {
                if (!best) return plan.id;
                const current = group.plans.find((entry) => entry.id === best);
                return planDiscount(plan) > planDiscount(current) ? plan.id : best;
              }, group.plans[0]?.id);
              return (
                <section className="pp-group" key={group.id} aria-labelledby={`pp-${group.id}`}>
                  <header className="pp-group__head">
                    <span className="pp-group__icon"><Icon size={16} aria-hidden /></span>
                    <div className="pp-group__titles">
                      <div className="pp-group__title-row">
                        <h2 id={`pp-${group.id}`}>{group.name}</h2>
                        <span className="pp-group__count">{group.plans.length} {group.plans.length === 1 ? "plan" : "plans"}</span>
                      </div>
                      <p>{group.description || "Plans in this category."}</p>
                    </div>
                  </header>
                  <div className="pp-grid" data-count={Math.min(group.plans.length, 4)}>
                    {(() => {
                      const tones = railThemeTones(group.plans);
                      return group.plans.map((item, index) => (
                        <PlanCard
                          key={item.id}
                          item={item}
                          tone={tones[index]}
                          busy={buyingId === item.id}
                          onAction={onAction}
                          highlight={item.id === highlightId && planDiscount(item) > 0}
                        />
                      ));
                    })()}
                  </div>
                </section>
              );
            })
          : null}

        <PackagePaymentModal {...paymentSheet} />

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
