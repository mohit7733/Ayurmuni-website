import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import CouponApplyCard from '../components/CouponApplyCard';
import PageHeader from '../components/PageHeader';
import { formatRupee } from '../home/catalog';
import { useCheckoutCoupons } from '../hooks/useCheckoutCoupons';
import {
  calculateFeeBreakdown,
  feeRateLabel,
  parseFeeQuoteConfig,
  roundMoney,
} from '../cart/feeQuote';
import {
  CONSULT_BOOKING_KEY,
  CONSULT_PAY_KEY,
  CONSULT_PENDING_PAYMENT_KEY,
  consultPayableRupees,
  doctorDisplayName,
  doctorImage,
  doctorQualification,
  formatSlotTime,
  resolveDoctorSpecializations,
  toRazorpayPaise,
} from '../consult/doctors';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import {
  createConsultationPayment,
  getConsultationFeeQuote,
  retryConsultationPayment,
  verifyConsultationPayment,
} from '../services/consultService';
import {
  getPatientList,
  listPatients,
  switchPatient,
} from '../services/patientService';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import {
  Button,
  Disclaimer,
  EmptyState,
  StepIndicator,
} from '../components/ui';
import { BOOKING_COPY as T } from '../content/booking';
import '../design/pages/booking.css';

const loadRazorpay = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Unable to load Razorpay'));
    document.body.appendChild(script);
  });

const isApiSuccess = (response) =>
  response?.success === true || response?.success === 'true' || response?.success === 1;

const isPendingPayment = (data) => {
  const status = String(data?.status ?? data?.payment_status ?? '').toLowerCase();
  return status === 'pending' || status === 'created' || status === 'initiated';
};

