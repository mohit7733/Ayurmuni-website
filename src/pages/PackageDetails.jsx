import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Calendar, Check, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Button, EmptyState, ErrorState } from "../components/ui";
import { formatRupee } from "../home/catalog";
import PlanTransferModal from "../components/PlanTransferModal";
import usePackagePurchase from "../hooks/usePackagePurchase";
import { isAuthenticated, requireAuth } from "../services/guestAuth";
import { loadPackageById } from "../services/packageService";
import "../design/pages/packages-premium.css";

const formatDate = (value) => {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  return new Date(time).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export default function PackageDetails() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);


  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    const authed = await isAuthenticated();
    if (!authed) {
      setNeedsLogin(true);
      setLoading(false);
      return;
    }
    setNeedsLogin(false);
    try {
      setItem(await loadPackageById(packageId));
    } catch (err) {
      if (!silent) setError(err?.message || "Could not load this package.");
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    load();
  }, [load]);

  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/packages");
  };

  const onPurchased = useCallback(async () => {
    setItem((current) => (current ? { ...current, purchased: true } : current));
    await load({ silent: true });
  }, [load]);
  const { start, busyId, prompt, confirm, cancel } = usePackagePurchase({ onPurchased });
  const busy = Boolean(busyId);
  const buy = () => {
    if (item) start(item);
  };

  const onCta = () => {
    if (!item) return;
    if (item.mode === "consult" || item.purchased) {
      requireAuth("Sign in to book a consultation.").then((ok) => {
        if (ok) navigate("/consult");
      });
      return;
    }
    buy();
  };

  const owned = Boolean(item && item.mode === "purchase" && item.purchased);
  const hasMrp = item && item.mrp && item.mrp > item.price;
  const off = hasMrp ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;
  const ctaLabel = owned ? "Book a consultation" : item?.mode === "purchase" ? "Buy plan" : "Book consult";

  return (
    <AppShell tab="home">
      <section className="pp-page pd-page">
        <header className="pp-head">
          <button type="button" className="pp-head__back" onClick={back} aria-label="Back">
            <ArrowLeft size={18} aria-hidden />
          </button>
          <div className="pp-head__copy">
            <h1 className="pp-head__title">Package details</h1>
          </div>
        </header>

        {loading ? <div className="pd-skeleton" aria-busy="true" aria-label="Loading package" /> : null}

        {!loading && needsLogin ? (
          <EmptyState
            title="Sign in to view this package"
            description="Package details are available on your AyurMuni account."
            action={<Button variant="primary" onClick={() => requireAuth("Sign in to view packages.")}>Sign in</Button>}
          />
        ) : null}

        {!loading && error ? <ErrorState title="Could not load package" description={error} onRetry={() => load()} /> : null}

        {!loading && !needsLogin && !error && !item ? (
          <EmptyState
            title="Package not found"
            description="This package may have been unpublished."
            action={<Button variant="primary" onClick={() => navigate("/packages")}>View all packages</Button>}
          />
        ) : null}

        {!loading && !error && item ? (
          <div className="pd-layout">
            <article className={`pd-hero${owned ? " is-owned" : ""}`}>
              <div className="pd-hero__top">
                {owned ? (
                  <span className="pp-card__owned is-light"><CheckCircle2 size={12} aria-hidden /> Active - Purchased</span>
                ) : item.badge ? (
                  <span className="pd-hero__badge">{item.badge}</span>
                ) : <span className="pd-hero__badge is-quiet">{item.group}</span>}
                {off > 0 && !owned ? <span className="pd-hero__off">{off}% off</span> : null}
              </div>
              <h2 className="pd-hero__name">{item.name}</h2>
              <p className="pd-hero__price">
                <strong>{formatRupee(item.price)}</strong>
                {hasMrp ? <s>{formatRupee(item.mrp)}</s> : null}
              </p>
              <ul className="pd-hero__meta">
                {item.duration ? <li><Clock size={13} aria-hidden /> Valid {item.duration}</li> : null}
                {item.sessions ? <li><Calendar size={13} aria-hidden /> {item.sessions} {item.sessions === 1 ? "session" : "sessions"}</li> : null}
                <li><ShieldCheck size={13} aria-hidden /> {item.group}</li>
              </ul>
              {owned && (item.remaining != null || item.expiresAt) ? (
                <p className="pd-hero__status">
                  {item.remaining != null ? `${item.remaining} ${item.remaining === 1 ? "session" : "sessions"} left` : ""}
                  {item.remaining != null && item.expiresAt ? " - " : ""}
                  {item.expiresAt && formatDate(item.expiresAt) ? `valid till ${formatDate(item.expiresAt)}` : ""}
                </p>
              ) : null}
              <button type="button" className="pd-hero__cta" disabled={busy} onClick={onCta}>
                {busy ? "Please wait..." : ctaLabel} {!busy ? <ArrowRight size={15} aria-hidden /> : null}
              </button>
            </article>

            <div className="pd-body">
              {item.description ? (
                <section className="pd-card">
                  <h3>About this plan</h3>
                  <p>{item.description}</p>
                </section>
              ) : null}
              {item.includes?.length ? (
                <section className="pd-card">
                  <h3>What is included</h3>
                  <ul className="pp-card__list pd-list">
                    {item.includes.map((line) => (
                      <li key={line}>
                        <Check size={14} aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {!item.description && !item.includes?.length ? (
                <section className="pd-card">
                  <h3>About this plan</h3>
                  <p>Our care team will guide you through this plan. Reach out any time for details.</p>
                </section>
              ) : null}
            </div>
          </div>
        ) : null}
        <PlanTransferModal prompt={prompt} onYes={confirm} onNo={cancel} />
      </section>
    </AppShell>
  );
}