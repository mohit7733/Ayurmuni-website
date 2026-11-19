import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Calendar, Check, CreditCard, Leaf, ShieldCheck, Star, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Button, EmptyState, ErrorState, SectionHold } from "../components/ui";
import { formatPlanMoney, getPlanTheme, isCarePlan, planBilling, planCta, planDiscount, planDuration, themeStyle } from "../packages/planTheme";
import PackagePaymentModal from "../components/PackagePaymentModal";
import usePackagePurchase from "../hooks/usePackagePurchase";
import { isAuthenticated, requireAuth } from "../services/guestAuth";
import { loadPackageById } from "../services/packageService";
import { trackMetaViewContent } from "../services/metaPixel";
import "../design/pages/packages-premium.css";

const rate = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`;
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

  useEffect(() => {
    if (!item?.id) return;
    trackMetaViewContent({
      contentIds: [String(item.id)],
      contentType: "product",
      contentName: item.name || item.title,
      value: Number(item.fees?.totalPayable || item.price) || undefined,
      currency: "INR",
    });
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- once per package load

  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/packages");
  };

  const onPurchased = useCallback(async () => {
    await load({ silent: true });
  }, [load]);
  const { start, busyId, sheet } = usePackagePurchase({ onPurchased });
  const busy = Boolean(busyId);

  const onCta = () => {
    if (!item) return;
    if (!isCarePlan(item)) {
      requireAuth("Sign in to book a consultation.").then((ok) => {
        if (ok) navigate("/consult");
      });
      return;
    }
    start(item);
  };

  const discount = item ? planDiscount(item) : 0;
  const saving = item && item.mrp > item.price ? item.mrp - item.price : 0;
  const gst = Number(item?.fees?.gstAmount) || 0;
  const platform = Number(item?.fees?.platformFee) || 0;
  const payable = Number(item?.fees?.totalPayable) > 0 ? Number(item.fees.totalPayable) : item?.price || 0;
  const ctaLabel = item ? planCta(item) : "";

  return (
    <AppShell tab="home">
      <section className="pp-page">
        <header className="pp-head">
          <button type="button" className="pp-head__back" onClick={back} aria-label="Back">
            <ArrowLeft size={18} aria-hidden />
          </button>
          <div className="pp-head__copy">
            <p className="pp-head__eyebrow">AyurMuni care</p>
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
          <article className="pp-detail" style={themeStyle(getPlanTheme(item))}>
            <div className="pp-detail__hero">
              <div className="pp-detail__hero-top">
                {isCarePlan(item) ? (
                  <span className="pp-detail__badge"><Star size={10} aria-hidden /> Care plan</span>
                ) : (
                  <span className="pp-detail__badge is-quiet">{item.group}</span>
                )}
                {discount > 0 ? <span className="pp-detail__off">{discount}% OFF</span> : null}
              </div>
              <div className="pp-detail__media" aria-hidden>
                {item.image ? (
                  <img src={item.image} alt="" />
                ) : (
                  <div className="pp-detail__fall">
                    <Leaf size={34} strokeWidth={1.5} />
                    <span>AyurMuni Care</span>
                  </div>
                )}
              </div>
              <h2 className="pp-detail__name">{item.name}</h2>
              <p className="pp-detail__dur">{planDuration(item)}</p>
              <div className="pp-detail__price-row">
                <strong>{formatPlanMoney(payable)}</strong>
                {item.mrp > item.price ? <s>{formatPlanMoney(item.mrp)}</s> : null}
              </div>
              {saving > 0 ? <p className="pp-detail__note">You save {formatPlanMoney(saving)}</p> : null}
              <button type="button" className="pp-detail__cta" disabled={busy} onClick={onCta}>
                {busy ? "Please wait..." : ctaLabel}
                {!busy ? <ArrowRight size={15} aria-hidden /> : null}
              </button>
            </div>

            <div className="pp-detail__body">
              {item.description ? (
                <section className="pp-detail__panel">
                  <h3>About this plan</h3>
                  <p>{item.description}</p>
                </section>
              ) : null}

              <section className="pp-detail__panel">
                <h3>Plan overview</h3>
                <ul className="pp-detail__facts">
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
                  {/* <li>
                    <CreditCard size={15} aria-hidden />
                    <span>
                      <small>Billing</small>
                      <strong>{planBilling(item)}</strong>
                    </span>
                  </li> */}
                  {/* <li>
                    <Users size={15} aria-hidden />
                    <span>
                      <small>Available for</small>
                      <strong>{item.availableToAll ? "All users" : "Selected users"}</strong>
                    </span>
                  </li> */}
                </ul>
              </section>

              <div className="pp-detail__includes">
                {item.includes?.length ? (
                  <section className="pp-detail__panel">
                    <h3>What&apos;s included ({item.includes.length})</h3>
                    <ul className="pp-detail__benefits">
                      {item.includes.map((line, index) => (
                        <li key={`${line}-${index}`}>
                          <span className="pp-detail__check"><Check size={12} strokeWidth={3} aria-hidden /></span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {item.notIncluded?.length ? (
                  <section className="pp-detail__panel">
                    <h3>Not included</h3>
                    <ul className="pp-detail__exclude">
                      {item.notIncluded.map((line, index) => (
                        <li key={`${line}-${index}`}>{line}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>

              {item.disclaimer?.length ? (
                <section className="pp-detail__panel">
                  <h3>Disclaimer</h3>
                  <ul className="pp-detail__exclude">
                    {item.disclaimer.map((line, index) => (
                      <li key={`${line}-${index}`}>{line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="pp-detail__panel">
                <h3>Price details</h3>
                <div className="pp-detail__bill">
                  <div>
                    <span>Plan price</span>
                    <span>{formatPlanMoney(item.mrp || item.price)}</span>
                  </div>
                  {saving > 0 ? (
                    <div className="is-save">
                      <span>Discount ({discount}%)</span>
                      <span>- {formatPlanMoney(saving)}</span>
                    </div>
                  ) : null}
                  <div>
                    <span>Package price</span>
                    <span>{formatPlanMoney(item.price)}</span>
                  </div>
                  {gst > 0 ? (
                    <div>
                      <span>GST{rate(item.fees?.gstPercent) ? ` (${rate(item.fees.gstPercent)})` : ""}</span>
                      <span>{formatPlanMoney(gst)}</span>
                    </div>
                  ) : null}
                  {platform > 0 ? (
                    <div>
                      <span>Platform fee{rate(item.fees?.platformFeePercent) ? ` (${rate(item.fees.platformFeePercent)})` : ""}</span>
                      <span>{formatPlanMoney(platform)}</span>
                    </div>
                  ) : null}
                  <div className="is-total">
                    <span>Total payable</span>
                    <strong>{formatPlanMoney(payable)}</strong>
                  </div>
                </div>
              </section>
            </div>
          </article>
        ) : null}

        <PackagePaymentModal {...sheet} />
      </section>
    </AppShell>
  );
}