const patientName = (patient) =>
  `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() ||
  patient?.full_name ||
  'Patient';

const readPending = (slotId) => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONSULT_PENDING_PAYMENT_KEY) || 'null');
    if (!stored?.appointment_id || String(stored.slot_id) !== String(slotId)) return null;
    return stored;
  } catch {
    return null;
  }
};

const savePending = (slotId, appointmentId, paymentId) => {
  if (!slotId || !appointmentId) return;
  sessionStorage.setItem(
    CONSULT_PENDING_PAYMENT_KEY,
    JSON.stringify({
      slot_id: String(slotId),
      appointment_id: String(appointmentId),
      ...(paymentId ? { payment_id: String(paymentId) } : {}),
    }),
  );
};

const clearPending = (slotId) => {
  const stored = readPending(slotId);
  if (!slotId || stored) sessionStorage.removeItem(CONSULT_PENDING_PAYMENT_KEY);
};

const formatDisplayDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const money = (value) => formatRupee(value, { decimals: 2 });

export default function ConsultPay() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const booking = useMemo(() => {
    if (location.state?.slot) return location.state;
    try {
      return JSON.parse(sessionStorage.getItem(CONSULT_PAY_KEY) || 'null');
    } catch {
      return null;
    }
  }, [location.state]);

  const doctor = booking?.doctor || {};
  const slot = booking?.slot || {};
  const [patients, setPatients] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [feeQuote, setFeeQuote] = useState(null);
  const [quotedCouponCode, setQuotedCouponCode] = useState('');
  const [feeQuoteLoading, setFeeQuoteLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const startedRef = useRef(false);

  const slotAmount = Number(slot.amount || doctor.consultation_fee || 0);

  const loadFeeQuote = useCallback(
    async (couponCode) => {
      if (!slot?.id) {
        setFeeQuoteLoading(false);
        return;
      }
      setFeeQuoteLoading(true);
      try {
        const response = await getConsultationFeeQuote(slot.id, couponCode);
        const parsed = parseFeeQuoteConfig(response?.data ?? response, slotAmount);
        setQuotedCouponCode(String(couponCode || '').trim());
        setFeeQuote(isApiSuccess(response) && parsed ? parsed : null);
      } catch {
        setFeeQuote(null);
      } finally {
        setFeeQuoteLoading(false);
      }
    },
    [slot?.id, slotAmount],
  );

  const consultationFee = feeQuote?.baseAmount || roundMoney(slotAmount);

  const {
    coupons,
    eligibleCoupons,
    loading: couponsLoading,
    applied: appliedCoupon,
    error: couponError,
    discount: couponDiscount,
    applyCode,
    remove: removeCoupon,
  } = useCheckoutCoupons('consultation', consultationFee);

  useEffect(() => {
    loadFeeQuote(appliedCoupon?.code);
  }, [appliedCoupon?.code, loadFeeQuote]);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to confirm this booking'))) return;
      const list = listPatients(await getPatientList());
      setPatients(list);
      setActivePatient(list.find((item) => item?.is_selected || item?.is_active) || list[0] || null);
    })();
  }, []);

  const feeBreakdown = useMemo(() => {
    const requested = String(appliedCoupon?.code || '').trim();
    const quoteDiscount =
      requested === quotedCouponCode && feeQuote?.couponDiscount != null
        ? feeQuote.couponDiscount
        : couponDiscount;
    const quote = calculateFeeBreakdown({
      baseAmount: consultationFee,
      discount: quoteDiscount,
      gst: feeQuote?.gst ?? { flat: 0, percent: 0 },
      platformFee: feeQuote?.platformFee ?? { flat: 0, percent: 0 },
      includeShipping: false,
      includeCod: false,
    });
    return {
      consultationFee: quote.baseAmount,
      discount: quote.discount,
      afterDiscount: quote.taxable,
      gst: quote.gst,
      gstLabel: feeRateLabel('GST', quote.gstRate),
      platformFee: quote.platformFee,
      platformLabel: feeRateLabel('Platform fee', quote.platformRate),
      total: quote.total,
    };
  }, [feeQuote, consultationFee, couponDiscount, appliedCoupon, quotedCouponCode]);

  const finish = (result) => {
    clearPending(slot.id);
    sessionStorage.removeItem(CONSULT_PAY_KEY);
    const paid = result?.data || result || {};
    sessionStorage.setItem(
      CONSULT_BOOKING_KEY,
      JSON.stringify({
        ...paid,
        doctor_name: doctorDisplayName(doctor),
        doctor_image: doctorImage(doctor),
        date: booking.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        concern: booking.concern,
        doctor,
        slot,
        patient: paid.patient || {
          patient_name: patientName(activePatient),
          phone_number: activePatient?.phone_number || activePatient?.phone,
        },
        patient_name: paid.patient_name || patientName(activePatient),
        amount: paid.amount || paid.consultation_fee || paid.total_amount || feeBreakdown.total,
        consultation_mode: paid.consultation_mode || paid.mode || 'Video consultation',
        hospital_name: paid.hospital_name || doctor?.hospital_name || doctor?.clinic_name,
        doctor_specialization: paid.doctor_specialization || resolveDoctorSpecializations(doctor),
        appointment_status: paid.appointment_status || paid.status || 'CONFIRMED',
      }),
    );
    showSuccessToast('Payment Successful', 'success');
    navigate('/consult/booking-confirm', { replace: true });
  };

  const pay = async () => {
    if (paying || startedRef.current) return;
    startedRef.current = true;
    setPaying(true);
    try {
      const pending = readPending(slot.id);
      let paymentResponse;
      if (pending?.appointment_id) {
        paymentResponse = await retryConsultationPayment(pending.appointment_id);
      } else {
        paymentResponse = await createConsultationPayment({
          slot_id: slot.id,
          concern: booking.concern,
          medical_record_ids: booking.medical_record_ids,
          coupon_code: appliedCoupon?.code,
        });
      }
      if (!isApiSuccess(paymentResponse)) {
        if (pending?.appointment_id) clearPending(slot.id);
        showSuccessToast(paymentResponse?.message || 'Unable to start payment', 'error');
        return;
      }
      let payment = paymentResponse?.data ?? {};
      const appointmentId = String(
        payment.appointment_id || payment.appointmentId || payment.consultation_id || pending?.appointment_id || '',
      ).trim();
      if (appointmentId) savePending(slot.id, appointmentId, payment.payment_id);
      if (appointmentId && !pending?.appointment_id && isPendingPayment(payment)) {
        try {
          const retry = await retryConsultationPayment(appointmentId);
          if (isApiSuccess(retry) && retry?.data) {
            payment = { ...payment, ...retry.data };
          }
        } catch {
          // keep original payload
        }
      }
      const payable = consultPayableRupees(payment, feeBreakdown.total);
      const key = String(payment.razorpay_key || payment.key || payment.key_id || '').trim();
      const orderId = String(
        payment.razorpay_order_id || payment.razorpayOrderId || payment.rzp_order_id || '',
      ).trim();
      const amount = toRazorpayPaise(payment.amount ?? payment?.summary?.total_payable_amount, payable);
      if (!key || !orderId) {
        if (payable <= 0 || isApiSuccess(paymentResponse)) {
          finish(paymentResponse);
          return;
        }
        showSuccessToast('Payment details missing. Please try again.', 'error');
        return;
      }
      const Razorpay = await loadRazorpay();
      await new Promise((resolve) => {
        const rzp = new Razorpay({
          key,
          amount,
          currency: payment.currency || 'INR',
          name: 'Ayurmuni',
          description: `Consult ${doctorDisplayName(doctor)}`,
          order_id: orderId,
          prefill: {
            name: patientName(activePatient),
            contact: String(activePatient?.phone_number || activePatient?.phone || '').replace(/\D/g, ''),
          },
          theme: { color: '#0D614E' },
          handler: async (response) => {
            setVerifying(true);
            try {
              const verify = await verifyConsultationPayment({
                payment_id: payment.payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (verify?.success === false) {
                showSuccessToast(verify?.message || 'Payment verification failed', 'error');
              } else {
                finish(verify?.data ? verify : paymentResponse);
              }
            } finally {
              setVerifying(false);
              resolve();
            }
          },
          modal: {
            ondismiss: () => {
              showSuccessToast('Payment cancelled. You can try again anytime.', 'error');
              resolve();
            },
          },
        });
        rzp.open();
      });
    } catch (error) {
      showSuccessToast(error?.message || 'Unable to start payment', 'error');
    } finally {
      setPaying(false);
      startedRef.current = false;
    }
  };

  const changePatient = async (patient) => {
    if (!patient?.id || String(patient.id) === String(activePatient?.id)) return;
    const res = await switchPatient(patient.id);
    if (res?.success === false) {
      showSuccessToast(res?.message || 'Failed to switch patient', 'error');
      return;
    }
    setActivePatient(patient);
    showSuccessToast('Patient switched successfully', 'success');
  };

  if (!booking?.slot?.id) {
    return (
      <AppShell tab="consult">
        <div className="bk-page">
          <PageHeader title={T.payTitle} backTo={`/consult/doctors/${doctorId}/slots`} />
          <EmptyState
            title={T.noSlotTitle}
            description={T.noSlotText}
            action={
              <Button onClick={() => navigate(`/consult/doctors/${doctorId}/slots`)}>{T.pickASlot}</Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  const image = doctorImage(doctor);
  const name = formatDoctorDisplayName(doctorDisplayName(doctor));
  const records = booking.medical_records || [];
  const payDisabled = paying || feeQuoteLoading || !feeQuote;
  const whenLabel = [formatDisplayDate(booking.date), formatSlotTime(slot.start_time) || slot.displayTime]
    .filter(Boolean)
    .join(' · ');

  return (
    <AppShell tab="consult">
      <div className="bk-page">
        <PageHeader title={T.payTitle} backTo={`/consult/doctors/${doctorId}/slots`} />
        <StepIndicator steps={T.steps} current={1} label={T.stepsLabel} />

        <div className="bk-layout">
          <div className="bk-main">
            <div className="bk-doctor">
              <span className="bk-doctor__photo" aria-hidden={!image}>
                {image ? <img src={image} alt="" /> : <span>{name.charAt(0)}</span>}
              </span>
              <div className="bk-doctor__copy">
                <strong>{name}</strong>
                {doctorQualification(doctor) ? <p>{doctorQualification(doctor)}</p> : null}
                <small>{whenLabel}</small>
              </div>
            </div>

            {patients.length > 0 ? (
              <section className="bk-card" aria-labelledby="bk-patient-title">
                <div className="bk-card__head">
                  <h2 id="bk-patient-title">{T.patientTitle}</h2>
                </div>
                <div className="bk-record-list" role="radiogroup" aria-labelledby="bk-patient-title">
                  {patients.map((item) => {
                    const on = String(activePatient?.id) === String(item.id);
                    return (
                      <label key={item.id} className={`bk-record${on ? ' is-on' : ''}`}>
                        <input
                          type="radio"
                          name="patient"
                          checked={on}
                          onChange={() => changePatient(item)}
                        />
                        <span className="bk-record__copy">
                          <strong>{patientName(item)}</strong>
                          <small>{item.relation || item.relationship || 'Self'}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {booking.concern ? (
              <section className="bk-card" aria-labelledby="bk-pay-concern">
                <div className="bk-card__head">
                  <h2 id="bk-pay-concern">{T.concernLabel}</h2>
                </div>
                <p className="bk-prose">{booking.concern}</p>
              </section>
            ) : null}

            {records.length > 0 ? (
              <section className="bk-card" aria-labelledby="bk-pay-records">
                <div className="bk-card__head">
                  <h2 id="bk-pay-records">{T.attachedRecords}</h2>
                </div>
                <ul className="bk-record-list">
                  {records.map((item) => (
                    <li key={item.id} className="bk-record">
                      <span className="bk-record__copy">
                        <strong>{item.description || item.title || 'Record'}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="bk-aside">
            <div className="bk-card">
              <CouponApplyCard
                coupons={coupons}
                eligibleCoupons={eligibleCoupons}
                cartAmount={consultationFee}
                loading={couponsLoading}
                applied={appliedCoupon}
                discount={feeBreakdown.discount || couponDiscount}
                payable={feeBreakdown.total}
                error={couponError}
                checkoutScope="consultation"
                onApply={applyCode}
                onRemove={removeCoupon}
              />
            </div>

            <section className="bk-card" aria-labelledby="bk-bill-title">
              <div className="bk-card__head">
                <h2 id="bk-bill-title">{T.billTitle}</h2>
              </div>
              {feeQuoteLoading ? <p className="bk-card__hint">{T.calculating}</p> : null}
              <dl className="bk-bill">
                <div className="bk-bill__row">
                  <dt>{T.consultation}</dt>
                  <dd>{money(feeBreakdown.consultationFee)}</dd>
                </div>
                {feeBreakdown.discount > 0 ? (
                  <div className="bk-bill__row is-discount">
                    <dt>{T.discount}</dt>
                    <dd>− {money(feeBreakdown.discount)}</dd>
                  </div>
                ) : null}
                {feeBreakdown.discount > 0 ? (
                  <div className="bk-bill__row">
                    <dt>{T.subTotal}</dt>
                    <dd>{money(feeBreakdown.afterDiscount)}</dd>
                  </div>
                ) : null}
                {feeBreakdown.platformFee > 0 ? (
                  <div className="bk-bill__row">
                    <dt>{feeBreakdown.platformLabel}</dt>
                    <dd>{money(feeBreakdown.platformFee)}</dd>
                  </div>
                ) : null}
                {feeBreakdown.gst > 0 ? (
                  <div className="bk-bill__row">
                    <dt>{feeBreakdown.gstLabel}</dt>
                    <dd>{money(feeBreakdown.gst)}</dd>
                  </div>
                ) : null}
                <div className="bk-bill__row is-total">
                  <dt>{T.toPay}</dt>
                  <dd>{money(feeBreakdown.total)}</dd>
                </div>
              </dl>
            </section>

            <div className="bk-aside__cta">
              <Button variant="accent" size="lg" block disabled={payDisabled} loading={paying} onClick={pay}>
                {paying ? T.starting : T.payNow}
              </Button>
            </div>
            <Disclaimer />
          </aside>
        </div>
      </div>

      <div className="bk-sticky" role="region" aria-label={T.payNow}>
        <div className="bk-sticky__meta">
          <strong>{money(feeBreakdown.total)}</strong>
          <small>{T.toPay}</small>
        </div>
        <Button variant="accent" disabled={payDisabled} loading={paying} onClick={pay}>
          {paying ? T.starting : T.payNow}
        </Button>
      </div>

      {verifying ? (
        <div className="bk-verify" role="alertdialog" aria-modal="true" aria-labelledby="bk-verify-title">
          <div className="bk-verify__panel">
            <Loader2 className="bk-verify__spinner" size={32} aria-hidden />
            <p>{T.verifyingTitle}</p>
            <h2 id="bk-verify-title">{T.verifyingText}</h2>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
