import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Calendar, Check, CreditCard, ShieldCheck, Star, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Button, EmptyState, ErrorState, SectionHold } from "../components/ui";
import { formatRupee } from "../home/catalog";
import PlanTransferModal from "../components/PlanTransferModal";
import usePackagePurchase from "../hooks/usePackagePurchase";
import { isAuthenticated, requireAuth } from "../services/guestAuth";
import { loadPackageById } from "../services/packageService";
import PlanMark from "../packages/PlanMark";
import { getPlanTheme, isCarePlan, planBilling, planCta, planDiscount, planDuration, themeStyle } from "../packages/planTheme";
import "../design/pages/packages-premium.css";
import "../design/pages/plan-cards.css";

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
    if (!isCarePlan(item)) {
      requireAuth("Sign in to book a consultation.").then((ok) => {
        if (ok) navigate("/consult");
      });
      return;
    }
    buy();
  };

  const owned = Boolean(item && item.mode === "purchase" && item.purchased);
  const theme = item ? getPlanTheme(item) : null;
  const discount = item ? planDiscount(item) : 0;
  const saving = item && item.mrp > item.price ? item.mrp - item.price : 0;
  const ctaLabel = item ? planCta(item, { owned }) : "";

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

        {loading ? <SectionHold label="Loading package" minHeight={320} /> : null}

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
          <article className="am-detail" style={themeStyle(theme)}>
            <div className="am-detail__head">
              <div className="am-detail__row">
                <span className="am-detail__icon">
                  {item.image ? <img src={item.image} alt="" /> : <PlanMark name={theme.icon} size={20} color="#fff" />}
                </span>
                <span className="am-detail__cat">{item.group}</span>
                {isCarePlan(item) ? (
                  <span className="am-detail__ribbon"><Star size={10} aria-hidden /> CARE PLAN</span>
                ) : null}
              </div>
              <h2>{item.name}</h2>
              <p className="am-detail__dur">{planDuration(item)}</p>
              <span className="am-detail__line" />
            </div>
            {item.description ? <p className="am-detail__desc">{item.description}</p> : null}
            {owned && (item.remaining != null || item.expiresAt) ? (
              <p className="am-detail__note">
                {item.remaining != null ? `${item.remaining} ${item.remaining === 1 ? "session" : "sessions"} left` : ""}
                {item.remaining != null && item.expiresAt ? " · " : ""}
                {item.expiresAt && formatDate(item.expiresAt) ? `valid till ${formatDate(item.expiresAt)}` : ""}
              </p>
            ) : null}
            <ul className="am-detail__facts">
              <li>
                <ShieldCheck size={15} aria-hidden />
                <span>
                  <small>Plan type</small>
                  <strong>{item.purchaseType === "prepaid_package" ? "Prepaid package" : "Open plan"}</strong>
                </span>
              </li>
              <li>
                <Calendar size={15} aria-hidden />
                <span>
                  <small>Validity</small>
                  <strong>{item.validityDays ? `${item.validityDays} days` : planDuration(item)}</strong>
                </span>
              </li>
              <li>
                <CreditCard size={15} aria-hidden />
                <span>
                  <small>Billing</small>
                  <strong>{planBilling(item)}</strong>
                </span>
              </li>
              <li>
                <Users size={15} aria-hidden />
                <span>
                  <small>Available for</small>
                  <strong>{item.availableToAll ? "All users" : "Selected users"}</strong>
                </span>
              </li>
            </ul>
            {item.includes?.length ? (
              <>
                <h3>What&apos;s included ({item.includes.length})</h3>
                <ul className="am-detail__benefits">
                  {item.includes.map((line) => (
                    <li key={line}>
                      <span className="am-detail__check"><Check size={12} strokeWidth={3} aria-hidden /></span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <h3>Price details</h3>
            <div className="am-detail__price">
              <div>
                <span>Plan price</span>
                <span>{formatRupee(item.mrp || item.price)}</span>
              </div>
              {saving > 0 ? (
                <div className="is-save">
                  <span>Discount ({discount}%)</span>
                  <span>- {formatRupee(saving)}</span>
                </div>
              ) : null}
              <div className="is-total">
                <span>You pay</span>
                <strong>{formatRupee(item.price)}</strong>
              </div>
            </div>
            <div className="am-detail__footer">
              <div>
                <p className="am-detail__pay">{formatRupee(item.price)}</p>
                {saving > 0 ? <p className="am-detail__save">You save {formatRupee(saving)}</p> : null}
              </div>
              <button type="button" className="am-detail__cta" disabled={busy} onClick={onCta}>
                {busy ? "Please wait..." : ctaLabel}
              </button>
            </div>
          </article>
        ) : null}
        <PlanTransferModal prompt={prompt} onYes={confirm} onNo={cancel} />
      </section>
    </AppShell>
  );
}