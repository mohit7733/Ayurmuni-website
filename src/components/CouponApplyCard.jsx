import { useMemo, useState } from 'react';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';
import {
  calcCouponDiscount,
  couponMatchesScope,
  couponMinNote,
  couponOfferTitle,
  couponSavingsLabel,
} from '../rewards/utils';

export default function CouponApplyCard({
  coupons = [],
  eligibleCoupons,
  cartAmount = 0,
  loading,
  applied,
  discount,
  payable,
  error,
  checkoutScope,
  onApply,
  onRemove,
}) {
  const [code, setCode] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const scopedCoupons = useMemo(() => {
    if (!checkoutScope) return coupons;
    return coupons.filter((item) => couponMatchesScope(item, checkoutScope));
  }, [coupons, checkoutScope]);

  const preview = useMemo(() => {
    const eligible =
      eligibleCoupons != null
        ? eligibleCoupons.filter((item) =>
            checkoutScope ? couponMatchesScope(item, checkoutScope) : true,
          )
        : scopedCoupons.filter((item) => calcCouponDiscount(item, cartAmount).ok);
    return eligible.slice(0, 2);
  }, [eligibleCoupons, scopedCoupons, cartAmount, checkoutScope]);

  const submit = async (raw) => {
    const next = String(raw ?? code)
      .trim()
      .toUpperCase();
    if (!next) {
      showSuccessToast('Enter a coupon code', 'error');
      return;
    }
    if (applying) return;
    setApplying(true);
    try {
      const result = await onApply(next);
      const ok = result === true || (typeof result === 'object' && result?.ok);
      if (ok) {
        setCode('');
        setSheetOpen(false);
        showSuccessToast(`Coupon ${next} applied`, 'success');
      } else if (typeof result === 'object' && result?.error) {
        showSuccessToast(result.error, 'error');
      }
    } finally {
      setApplying(false);
    }
  };

  const pasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const next = String(text || '').trim().toUpperCase();
      if (!next) {
        showSuccessToast('Clipboard is empty', 'error');
        return;
      }
      setCode(next);
    } catch {
      showSuccessToast('Could not paste code', 'error');
    }
  };

  return (
    <div className="coupon-card">
      <header className="coupon-card-head">
        <div>
          <h3>Apply coupon</h3>
          <p>
            {checkoutScope === 'consultation'
              ? scopedCoupons.length
                ? `${scopedCoupons.length} consult offer${scopedCoupons.length > 1 ? 's' : ''}`
                : 'No consultation coupons available'
              : scopedCoupons.length
                ? `${scopedCoupons.length} order offer${scopedCoupons.length > 1 ? 's' : ''}`
                : 'Enter a code or browse offers'}
          </p>
        </div>
        <button type="button" className="text-back" onClick={() => setSheetOpen(true)}>
          View all
        </button>
      </header>

      {applied ? (
        <div className="coupon-applied">
          <div>
            <strong>{applied.code}</strong>
            <p>
              You save {formatRupee(discount, { decimals: 2 })}
              {Number(payable) > 0 ? ` · Payable ${formatRupee(payable, { decimals: 2 })}` : ''}
            </p>
          </div>
          <button type="button" className="text-back" onClick={onRemove}>
            Remove
          </button>
        </div>
      ) : (
        <>
          <div className="coupon-input-row">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              autoCapitalize="characters"
            />
            <button type="button" className="ghost" onClick={pasteCode}>
              Paste
            </button>
            <button type="button" className="cta" disabled={applying} onClick={() => submit()}>
              {applying ? 'Applying…' : 'Apply'}
            </button>
          </div>
          {error ? <p className="coupon-error">{error}</p> : null}
          {loading ? <p className="muted">Loading offers…</p> : null}
          {preview.map((item) => (
            <button
              key={item.id || item.code}
              type="button"
              className="coupon-preview"
              onClick={() => submit(item.code)}
              disabled={applying}
            >
              <strong>{item.code}</strong>
              <span>{couponSavingsLabel(item)}</span>
              {couponMinNote(item) ? <small>{couponMinNote(item)}</small> : null}
            </button>
          ))}
        </>
      )}

      {sheetOpen ? (
        <div className="web-modal" role="dialog" onClick={() => setSheetOpen(false)}>
          <div className="web-modal-card coupon-sheet" onClick={(event) => event.stopPropagation()}>
            <header className="coupon-card-head">
              <div>
                <h3>Available offers</h3>
                <p>{scopedCoupons.length} coupon{scopedCoupons.length === 1 ? '' : 's'}</p>
              </div>
              <button type="button" className="text-back" onClick={() => setSheetOpen(false)}>
                Close
              </button>
            </header>
            {scopedCoupons.length ? (
              scopedCoupons.map((item) => {
                const gate = calcCouponDiscount(item, cartAmount);
                return (
                  <article key={item.id || item.code} className="coupon-offer">
                    <div>
                      <strong>{item.code}</strong>
                      <p>{couponOfferTitle(item)}</p>
                      {couponMinNote(item) ? <small>{couponMinNote(item)}</small> : null}
                      {!gate.ok && gate.error ? <small className="coupon-error">{gate.error}</small> : null}
                    </div>
                    <button
                      type="button"
                      className="cta"
                      disabled={applying || !gate.ok}
                      onClick={() => submit(item.code)}
                    >
                      Apply
                    </button>
                  </article>
                );
              })
            ) : (
              <p className="muted">No coupons available right now.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
