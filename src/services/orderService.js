import { Utils } from '../common/utils';
import { BaseUrl } from '../config/key';
import { apiClient } from './apiClient';

export const getOrderFeeQuote = async (payload) => {
  const body = { cart_item_ids: payload.cart_item_ids || [] };
  const coupon = String(payload.coupon_code || '').trim();
  if (coupon) body.coupon_code = coupon;
  return apiClient('order/fee-quote/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const placeOrder = async (data) =>
  apiClient('order/', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const verifyOrderPayment = async (data) =>
  apiClient('order/verify-payment/', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getOrders = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  const search = String(params.search || '').trim();
  if (search) query.set('search', search);
  const qs = query.toString();
  return apiClient(qs ? `order/?${qs}` : 'order/', { method: 'GET' });
};

export const getTransactions = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return apiClient(qs ? `order/transactions/?${qs}` : 'order/transactions/', {
    method: 'GET',
  });
};

/** GET payments/customer/history/ — consultation + order payments and refunds. */
export const getCustomerPaymentHistory = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.type) query.set('type', params.type);
  if (params.entry_type) query.set('entry_type', params.entry_type);
  if (params.date_from) query.set('date_from', params.date_from);
  if (params.date_to) query.set('date_to', params.date_to);
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  const qs = query.toString();
  return apiClient(
    qs ? `payments/customer/history/?${qs}` : 'payments/customer/history/',
    { method: 'GET' },
  );
};

export const getOrderById = async (orderId) =>
  apiClient(`order/${encodeURIComponent(String(orderId))}/`, { method: 'GET' });

export const cancelOrder = async (orderId, data) =>
  apiClient(`order/${encodeURIComponent(String(orderId))}/cancel/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const pollOrderTracking = async (orderId) =>
  apiClient(`order/${encodeURIComponent(String(orderId))}/unicommerce-poll/`, {
    method: 'POST',
  });

export const extractLiveTracking = (pollResponse) => {
  const raw = pollResponse?.data?.data ?? pollResponse?.data ?? pollResponse ?? {};
  const trackingNumber = String(
    raw?.tracking_number ??
      raw?.awb_number ??
      raw?.awb ??
      raw?.shipment_tracking_number ??
      raw?.tracking_id ??
      '',
  ).trim();
  if (!trackingNumber) return null;

  const historyRaw = Array.isArray(raw?.tracking_history)
    ? raw.tracking_history
    : Array.isArray(raw?.status_history)
      ? raw.status_history
      : Array.isArray(raw?.scans)
        ? raw.scans
        : Array.isArray(raw?.activities)
          ? raw.activities
          : [];

  const locationHistory = historyRaw
    .slice()
    .reverse()
    .slice(0, 6)
    .map((entry, idx) => {
      const label = String(
        entry?.description ?? entry?.status ?? entry?.activity ?? entry?.title ?? entry?.location ?? 'Update',
      ).trim();
      let timeStr = String(entry?.timestamp ?? entry?.date ?? entry?.created_at ?? entry?.time ?? '').trim();
      if (timeStr) {
        const parsed = new Date(timeStr);
        if (!Number.isNaN(parsed.getTime())) {
          timeStr = parsed.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
      }
      return { label, time: timeStr, active: idx === 0 };
    });

  const lastRaw = raw?.updated_at ?? raw?.last_updated ?? '';
  const lastParsed = lastRaw ? new Date(lastRaw) : null;

  return {
    trackingNumber,
    carrier: String(raw?.carrier ?? raw?.courier ?? raw?.courier_name ?? raw?.shipping_carrier ?? '').trim(),
    status: String(raw?.shipment_status ?? raw?.tracking_status ?? raw?.current_status ?? raw?.order_status ?? '').trim(),
    currentLocation: String(
      raw?.current_location ?? raw?.tracking_location ?? raw?.last_location ?? raw?.location ?? '',
    ).trim(),
    eta: String(
      raw?.estimated_delivery_time ?? raw?.delivery_eta ?? raw?.expected_delivery ?? raw?.promised_delivery_date ?? '',
    ).trim(),
    agentName: String(
      raw?.delivery_partner?.name ?? raw?.delivery_agent?.name ?? raw?.delivery_person?.name ?? raw?.rider_name ?? '',
    ).trim(),
    agentPhone: String(
      raw?.delivery_partner?.phone ??
        raw?.delivery_agent?.phone ??
        raw?.delivery_person?.phone ??
        raw?.rider_phone ??
        '',
    ).trim(),
    locationHistory,
    lastUpdated:
      lastParsed && !Number.isNaN(lastParsed.getTime())
        ? lastParsed.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : String(lastRaw || ''),
  };
};

export const downloadInvoiceFile = async (orderId) => {
  const token = await Utils.getData('_TOKEN');
  if (!token) throw new Error('Not authenticated');

  const url = `${BaseUrl.base_url}order/${encodeURIComponent(String(orderId))}/invoice/`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/pdf, application/octet-stream, */*',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let errMsg = `Invoice download failed: ${response.status}`;
    try {
      const errBody = await response.text();
      if (errBody) errMsg += ` — ${errBody.slice(0, 200)}`;
    } catch {
      /* ignore */
    }
    throw new Error(errMsg);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    const pdfUrl = json?.data?.url ?? json?.url ?? json?.invoice_url ?? json?.file_url;
    if (pdfUrl) {
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) throw new Error(`Invoice PDF fetch failed: ${pdfResponse.status}`);
      return { success: true, status: pdfResponse.status, data: await pdfResponse.arrayBuffer() };
    }
    throw new Error('Invoice URL not found in response');
  }

  return { success: true, status: response.status, data: await response.arrayBuffer() };
};

export const normalizeOrdersList = (response) => {
  if (response?.success === false) return [];
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

export const extractOrderDetail = (response) => {
  const raw =
    response?.data?.data ??
    response?.data?.order ??
    response?.data ??
    response?.order ??
    response ??
    null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (Array.isArray(raw.results) || Array.isArray(raw.orders)) return null;
  if (raw.id || raw.order_id || raw.order_code) return raw;
  return null;
};
