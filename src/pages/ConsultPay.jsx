import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2, Star } from "lucide-react";
import AppShell from "../components/AppShell";
import CouponApplyCard from "../components/CouponApplyCard";
import PageHeader from "../components/PageHeader";
import DietitianBadge from "../components/DietitianBadge";
import { formatRupee } from "../home/catalog";
import { useCheckoutCoupons } from "../hooks/useCheckoutCoupons";
import useConsultPlans from "../hooks/useConsultPlans";
import usePaymentGateways from "../hooks/usePaymentGateways";
import ConsultPlanPicker from "../components/ConsultPlanPicker";
import PaymentGatewaySelector from "../components/PaymentGatewaySelector";
import {
  calculateFeeBreakdown,
  feeRateLabel,
  parseFeeQuoteConfig,
  roundMoney,
} from "../cart/feeQuote";
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
} from "../consult/doctors";
import { formatDoctorDisplayName } from "../consult/appointmentUtils";
import {
  getConsultBenefit,
  isApiSuccess,
  isBookingAlreadyPaid,
  isDuplicateGatewayOrder,
  pickConsultPaymentData,
  pickConsultRazorpayKey,
  pickConsultRazorpayOrderId,
  planRemainingLabel,
  readAppointmentId,
  readPlanFunding,
} from "../consult/consultPayment";
import { hasGatewayOrder, toApiPaymentGateway } from "../payment/gateways";
import { openRazorpayCheckout, toRazorpayPaise } from "../payment/razorpayCheckout";
import {
  createConsultationPayment,
  getConsultationFeeQuote,
  getConsultationPayment,
  retryConsultationPayment,
  verifyConsultationPayment,
} from "../services/consultService";
import {
  getPatientList,
  listPatients,
  switchPatient,
} from "../services/patientService";
import { requireAuth } from "../services/guestAuth";
import { showSuccessToast } from "../config/key";
import {
  buildCashfreeVerifyPayload,
  clearCashfreePending,
  enrichCashfreeVerifyPayload,
  extractCashfreeCheckout,
  isCashfreePaymentVerified,
  isRecordUuid,
  openCashfreeCheckout,
  preloadCashfree,
  saveCashfreePending,
  shouldVerifyCashfreePayment,
} from "../payment/cashfree";
import {
  Button,
  Disclaimer,
  EmptyState,
  StepIndicator,
} from "../components/ui";
import { BOOKING_COPY as T } from "../content/booking";
import { nameInitial } from '../utils/initials';
import "../design/pages/booking.css";
import "../design/components/consult-plan.css";



const isPendingPayment = (data) => {
  const status = String(
    data?.status ?? data?.payment_status ?? "",
  ).toLowerCase();
  return status === "pending" || status === "created" || status === "initiated";
};

const patientName = (patient) =>
  `${patient?.first_name || ""} ${patient?.last_name || ""}`.trim() ||
  patient?.full_name ||
  "Patient";

const readPending = (slotId) => {
  try {
    const stored = JSON.parse(
      sessionStorage.getItem(CONSULT_PENDING_PAYMENT_KEY) || "null",
    );
    if (!stored?.appointment_id || String(stored.slot_id) !== String(slotId))
      return null;
    return stored;
  } catch {
    return null;
  }
};

const savePending = (slotId, appointmentId, paymentId, gateway) => {
  if (!slotId || !appointmentId) return;
  sessionStorage.setItem(
    CONSULT_PENDING_PAYMENT_KEY,
    JSON.stringify({
      slot_id: String(slotId),
      appointment_id: String(appointmentId),
      ...(paymentId ? { payment_id: String(paymentId) } : {}),
      ...(gateway ? { gateway } : {}),
    }),
  );
};

const clearPending = (slotId) => {
  const stored = readPending(slotId);
  if (!slotId || stored) sessionStorage.removeItem(CONSULT_PENDING_PAYMENT_KEY);
};

const formatDisplayDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
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
      return JSON.parse(sessionStorage.getItem(CONSULT_PAY_KEY) || "null");
    } catch {
      return null;
    }
  }, [location.state]);

  const doctor = booking?.doctor || {};
  const slot = booking?.slot || {};
  const [patients, setPatients] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [feeQuote, setFeeQuote] = useState(null);
  const [quotedCouponCode, setQuotedCouponCode] = useState("");
  const [feeQuoteLoading, setFeeQuoteLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const startedRef = useRef(false);
  const { gateways, gateway, setGateway } = usePaymentGateways();
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planPayable, setPlanPayable] = useState(null);
  const [planQuoteLoading, setPlanQuoteLoading] = useState(false);
  const planPromptShownRef = useRef(false);

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
        const parsed = parseFeeQuoteConfig(
          response?.data ?? response,
          slotAmount,
        );
        setQuotedCouponCode(String(couponCode || "").trim());
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
  } = useCheckoutCoupons("consultation", consultationFee);

  useEffect(() => {
    loadFeeQuote(appliedCoupon?.code);
  }, [appliedCoupon?.code, loadFeeQuote]);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth("Please login to confirm this booking"))) return;
      const list = listPatients(await getPatientList());
      setPatients(list);
      setActivePatient(
        list.find((item) => item?.is_selected || item?.is_active) ||
          list[0] ||
          null,
      );
    })();
  }, []);

  const feeBreakdown = useMemo(() => {
    const requested = String(appliedCoupon?.code || "").trim();
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
      gstLabel: feeRateLabel("GST", quote.gstRate),
      platformFee: quote.platformFee,
      platformLabel: feeRateLabel("Platform fee", quote.platformRate),
      total: quote.total,
    };
  }, [
    feeQuote,
    consultationFee,
    couponDiscount,
    appliedCoupon,
    quotedCouponCode,
  ]);

  const { plans: activePlans, eligibility: planEligibility, usablePlans } = useConsultPlans({
    doctorId: doctorId || doctor?.doctor_id || doctor?.id,
    slotId: slot?.id,
  });

  // Offer the customer's active plans once, like the app's Confirm Booking screen.
  useEffect(() => {
    if (activePlans.length > 0 && !planPromptShownRef.current) {
      planPromptShownRef.current = true;
      setPlanSheetOpen(true);
    }
  }, [activePlans]);

  const handleSelectPlan = async (plan) => {
    setPlanSheetOpen(false);
    if (!slot?.id) return;
    setSelectedPlan(plan);
    const cached = planEligibility[plan.id];
    if (cached && !cached.loading && cached.canFund) {
      setPlanPayable(cached.payable ?? 0);
      return;
    }
    setPlanQuoteLoading(true);
    try {
      const response = await getConsultationFeeQuote(slot.id, undefined, plan.id);
      const funding = readPlanFunding(response);
      if (!funding.canFund) {
        showSuccessToast(funding.reason, "error");
        setSelectedPlan(null);
        setPlanPayable(null);
        return;
      }
      setPlanPayable(funding.payable ?? 0);
    } catch (error) {
      showSuccessToast(error?.message || "Unable to apply plan", "error");
      setSelectedPlan(null);
      setPlanPayable(null);
    } finally {
      setPlanQuoteLoading(false);
    }
  };

  const clearSelectedPlan = () => {
    setSelectedPlan(null);
    setPlanPayable(null);
  };

  const usingPlan = Boolean(selectedPlan) && planPayable != null;
  const totalAmount = usingPlan ? planPayable : feeBreakdown.total;
  const planCoveredAmount = usingPlan
    ? Math.max(0, roundMoney(feeBreakdown.total - planPayable))
    : 0;
  const planIsFree = usingPlan && planPayable === 0;
  const selectedBenefit = selectedPlan ? getConsultBenefit(selectedPlan) : null;
  const selectedPlanRemaining = !selectedBenefit
    ? ""
    : planRemainingLabel(selectedPlan);

  useEffect(() => {
    preloadCashfree();
  }, []);

  const finish = (result, message = "Payment Successful") => {
    clearCashfreePending();
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
        amount:
          paid.amount ||
          paid.consultation_fee ||
          paid.total_amount ||
          totalAmount,
        consultation_mode:
          paid.consultation_mode || paid.mode || "Video consultation",
        hospital_name:
          paid.hospital_name || doctor?.hospital_name || doctor?.clinic_name,
        doctor_specialization:
          paid.doctor_specialization || resolveDoctorSpecializations(doctor),
        appointment_status:
          paid.appointment_status || paid.status || "CONFIRMED",
      }),
    );
    showSuccessToast(message || "Payment Successful", "success");
    navigate("/consult/booking-confirm", { replace: true });
  };

  const pay = async () => {
    if (paying || startedRef.current) return;
    startedRef.current = true;
    setPaying(true);
    try {
      const planPurchaseId = usingPlan ? selectedPlan?.id : undefined;
      const apiGateway = toApiPaymentGateway(gateway);
      const pending = planPurchaseId ? null : readPending(slot.id);
      let paymentResponse;
      if (planPurchaseId) {
        // Plan-funded booking: package_purchase_id; payment_gateway only when a balance is still due.
        paymentResponse = await createConsultationPayment({
          slot_id: slot.id,
          package_purchase_id: planPurchaseId,
          concern: booking.concern,
          medical_record_ids: booking.medical_record_ids,
          ...(planPayable > 0 ? { payment_gateway: apiGateway } : {}),
        });
        if (!isApiSuccess(paymentResponse)) {
          showSuccessToast(
            paymentResponse?.message || "Unable to book with this plan",
            "error",
          );
          return;
        }
        // Plan covers the consultation - appointment is confirmed, no gateway.
        if (!hasGatewayOrder(paymentResponse?.data)) {
          finish(
            {
              ...paymentResponse,
              data: {
                ...(paymentResponse?.data || {}),
                funded_by_package: paymentResponse?.data?.funded_by_package !== false,
              },
            },
            paymentResponse?.message || "Appointment confirmed with your plan",
          );
          return;
        }
      } else {
        // Retry only a pending order created for the SAME gateway, otherwise book fresh.
        const canRetry =
          Boolean(pending?.appointment_id) &&
          (!pending.gateway || pending.gateway === apiGateway);
        if (canRetry) {
          try {
            paymentResponse = await retryConsultationPayment(
              pending.appointment_id,
              apiGateway,
            );
          } catch {
            paymentResponse = null;
          }
          const retryData = pickConsultPaymentData(paymentResponse);
          const retryGateway = String(
            retryData?.payment_gateway ?? retryData?.gateway ?? "",
          ).toLowerCase();
          if (
            !isApiSuccess(paymentResponse) ||
            (retryGateway && retryGateway !== apiGateway)
          ) {
            clearPending(slot.id);
            paymentResponse = null;
          }
        } else if (pending?.appointment_id) {
          clearPending(slot.id);
        }
        if (!paymentResponse) {
          paymentResponse = await createConsultationPayment({
            slot_id: slot.id,
            concern: booking.concern,
            medical_record_ids: booking.medical_record_ids,
            coupon_code: appliedCoupon?.code,
            payment_gateway: apiGateway,
          });
          const duplicateAppointmentId = isDuplicateGatewayOrder(paymentResponse)
            ? readAppointmentId(pickConsultPaymentData(paymentResponse)) ||
              readAppointmentId(paymentResponse?.data?.errors)
            : "";
          if (duplicateAppointmentId) {
            try {
              const retryResponse = await retryConsultationPayment(
                duplicateAppointmentId,
                apiGateway,
              );
              if (isApiSuccess(retryResponse)) paymentResponse = retryResponse;
            } catch {
              // keep the original (duplicate) response
            }
          }
        }
      }
      if (!isApiSuccess(paymentResponse)) {
        showSuccessToast(
          isDuplicateGatewayOrder(paymentResponse)
            ? "A payment for this slot is already in progress. Please try again in a minute or choose another payment method."
            : paymentResponse?.message || "Unable to start payment",
          "error",
        );
        return;
      }
      let payment = paymentResponse?.data ?? {};
      const appointmentId = String(
        payment.appointment_id ||
          payment.appointmentId ||
          payment.consultation_id ||
          pending?.appointment_id ||
          "",
      ).trim();
      const razorpayReady =
        apiGateway === "razorpay" &&
        pickConsultRazorpayKey(pickConsultPaymentData(paymentResponse)) &&
        pickConsultRazorpayOrderId(pickConsultPaymentData(paymentResponse));
      if (
        appointmentId &&
        !pending?.appointment_id &&
        isPendingPayment(payment) &&
        !razorpayReady
      ) {
        try {
          const retry = await retryConsultationPayment(appointmentId, apiGateway);
          if (isApiSuccess(retry) && retry?.data) {
            payment = {
              ...payment,
              ...retry.data,
              summary: retry.data?.summary ?? payment?.summary,
              configurations: retry.data?.configurations ?? payment?.configurations,
            };
          }
        } catch {
          // keep original payload
        }
      }
      const paymentData = pickConsultPaymentData({
        ...paymentResponse,
        data: { ...(paymentResponse?.data || {}), ...payment },
      });
      const payable = consultPayableRupees(payment, totalAmount);
      const checkout = extractCashfreeCheckout({
        ...paymentResponse,
        data: { ...(paymentResponse?.data || {}), ...payment },
      });
      if (!checkout.paymentId && payment.payment_id) {
        checkout.paymentId = String(payment.payment_id);
      }
      // Backend already confirmed the booking (auto-applied package / zero payable) - no gateway.
      if (
        !checkout.sessionId &&
        (payable <= 0 ||
          (!hasGatewayOrder(paymentData) && isBookingAlreadyPaid(paymentData)))
      ) {
        finish(paymentResponse, paymentResponse?.message);
        return;
      }
      if (appointmentId) {
        savePending(slot.id, appointmentId, payment.payment_id, apiGateway);
      }

      if (apiGateway === "razorpay") {
        const razorpayKey = pickConsultRazorpayKey(paymentData);
        const razorpayOrderId = pickConsultRazorpayOrderId(paymentData);
        if (!razorpayKey || !razorpayOrderId) {
          showSuccessToast(
            !razorpayKey
              ? "Payment key missing from order response"
              : "Razorpay order was not created",
            "error",
          );
          return;
        }
        const outcome = await openRazorpayCheckout({
          key: razorpayKey,
          orderId: razorpayOrderId,
          amountPaise: toRazorpayPaise(
            paymentData?.amount ?? paymentData?.summary?.total_payable_amount,
            payable,
          ),
          description: "Consultation payment",
          customerName: patientName(activePatient),
          customerEmail: activePatient?.email,
          customerPhone: activePatient?.phone_number || activePatient?.phone,
        });
        if (outcome.status === "cancelled") {
          showSuccessToast(
            "Payment cancelled. You can try again anytime.",
            "error",
          );
          return;
        }
        if (outcome.status === "failed") {
          showSuccessToast(outcome.message, "error");
          return;
        }
        setVerifying(true);
        try {
          const rz = outcome.response || {};
          const verify = await verifyConsultationPayment({
            payment_id: String(paymentData?.payment_id ?? ""),
            gateway_order_id: String(rz.razorpay_order_id || razorpayOrderId),
            gateway_payment_id: String(rz.razorpay_payment_id ?? ""),
            gateway_signature: String(rz.razorpay_signature ?? ""),
            payment_gateway: "razorpay",
          });
          if (isApiSuccess(verify)) {
            finish(verify?.data ? verify : paymentResponse);
          } else {
            showSuccessToast(
              verify?.message || "Payment verification failed",
              "error",
            );
          }
        } finally {
          setVerifying(false);
        }
        return;
      }

      if (!checkout.sessionId) {
        showSuccessToast("Payment details missing. Please try again.", "error");
        return;
      }
      saveCashfreePending({
        kind: "consultation",
        paymentId: checkout.paymentId,
        orderId: checkout.orderId,
        gatewayPaymentId: checkout.gatewayPaymentId,
        signature: checkout.signature,
        sessionId: checkout.sessionId,
        confirmBase: {
          doctor_name: doctorDisplayName(doctor),
          doctor_image: doctorImage(doctor),
          date: booking.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          concern: booking.concern,
          doctor,
          slot,
          patient: {
            patient_name: patientName(activePatient),
            phone_number: activePatient?.phone_number || activePatient?.phone,
          },
          patient_name: patientName(activePatient),
          amount: payable,
          consultation_mode: "Video consultation",
          hospital_name: doctor?.hospital_name || doctor?.clinic_name,
          doctor_specialization: resolveDoctorSpecializations(doctor),
          appointment_status: "CONFIRMED",
        },
      });
      const cfResult = await openCashfreeCheckout({
        sessionId: checkout.sessionId,
        mode: checkout.mode,
        paymentId: checkout.paymentId,
      });
      if (cfResult?.redirect) return;
      if (!shouldVerifyCashfreePayment(cfResult)) {
        clearCashfreePending();
        showSuccessToast(
          "Payment cancelled. You can try again anytime.",
          "error",
        );
        return;
      }
      setVerifying(true);
      try {
        let payload = buildCashfreeVerifyPayload(checkout, cfResult);
        if (!payload.gateway_payment_id && isRecordUuid(checkout.paymentId)) {
          payload = await enrichCashfreeVerifyPayload(payload, [
            () => getConsultationPayment(checkout.paymentId),
          ]);
        }
        if (!payload.gateway_payment_id) {
          showSuccessToast(
            "Cashfree has not returned the payment id yet. Wait a few seconds, then confirm the booking again.",
            "error",
          );
          return;
        }
        const verify = await verifyConsultationPayment(payload);
        if (isCashfreePaymentVerified(verify)) {
          finish(verify?.data ? verify : paymentResponse);
        } else if (cfResult?.paymentDetails) {
          showSuccessToast(
            verify?.message || "Payment verification failed",
            "error",
          );
        } else {
          clearCashfreePending();
          showSuccessToast(
            cfResult?.error?.message ||
              verify?.message ||
              "Payment cancelled. You can try again anytime.",
            "error",
          );
        }
      } finally {
        setVerifying(false);
      }
    } catch (error) {
      showSuccessToast(error?.message || "Unable to start payment", "error");
    } finally {
      setPaying(false);
      startedRef.current = false;
    }
  };
  const changePatient = async (patient) => {
    if (!patient?.id || String(patient.id) === String(activePatient?.id))
      return;
    const res = await switchPatient(patient.id);
    if (res?.success === false) {
      showSuccessToast(res?.message || "Failed to switch patient", "error");
      return;
    }
    setActivePatient(patient);
    showSuccessToast("Patient switched successfully", "success");
  };

  if (!booking?.slot?.id) {
    return (
      <AppShell tab="consult">
        <div className="bk-page bk-pay-page">
          <PageHeader
            title={T.payTitle}
            backTo={`/consult/doctors/${doctorId}/slots`}
          />
          <EmptyState
            title={T.noSlotTitle}
            description={T.noSlotText}
            action={
              <Button
                onClick={() => navigate(`/consult/doctors/${doctorId}/slots`)}
              >
                {T.pickASlot}
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  const image = doctorImage(doctor);
  const name = formatDoctorDisplayName(doctorDisplayName(doctor));
  const records = booking.medical_records || [];
  const payDisabled =
    paying || planQuoteLoading || (usingPlan ? false : feeQuoteLoading || !feeQuote);
  const priceLoading = usingPlan ? planQuoteLoading : feeQuoteLoading || planQuoteLoading;
  const whenLabel = [
    formatDisplayDate(booking.date),
    formatSlotTime(slot.start_time) || slot.displayTime,
  ]
    .filter(Boolean)
    .join(" · ");
  const consultationMode =
    booking.consultation_mode || booking.mode || "Video consultation";

  return (
    <AppShell tab="consult">
      <div className="bk-page bk-pay-page">
        <PageHeader
          title={T.payTitle}
          backTo={`/consult/doctors/${doctorId}/slots`}
        />
        <StepIndicator steps={T.steps} current={1} label={T.stepsLabel} />

        <div className="bk-layout">
          <div className="bk-main">
            <div className="bk-doctor">
              <span className="bk-doctor__photo" aria-hidden={!image}>
                {image ? (
                  <img src={image} alt="" />
                ) : (
                  <span>{nameInitial(name)}</span>
                )}
              </span>
              <div className="bk-doctor__copy">
                <strong>{name}</strong>
                <DietitianBadge doctor={doctor} />
                {doctorQualification(doctor) ? (
                  <p>{doctorQualification(doctor)}</p>
                ) : null}
                <small>{whenLabel}</small>
                <div
                  className="bk-doctor__meta"
                  aria-label="Consultation summary"
                >
                  <span className="bk-pill bk-pill--primary">
                    {consultationMode}
                  </span>
                </div>
              </div>
            </div>

            {patients.length > 0 ? (
              <section className="bk-card" aria-labelledby="bk-patient-title">
                <div className="bk-card__head">
                  <h2 id="bk-patient-title">{T.patientTitle}</h2>
                </div>
                <div
                  className="bk-record-list"
                  role="radiogroup"
                  aria-labelledby="bk-patient-title"
                >
                  {patients.map((item) => {
                    const on = String(activePatient?.id) === String(item.id);
                    const patientPhone = item.phone_number || item.phone || "";
                    const patientMeta = [
                      item.relation || item.relationship || "Self",
                      patientPhone,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <label
                        key={item.id}
                        className={`bk-record${on ? " is-on" : ""}`}
                      >
                        <input
                          type="radio"
                          name="patient"
                          checked={on}
                          onChange={() => changePatient(item)}
                        />
                        <span className="bk-record__copy">
                          <strong>{patientName(item)}</strong>
                          <small>{patientMeta || "Self"}</small>
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
                        <strong>
                          {item.description || item.title || "Record"}
                        </strong>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="bk-aside">
            <div className="bk-card bk-payment-hero">
              <div className="bk-payment-hero__head">
                <span className="bk-payment-tag">Total payable</span>
                <strong>{money(totalAmount)}</strong>
              </div>
              <p>{planIsFree ? `Paid via ${selectedPlan?.name || "plan"}` : "Secure payment at checkout"}</p>
            </div>

            {activePlans.length > 0 ? (
              selectedPlan ? (
                <div className="cp-banner cp-banner--on">
                  <Star size={16} aria-hidden="true" />
                  <span className="cp-banner__copy">
                    <small>Booking with your plan</small>
                    <strong>{selectedPlan.name}</strong>
                    <small>
                      {planQuoteLoading
                        ? "Checking plan benefit..."
                        : [planIsFree ? "No payment needed" : null, selectedPlanRemaining]
                            .filter(Boolean)
                            .join(" · ")}
                    </small>
                  </span>
                  <span className="cp-banner__actions">
                    <Button size="sm" variant="secondary" disabled={paying} onClick={() => setPlanSheetOpen(true)}>
                      Change
                    </Button>
                    <Button size="sm" variant="ghost" disabled={paying} onClick={clearSelectedPlan}>
                      Remove
                    </Button>
                  </span>
                </div>
              ) : (
                <button type="button" className="cp-banner" onClick={() => setPlanSheetOpen(true)}>
                  <Star size={16} aria-hidden="true" />
                  <span className="cp-banner__copy">
                    <strong>
                      You have {activePlans.length} active plan{activePlans.length > 1 ? "s" : ""}
                    </strong>
                    <small>
                      {usablePlans.length > 0
                        ? "Book this consultation without paying"
                        : "Consultations in your plans are used up"}
                    </small>
                  </span>
                  <strong>{usablePlans.length > 0 ? "Use plan" : "View"}</strong>
                </button>
              )
            ) : null}

            {usingPlan ? null : (
              <div className="bk-card">
                <CouponApplyCard
                  coupons={coupons}
                  eligibleCoupons={eligibleCoupons}
                  cartAmount={consultationFee}
                  loading={couponsLoading}
                  applied={appliedCoupon}
                  discount={feeBreakdown.discount || couponDiscount}
                  payable={totalAmount}
                  error={couponError}
                  checkoutScope="consultation"
                  onApply={applyCode}
                  onRemove={removeCoupon}
                />
              </div>
            )}

            {!planIsFree && gateways.length > 1 ? (
              <div className="bk-card">
                <PaymentGatewaySelector
                  gateways={gateways}
                  selected={gateway}
                  onSelect={setGateway}
                  disabled={paying}
                />
              </div>
            ) : null}

            <section className="bk-card" aria-labelledby="bk-bill-title">
              <div className="bk-card__head">
                <h2 id="bk-bill-title">{T.billTitle}</h2>
              </div>
              {priceLoading ? (
                <p className="bk-card__hint">{T.calculating}</p>
              ) : null}
              {usingPlan ? (
                <dl className="bk-bill">
                  <div className="bk-bill__row">
                    <dt>Consultation total</dt>
                    <dd>{money(feeBreakdown.total)}</dd>
                  </div>
                  {planCoveredAmount > 0 ? (
                    <div className="bk-bill__row is-discount">
                      <dt>Covered by plan</dt>
                      <dd>- {money(planCoveredAmount)}</dd>
                    </div>
                  ) : null}
                  <div className="bk-bill__row is-total">
                    <dt>{T.toPay}</dt>
                    <dd>{money(totalAmount)}</dd>
                  </div>
                </dl>
              ) : (
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
              )}
            </section>

            <div className="bk-aside__cta">
              <Button
                variant="accent"
                size="lg"
                block
                disabled={payDisabled}
                loading={paying}
                onClick={pay}
              >
                {paying ? T.starting : T.payNow}
              </Button>
            </div>
            <Disclaimer />
          </aside>
        </div>
      </div>

      <div
        className="bk-sticky bk-pay-sticky"
        role="region"
        aria-label={T.payNow}
      >
        <div className="bk-sticky__meta">
          <strong>{money(totalAmount)}</strong>
          <small>{T.toPay}</small>
        </div>
        <Button
          variant="accent"
          disabled={payDisabled}
          loading={paying}
          onClick={pay}
        >
          {paying ? T.starting : T.payNow}
        </Button>
      </div>

      <ConsultPlanPicker
        open={planSheetOpen}
        plans={activePlans}
        eligibility={planEligibility}
        selectedId={selectedPlan?.id}
        onSelect={handleSelectPlan}
        onPayNormally={() => {
          setPlanSheetOpen(false);
          clearSelectedPlan();
        }}
        onClose={() => setPlanSheetOpen(false)}
      />

      {verifying ? (
        <div
          className="bk-verify"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="bk-verify-title"
        >
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
