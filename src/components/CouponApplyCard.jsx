import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Clipboard, Tag, X } from "lucide-react";
import { formatRupee } from "../home/catalog";
import { showSuccessToast } from "../config/key";
import {
  calcCouponDiscount,
  couponMatchesScope,
  couponMinNote,
  couponOfferTitle,
  couponSavingsLabel,
} from "../rewards/utils";
import "../design/coupon-apply-card.css";

export default function CouponApplyCard({
  coupons = [],
  eligibleCoupons,
  cartAmount = 0,
  loading = false,
  applied,
  discount,
  payable,
  error,
  checkoutScope,
  onApply,
  onRemove,
}) {
  const [code, setCode] = useState("");
  const [offersOpen, setOffersOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const scopedCoupons = useMemo(() => {
    if (!checkoutScope) return coupons;

    return coupons.filter((item) => couponMatchesScope(item, checkoutScope));
  }, [coupons, checkoutScope]);

  const eligibleList = useMemo(() => {
    const source = eligibleCoupons != null ? eligibleCoupons : scopedCoupons;

    return source.filter((item) => {
      if (checkoutScope && !couponMatchesScope(item, checkoutScope)) {
        return false;
      }

      return true;
    });
  }, [eligibleCoupons, scopedCoupons, checkoutScope]);

  const preview = useMemo(
    () =>
      eligibleList
        .filter((item) => calcCouponDiscount(item, cartAmount).ok)
        .slice(0, 2),
    [eligibleList, cartAmount],
  );

  const submit = async (raw = code) => {
    const next = String(raw ?? "")
      .trim()
      .toUpperCase();

    if (!next) {
      showSuccessToast("Enter a coupon code", "error");
      return;
    }

    if (applying || typeof onApply !== "function") return;

    setApplying(true);

    try {
      const result = await onApply(next);
      const ok = result === true || (typeof result === "object" && result?.ok);

      if (ok) {
        setCode("");
        setOffersOpen(false);
        showSuccessToast(`Coupon ${next} applied`, "success");
      } else if (typeof result === "object" && result?.error) {
        showSuccessToast(result.error, "error");
      }
    } catch {
      showSuccessToast("Unable to apply coupon. Please try again.", "error");
    } finally {
      setApplying(false);
    }
  };

  const pasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const next = String(text || "")
        .trim()
        .toUpperCase();

      if (!next) {
        showSuccessToast("Clipboard is empty", "error");
        return;
      }

      setCode(next);
    } catch {
      showSuccessToast("Could not paste code", "error");
    }
  };

  const offerCount = scopedCoupons.length;
  const isConsultation = checkoutScope === "consultation";

  return (
    <section className="cac" aria-labelledby="cac-title">
      <header className="cac__header">
        <span className="cac__icon" aria-hidden="true">
          <Tag size={19} />
        </span>

        <div className="cac__heading">
          <h3 id="cac-title">Apply coupon</h3>
          <p>
            {loading
              ? "Finding the best offers for you…"
              : offerCount
                ? `${offerCount} ${isConsultation ? "consultation" : "available"} offer${offerCount === 1 ? "" : "s"}`
                : "Have a coupon code? Apply it here."}
          </p>
        </div>

        {applied ? (
          <span className="cac__applied-indicator" title="Coupon applied">
            <Check size={16} />
          </span>
        ) : null}
      </header>

      {applied ? (
        <div className="cac__applied">
          <span className="cac__applied-check" aria-hidden="true">
            <Check size={16} />
          </span>

          <div className="cac__applied-copy">
            <strong>{applied.code}</strong>
            <p>
              Saving {formatRupee(discount, { decimals: 2 })}
              {Number(payable) > 0
                ? ` · Payable ${formatRupee(payable, { decimals: 2 })}`
                : ""}
            </p>
          </div>

          <button
            type="button"
            className="cac__remove"
            onClick={onRemove}
            disabled={applying}
          >
            <X size={14} />
            <span>Remove</span>
          </button>
        </div>
      ) : (
        <>
          <form
            className="cac__form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="cac__input-wrap">
              <span className="cac__sr-only">Coupon code</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={error ? "cac-error" : undefined}
              />
            </label>

            <button
              type="button"
              className="cac__paste"
              onClick={pasteCode}
              aria-label="Paste coupon code"
              title="Paste coupon code"
            >
              <Clipboard size={15} />
              <span>Paste</span>
            </button>

            <button
              type="submit"
              className="cac__apply"
              disabled={applying || !code.trim()}
            >
              {applying ? "Applying…" : "Apply"}
            </button>
          </form>

          {error ? (
            <p className="cac__error" id="cac-error" role="alert">
              {error}
            </p>
          ) : null}

          {preview.length > 0 ? (
            <div className="cac__quick-offers">
              {preview.map((item) => (
                <button
                  key={item.id || item.code}
                  type="button"
                  className="cac__quick-offer"
                  onClick={() => submit(item.code)}
                  disabled={applying}
                >
                  <span className="cac__code">{item.code}</span>
                  <span className="cac__quick-copy">
                    <strong>{couponSavingsLabel(item)}</strong>
                    {couponMinNote(item) ? (
                      <small>{couponMinNote(item)}</small>
                    ) : null}
                  </span>
                  <span className="cac__quick-action">Apply</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}

      <div className="cac__offers-toggle">
        <span>
          {offersOpen ? "Choose an offer" : "Looking for a better deal?"}
        </span>

        <button
          type="button"
          className="cac__view-all"
          onClick={() => setOffersOpen((open) => !open)}
          aria-expanded={offersOpen}
          aria-controls="cac-offer-list"
        >
          {offersOpen ? "Show less" : "View all offers"}
          {offersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {offersOpen ? (
        <div className="cac__offers" id="cac-offer-list">
          {loading ? (
            <p className="cac__empty">Loading available offers…</p>
          ) : scopedCoupons.length ? (
            scopedCoupons.map((item) => {
              const gate = calcCouponDiscount(item, cartAmount);
              const isApplied =
                String(applied?.code || "").toUpperCase() ===
                String(item.code || "").toUpperCase();

              return (
                <article
                  key={item.id || item.code}
                  className={`cac__offer${isApplied ? " is-applied" : ""}${!gate.ok ? " is-ineligible" : ""}`}
                >
                  <div className="cac__offer-mark" aria-hidden="true">
                    {isApplied ? <Check size={17} /> : <Tag size={17} />}
                  </div>

                  <div className="cac__offer-content">
                    <div className="cac__offer-top">
                      <strong className="cac__code">{item.code}</strong>
                      {isApplied ? (
                        <span className="cac__status">Applied</span>
                      ) : null}
                    </div>

                    <p className="cac__offer-title">{couponOfferTitle(item)}</p>

                    {couponMinNote(item) ? (
                      <small className="cac__offer-note">
                        {couponMinNote(item)}
                      </small>
                    ) : null}

                    {!gate.ok && gate.error ? (
                      <small className="cac__offer-reason">{gate.error}</small>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className={`cac__offer-button${isApplied ? " is-applied" : ""}`}
                    disabled={applying || !gate.ok || isApplied}
                    onClick={() => submit(item.code)}
                  >
                    {isApplied ? "Applied" : "Apply"}
                  </button>
                </article>
              );
            })
          ) : (
            <p className="cac__empty">
              No coupons are available for this booking right now.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
