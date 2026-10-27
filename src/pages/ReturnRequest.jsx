import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Camera,
  Check,
  CreditCard,
  Landmark,
  Leaf,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  MetaChip,
} from '../components/detail/Detail';
import { Button, Disclaimer, Input, Textarea } from '../components/ui';
import { showSuccessToast } from '../config/key';
import { formatRupee, resolveImageUrl } from '../home/catalog';
import { requireAuth } from '../services/guestAuth';
import { extractOrderDetail, getOrderById } from '../services/orderService';
import {
  buildReasonOptions,
  buildReturnPayload,
  createReturnRequest,
  getPaymentSourceLabel,
  getReturnEligibility,
  MAX_RETURN_MEDIA,
  normalizeReturnEligibility,
  RETURN_REASONS,
  uploadReturnMedia,
  validateReturnForm,
} from '../services/returnService';
import { formatOrderId } from '../utils/formatDisplayId';
import '../design/pages/returns.css';

const formatShortDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isPast = (value) => {
  const t = new Date(value).getTime();
  return Number.isFinite(t) && t < Date.now();
};

export default function ReturnRequest() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const requestRef = useRef(0);
  const selectionTouchedRef = useRef(false);

  const [order, setOrder] = useState(location.state?.order || null);
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  /** order_item_id -> quantity to return */
  const [selected, setSelected] = useState({});
  const [media, setMedia] = useState([]);
  const [refundMethod, setRefundMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [holderName, setHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  // Kept from the first response so the list does not change while switching reasons.
  const [reasonOptions, setReasonOptions] = useState(RETURN_REASONS);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  useEffect(
    () => () => mediaRef.current.forEach((item) => URL.revokeObjectURL(item.preview)),
    [],
  );

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to return an order'))) return;
      const res = await getOrderById(orderId);
      const detail = extractOrderDetail(res);
      if (detail) setOrder(detail);
    })();
  }, [orderId]);

  const loadEligibility = useCallback(
    async (code) => {
      if (!orderId) return;
      const reqId = ++requestRef.current;
      setLoading(true);
      setLoadError('');
      try {
        const res = await getReturnEligibility(orderId, code || undefined);
        if (reqId !== requestRef.current) return;
        if (res?.success === false) {
          setLoadError(res?.message || 'Could not check return eligibility.');
          setEligibility(null);
          return;
        }
        const next = normalizeReturnEligibility(res, order);
        setEligibility(next);
        if (!code && next.allowedReasons.length) {
          setReasonOptions(buildReasonOptions(next.allowedReasons));
        }
        // Pre-select every eligible item until the user changes the selection; afterwards
        // keep their choices (dropping items that became ineligible for the chosen reason).
        setSelected((prev) => {
          const kept = {};
          next.items.forEach((item) => {
            if (!item.eligible) return;
            if (!selectionTouchedRef.current) {
              kept[item.orderItemId] = item.returnableQuantity;
            } else if (prev[item.orderItemId]) {
              kept[item.orderItemId] = Math.min(prev[item.orderItemId], item.returnableQuantity);
            }
          });
          return kept;
        });
      } catch (e) {
        if (reqId !== requestRef.current) return;
        setLoadError(e?.message || 'Could not check return eligibility.');
      } finally {
        if (reqId === requestRef.current) setLoading(false);
      }
    },
    // The order is only used to enrich item names/images; do not refetch when it arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderId],
  );

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to return an order'))) return;
      loadEligibility();
    })();
  }, [loadEligibility]);

  const items = useMemo(() => eligibility?.items ?? [], [eligibility]);
  const eligibleItems = items.filter((item) => item.eligible);
  const isCod = Boolean(eligibility?.isCod);
  const paymentSource = getPaymentSourceLabel(order, eligibility?.refundMode);
  const selectedIds = Object.keys(selected).filter((id) => selected[id] > 0);
  const selectedQty = selectedIds.reduce((sum, id) => sum + selected[id], 0);
  const refundTotal = items.reduce(
    (sum, item) => sum + (selected[item.orderItemId] ? item.price * selected[item.orderItemId] : 0),
    0,
  );
  const windowEnds = eligibility?.returnWindowEndsAt;

  const reasonLabel = reasonOptions.find((reason) => reason.code === reasonCode)?.label ?? '';
  const errors = validateReturnForm({
    reasonCode,
    reasonText,
    selectedCount: selectedIds.length,
    isCod,
    refundMethod,
    upiId,
    holderName,
    accountNumber,
    confirmAccount,
    ifsc,
  });
  const hasErrors = Object.values(errors).some(Boolean);
  const err = (key) => (showErrors ? errors[key] : '');

  const onSelectReason = (code) => {
    setReasonCode(code);
    if (code !== 'other') setReasonText('');
    loadEligibility(code);
  };

  const toggleItem = (item) => {
    if (!item.eligible) return;
    selectionTouchedRef.current = true;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.orderItemId]) delete next[item.orderItemId];
      else next[item.orderItemId] = item.returnableQuantity;
      return next;
    });
  };

  const toggleAll = () => {
    selectionTouchedRef.current = true;
    if (selectedIds.length === eligibleItems.length) {
      setSelected({});
      return;
    }
    const all = {};
    eligibleItems.forEach((item) => {
      all[item.orderItemId] = item.returnableQuantity;
    });
    setSelected(all);
  };

  const changeQty = (item, delta) => {
    selectionTouchedRef.current = true;
    setSelected((prev) => {
      const current = prev[item.orderItemId] ?? 0;
      const nextQty = Math.max(1, Math.min(item.returnableQuantity, current + delta));
      return { ...prev, [item.orderItemId]: nextQty };
    });
  };

  const onPickFiles = (event) => {
    const files = Array.from(event.target.files || []).filter((file) => /^image\//.test(file.type));
    event.target.value = '';
    if (!files.length) return;
    setMedia((prev) =>
      [
        ...prev,
        ...files.map((file) => ({
          id: `${Date.now()}-${file.name}-${file.size}`,
          file,
          preview: URL.createObjectURL(file),
          uploadedUrl: '',
        })),
      ].slice(0, MAX_RETURN_MEDIA),
    );
  };

  const removeMedia = (id) => {
    setMedia((prev) => {
      const gone = prev.find((item) => item.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (hasErrors) {
      setShowErrors(true);
      showSuccessToast(Object.values(errors).find(Boolean), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = await Promise.all(
        media.map(async (item) => {
          if (item.uploadedUrl) return item.uploadedUrl;
          const url = await uploadReturnMedia(item.file);
          setMedia((prev) => prev.map((p) => (p.id === item.id ? { ...p, uploadedUrl: url } : p)));
          return url;
        }),
      );
      const payload = buildReturnPayload({
        reasonCode,
        reasonText,
        reasonLabel,
        selected,
        mediaUrls: uploaded,
        isCod,
        refundMethod,
        upiId,
        holderName,
        accountNumber,
        ifsc,
      });
      const res = await createReturnRequest(orderId, payload);
      if (res?.success === false) {
        showSuccessToast(res?.message || 'Could not create return request', 'error');
        return;
      }
      const created = res?.data?.data ?? res?.data ?? {};
      showSuccessToast(res?.message || 'Return request submitted', 'success');
      if (created?.id) {
        navigate(`/profile/returns/${created.id}`, {
          replace: true,
          state: { returnRequest: created, order },
        });
      } else {
        navigate(`/profile/orders/${orderId}`, { replace: true });
      }
    } catch (e) {
      showSuccessToast(e?.message || 'Could not create return request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const orderCode = eligibility?.orderCode || order?.order_code || orderId;
  const closed = windowEnds && isPast(windowEnds);

  return (
    <AppShell tab="profile">
      <DetailPage>
        <DetailTop backTo={`/profile/orders/${orderId}`} backLabel="Order details" />

        <DetailHero
          variant="band"
          titleId="return-title"
          eyebrow="Return items"
          title={`#${formatOrderId(orderCode)}`}
          lede={
            windowEnds
              ? closed
                ? `Return window closed on ${formatShortDate(windowEnds)}`
                : `Return window open till ${formatShortDate(windowEnds)}`
              : undefined
          }
          chips={
            eligibility ? (
              <MetaChip icon={CreditCard} tone={isCod ? 'gold' : undefined}>
                {isCod ? 'Cash on delivery' : 'Prepaid'}
              </MetaChip>
            ) : null
          }
        />

        {loading && !eligibility && !loadError ? (
          <DetailSkeleton media={false} label="Checking which items can be returned" />
        ) : (
          <DetailLayout
            aside={
              <DetailCard id="return-summary" title="Submit return" icon={RefreshCw}>
                <p className="rt-total">
                  <small>{selectedQty ? `${selectedQty} item(s) selected` : 'No items selected'}</small>
                  <strong>{refundTotal > 0 ? `~ ${formatRupee(refundTotal, { decimals: 2 })}` : ''}</strong>
                </p>
                <p className="dx-note">
                  <AlertCircle size={14} aria-hidden />
                  After approval we will schedule a pickup. Keep the items in their original packaging.
                </p>
                <Button block loading={submitting} disabled={!eligibility || submitting} onClick={handleSubmit}>
                  Submit return
                </Button>
              </DetailCard>
            }
          >
            <DetailCard id="return-reason" title="Why are you returning?" icon={AlertCircle}>
              <div className="rt-list" role="radiogroup" aria-label="Return reason">
                {reasonOptions.map((reason) => {
                  const active = reasonCode === reason.code;
                  return (
                    <button
                      key={reason.code}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`rt-choice${active ? ' is-on' : ''}`}
                      onClick={() => onSelectReason(reason.code)}
                    >
                      <span className="rt-mark" aria-hidden />
                      <span className="rt-choice__copy">
                        <strong>{reason.label}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
              {reasonCode ? (
                <Textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder={reasonCode === 'other' ? 'Describe the issue...' : 'Add more details (optional)'}
                  rows={3}
                  maxLength={300}
                  aria-label="Return details"
                />
              ) : null}
              {err('reason') ? (
                <p className="am-field__error" role="alert">
                  {err('reason')}
                </p>
              ) : null}
            </DetailCard>

            <DetailCard
              id="return-items"
              title="Select items"
              icon={Package}
              action={
                eligibleItems.length > 1 ? (
                  <button type="button" className="rt-head-link" onClick={toggleAll}>
                    {selectedIds.length === eligibleItems.length ? 'Clear all' : 'Select all'}
                  </button>
                ) : null
              }
            >
              {loadError ? (
                <div className="rt-list">
                  <p className="dx-note">
                    <AlertCircle size={14} aria-hidden />
                    {loadError}
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => loadEligibility(reasonCode)}>
                    Retry
                  </Button>
                </div>
              ) : items.length === 0 ? (
                <p className="dx-note">
                  {eligibility?.message || 'No items in this order can be returned.'}
                </p>
              ) : (
                <>
                  {!eligibility?.eligible && eligibility?.message ? (
                    <p className="dx-note">
                      <AlertCircle size={14} aria-hidden />
                      {eligibility.message}
                    </p>
                  ) : null}
                  <div className="rt-list" aria-busy={loading}>
                    {items.map((item) => {
                      const qty = selected[item.orderItemId] ?? 0;
                      const checked = qty > 0;
                      const image = item.image || resolveImageUrl(item.raw);
                      return (
                        <div
                          key={item.orderItemId}
                          className={`rt-choice rt-choice--box rt-item${checked ? ' is-on' : ''}${
                            item.eligible ? '' : ' is-disabled'
                          }`}
                        >
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            disabled={!item.eligible}
                            className="rt-item__hit"
                            onClick={() => toggleItem(item)}
                          >
                            <span className="rt-mark rt-mark--box" aria-hidden>
                              {checked ? <Check size={13} /> : null}
                            </span>
                            <span className="rt-item__media">
                              {image ? (
                                <img src={image} alt="" loading="lazy" decoding="async" />
                              ) : (
                                <Leaf size={18} aria-hidden />
                              )}
                            </span>
                            <span className="rt-choice__copy">
                              <strong>{item.name}</strong>
                              <small>
                                {[
                                  item.price > 0 ? formatRupee(item.price, { decimals: 2 }) : null,
                                  `Qty ${item.quantity}`,
                                  item.eligible && item.returnableQuantity < item.quantity
                                    ? `${item.returnableQuantity} returnable`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </small>
                              {item.eligible && item.windowEndsAt ? (
                                <small className="is-ok">Return by {formatShortDate(item.windowEndsAt)}</small>
                              ) : null}
                              {!item.eligible ? (
                                <small className="is-warn">
                                  <AlertCircle size={12} aria-hidden />
                                  {item.reason ||
                                    (item.windowEndsAt && isPast(item.windowEndsAt)
                                      ? `Return window closed on ${formatShortDate(item.windowEndsAt)}`
                                      : 'Not eligible for return')}
                                </small>
                              ) : null}
                            </span>
                          </button>
                          {checked && item.returnableQuantity > 1 ? (
                            <span className="rt-qty" role="group" aria-label={`Quantity for ${item.name}`}>
                              <button
                                type="button"
                                aria-label="Decrease quantity"
                                disabled={qty <= 1}
                                onClick={() => changeQty(item, -1)}
                              >
                                <Minus size={14} />
                              </button>
                              <span>{qty}</span>
                              <button
                                type="button"
                                aria-label="Increase quantity"
                                disabled={qty >= item.returnableQuantity}
                                onClick={() => changeQty(item, 1)}
                              >
                                <Plus size={14} />
                              </button>
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {err('items') ? (
                <p className="am-field__error" role="alert">
                  {err('items')}
                </p>
              ) : null}
            </DetailCard>

            <DetailCard id="return-photos" title="Add photos" icon={Camera} meta="Optional">
              <p className="dx-note">Photos of the product and packaging help us approve faster.</p>
              <div className="rt-media">
                {media.map((item) => (
                  <div key={item.id} className="rt-media__tile">
                    <img src={item.preview} alt="" />
                    <button
                      type="button"
                      className="rt-media__remove"
                      aria-label="Remove photo"
                      onClick={() => removeMedia(item.id)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {media.length < MAX_RETURN_MEDIA ? (
                  <button type="button" className="rt-media__add" onClick={() => fileInput.current?.click()}>
                    <Camera size={18} aria-hidden />
                    Add
                  </button>
                ) : null}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="rt-file"
                tabIndex={-1}
                aria-hidden
                onChange={onPickFiles}
              />
            </DetailCard>

            <DetailCard id="return-refund" title={isCod ? 'Refund method' : 'Refund to'} icon={CreditCard}>
              {isCod ? (
                <>
                  <p className="dx-note">
                    This was a Cash on Delivery order. Tell us where to send your refund.
                  </p>
                  <div className="rt-list" role="radiogroup" aria-label="Refund method">
                    {[
                      { key: 'upi', icon: Wallet, title: 'UPI', sub: 'Fastest - refund to your UPI ID' },
                      { key: 'bank', icon: Landmark, title: 'Bank account', sub: 'Refund via NEFT / IMPS' },
                    ].map(({ key, icon: Icon, title, sub }) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={refundMethod === key}
                        className={`rt-choice${refundMethod === key ? ' is-on' : ''}`}
                        onClick={() => setRefundMethod(key)}
                      >
                        <span className="rt-mark" aria-hidden />
                        <span className="rt-choice__copy">
                          <strong>{title}</strong>
                          <small>{sub}</small>
                        </span>
                        <Icon size={18} aria-hidden />
                      </button>
                    ))}
                  </div>
                  {refundMethod === 'upi' ? (
                    <Input
                      label="UPI ID"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="name@bank"
                      autoCapitalize="none"
                      autoCorrect="off"
                      inputMode="email"
                      error={err('upi')}
                    />
                  ) : (
                    <div className="rt-fields">
                      <Input
                        className="is-wide"
                        label="Account holder name"
                        value={holderName}
                        onChange={(e) => setHolderName(e.target.value)}
                        placeholder="As per bank records"
                        error={err('holder')}
                      />
                      <Input
                        label="Account number"
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={18}
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter account number"
                        error={err('account')}
                      />
                      <Input
                        label="Confirm account number"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={18}
                        value={confirmAccount}
                        onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, ''))}
                        placeholder="Re-enter account number"
                        error={err('confirm')}
                      />
                      <Input
                        className="is-wide"
                        label="IFSC code"
                        maxLength={11}
                        autoCapitalize="characters"
                        value={ifsc}
                        onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="HDFC0001234"
                        error={err('ifsc')}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="rt-note">
                  <small>Refund to</small>
                  <strong>{paymentSource}</strong>
                  <span>
                    Prepaid order - no details needed. The refund goes straight back to the source you paid with
                    once the items are picked up and checked.
                  </span>
                </div>
              )}
            </DetailCard>
          </DetailLayout>
        )}

        {!loading && !eligibility && !loadError ? (
          <DetailEmpty
            icon={Package}
            title="Nothing to return"
            text="We could not find returnable items for this order."
            action={<Button onClick={() => navigate(`/profile/orders/${orderId}`)}>Back to order</Button>}
          />
        ) : null}

        <Disclaimer />
      </DetailPage>
    </AppShell>
  );
}