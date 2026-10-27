import { getResponseMessage, hasOrderEntity, isHardPaymentFailure, isOrderSuccessful } from '../cart/mapCart';

/** Body for POST order/verify-payment/ after a Razorpay checkout (same keys as the app). */
export const buildRazorpayOrderVerifyPayload = ({ paymentId, orderId, result }) => {
  const gatewayOrderId = result?.razorpay_order_id || orderId;
  return {
    payment_id: paymentId,
    razorpay_order_id: gatewayOrderId,
    razorpay_payment_id: result?.razorpay_payment_id,
    razorpay_signature: result?.razorpay_signature,
    gateway_order_id: gatewayOrderId,
    gateway_payment_id: result?.razorpay_payment_id,
    gateway_signature: result?.razorpay_signature,
    payment_gateway: 'razorpay',
  };
};

/**
 * After a prepaid verify: success when the order exists, or money was collected and the error is
 * only fulfilment noise (stock/Unicommerce sync). Mirrors the app's isPrepaidVerifyAcceptable.
 */
export const isPrepaidVerifyAcceptable = (response, razorpayResult) => {
  if (isOrderSuccessful(response)) return true;
  if (!razorpayResult?.razorpay_payment_id) return false;
  const msg = getResponseMessage(response);
  if (isHardPaymentFailure(msg)) return false;
  if (
    (msg.includes('out of stock') ||
      msg.includes('insufficient') ||
      msg.includes('not available') ||
      msg.includes('no stock')) &&
    !hasOrderEntity(response)
  ) {
    return false;
  }
  return true;
};