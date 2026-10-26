import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { Button, EmptyState } from '../components/ui';
import '../design/pages/checkout.css';
import { CHECKOUT_KEY, ORDER_RESULT_KEY } from '../cart/mapCart';
import { CONSULT_BOOKING_KEY, CONSULT_PAY_KEY, CONSULT_PENDING_PAYMENT_KEY } from '../consult/doctors';
import {
  buildCashfreeVerifyPayload,
  clearCashfreePending,
  enrichCashfreeVerifyPayload,
  isCashfreePaymentVerified,
  isRecordUuid,
  readCashfreePending,
} from '../payment/cashfree';
import { getConsultationPayment, verifyConsultationPayment } from '../services/consultService';
import { getOrderById, verifyOrderPayment } from '../services/orderService';
import { showSuccessToast } from '../config/key';

export default function PaymentReturn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = readCashfreePending();
      const orderId = String(params.get('order_id') || pending?.orderId || '').trim();
      if (!pending?.kind) {
        if (!cancelled) {
          setPhase('failed');
          setMessage('We could not match this payment. Check My Orders, or start checkout again.');
        }
        return;
      }
      const checkout = {
        paymentId: pending.paymentId,
        orderId: orderId || pending.orderId || pending.gateway?.gateway_order_id,
        gatewayPaymentId: pending.gatewayPaymentId || pending.gateway?.gateway_payment_id,
        signature: pending.signature || pending.gateway?.gateway_signature,
        sessionId: pending.sessionId,
      };
      try {
        let payload = buildCashfreeVerifyPayload(checkout, {
          gateway: pending.gateway,
          searchParams: Object.fromEntries(params.entries()),
          rawMessage: pending.placed,
        });
        if (!payload.gateway_payment_id) {
          const loaders =
            pending.kind === 'consultation' && isRecordUuid(pending.paymentId)
              ? [() => getConsultationPayment(pending.paymentId)]
              : [pending.recordId, pending.placed?.data?.id, pending.placed?.data?.order?.id]
                  .map((value) => String(value || '').trim())
                  .filter((id) => isRecordUuid(id))
                  .map((id) => () => getOrderById(id));
          payload = await enrichCashfreeVerifyPayload(payload, loaders);
        }
        if (!payload.gateway_payment_id) {
          if (cancelled) return;
          setPhase('failed');
          setMessage('Cashfree has not returned the payment id yet. Wait a few seconds and open this page again.');
          return;
        }
        const verify =
          pending.kind === 'consultation'
            ? await verifyConsultationPayment(payload)
            : await verifyOrderPayment(payload);
        if (cancelled) return;
        if (!isCashfreePaymentVerified(verify)) {
          setPhase('failed');
          setMessage(verify?.message || 'Payment was not completed. You can try again.');
          return;
        }
        clearCashfreePending();
        showSuccessToast('Payment Successful', 'success');
        if (pending.kind === 'consultation') {
          sessionStorage.removeItem(CONSULT_PAY_KEY);
          sessionStorage.removeItem(CONSULT_PENDING_PAYMENT_KEY);
          const paid = verify?.data && typeof verify.data === 'object' ? verify.data : {};
          sessionStorage.setItem(
            CONSULT_BOOKING_KEY,
            JSON.stringify({ ...(pending.confirmBase || {}), ...paid }),
          );
          navigate('/consult/booking-confirm', { replace: true });
          return;
        }
        sessionStorage.removeItem(CHECKOUT_KEY);
        const order = verify?.data?.order ?? verify?.data ?? pending.placed?.data ?? pending.placed ?? {};
        sessionStorage.setItem(
          ORDER_RESULT_KEY,
          JSON.stringify({
            order,
            items: Array.isArray(pending.items) ? pending.items : [],
          }),
        );
        navigate('/order-confirmation', { replace: true });
      } catch (error) {
        if (cancelled) return;
        setPhase('failed');
        setMessage(error?.message || 'Unable to verify payment');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  if (phase === 'failed') {
    return (
      <AppShell tab="cart">
        <section className="co-page">
          <EmptyState
            title="Payment not confirmed"
            description={message}
            action={
              <>
                <Button variant="secondary" onClick={() => navigate('/profile/orders')}>
                  My orders
                </Button>
                <Button variant="primary" onClick={() => navigate('/cart')}>
                  Back to cart
                </Button>
              </>
            }
          />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell tab="cart">
      <div className="co-verify" role="alertdialog" aria-live="assertive" aria-busy="true">
        <div className="co-verify__panel">
          <p>Verifying payment</p>
          <h2>Please do not close this page</h2>
          <p>Payment is being verified. This may take a few seconds.</p>
        </div>
      </div>
    </AppShell>
  );
}
