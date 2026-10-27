import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, HeartPulse, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Button, EmptyState, ErrorState, SkeletonGrid } from "../components/ui";
import { showSuccessToast } from "../config/key";
import { formatRupee } from "../home/catalog";
import { loadRazorpay, normalizeRazorpayContact } from "../payment/razorpay";
import { isAuthenticated, requireAuth } from "../services/guestAuth";
import { loadConsultPackages, loadPackageKinds, purchasePackage, verifyPackagePayment } from "../services/packageService";
import { user_profile } from "../services/profileService";
import "../design/pages/packages-premium.css";

const FEATURED_BADGES = new Set(["POPULAR", "BESTSELLER"]);
const TRUST = ["Experienced practitioners", "Personalised guidance", "Care led by experts"];

const iconFor = (name) => {
  const label = String(name || "").toLowerCase();
  if (label.includes("consult") || label.includes("doctor")) return Stethoscope;
  if (label.includes("personal") || label.includes("diet") || label.includes("wellness")) return HeartPulse;
  return Sparkles;
};

const toPaise = (rupees) => {
  const amount = Number(rupees);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
};

function PlanCard({ item, busy, onAction }) {
  const hasMrp = item.mrp && item.mrp > item.price;
  const off = hasMrp ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;
  const featured = FEATURED_BADGES.has(String(item.badge || "").toUpperCase());
  const label = item.mode === "purchase" ? "Buy plan" : "Book consult";
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
      <button type="button" className="pp-card__cta" disabled={busy} onClick={() => onAction(item)}>
        {busy ? "Please wait…" : label} {!busy ? <ArrowRight size={15} aria-hidden /> : null}
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
  const [buyingId, setBuyingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
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
      const [nextPlans, nextKinds] = await Promise.all([loadConsultPackages(), loadPackageKinds()]);
      setPlans(nextPlans);
      setKinds(nextKinds);
    } catch (err) {
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

  const buyPlan = async (item) => {
    if (!(await requireAuth("Sign in to buy this package."))) return;
    setBuyingId(item.id);
    try {
      const result = await purchasePackage(item.id);
      if (!result?.success) {
        showSuccessToast(result?.message || "Could not start payment.", "error");
        return;
      }
      const data = result.data || {};
      const purchase = data.purchase || {};
      const checkout = data.checkout || {};
      const key = String(data.razorpay_key || "").trim();
      const orderId = String(checkout.razorpay_order_id || purchase.razorpay_order_id || "").trim();
      const subscriptionId = String(
        checkout.razorpay_subscription_id || purchase.razorpay_subscription_id || "",
      ).trim();
      const isSubscription = checkout.type === "subscription" || (!orderId && Boolean(subscriptionId));
      if (!key || (isSubscription ? !subscriptionId : !orderId)) {
        showSuccessToast("Payment gateway not ready. Please try again.", "error");
        return;
      }
      const amount = toPaise(purchase.paid_price ?? item.price);
      if (!isSubscription && amount <= 0) {
        showSuccessToast("Invalid package amount.", "error");
        return;
      }
      let profile = {};
      try {
        const res = await user_profile();
        profile = res?.data || {};
      } catch {
        profile = {};
      }
      const customerName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
        || profile.full_name
        || "AyurMuni Customer";
      const Razorpay = await loadRazorpay();
      await new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const rzp = new Razorpay({
          key,
          ...(isSubscription ? { subscription_id: subscriptionId } : { amount, order_id: orderId }),
          currency: purchase.currency || "INR",
          name: "AyurMuni",
          description: item.name,
          prefill: {
            name: customerName,
            email: profile.email || "customer@ayurmuni.com",
            contact: normalizeRazorpayContact(profile.phone_number || profile.mobile || profile.phone),
          },
          theme: { color: "#0D614E" },
          handler: async (response) => {
            try {
              const verify = await verifyPackagePayment({
                purchase_id: purchase.id,
                ...(isSubscription
                  ? { razorpay_subscription_id: response.razorpay_subscription_id || subscriptionId }
                  : { razorpay_order_id: response.razorpay_order_id || orderId }),
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (verify?.success) {
                showSuccessToast(verify?.message || "Package activated successfully.", "success");
              } else {
                showSuccessToast(verify?.message || "Payment verification failed.", "error");
              }
            } finally {
              finish();
            }
          },
          modal: {
            ondismiss: () => {
              if (settled) return;
              showSuccessToast("Payment cancelled. You can try again anytime.", "error");
              finish();
            },
          },
        });
        rzp.on("payment.failed", () => {
          if (settled) return;
          showSuccessToast("Unable to complete payment. Please try again.", "error");
          finish();
        });
        rzp.open();
      });
    } catch (err) {
      showSuccessToast(err?.message || "Unable to start payment.", "error");
    } finally {
      setBuyingId("");
    }
  };

  const onAction = (item) => {
    if (item.mode === "consult") {
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
          <ErrorState title="Could not load packages" description={error} onRetry={load} />
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
