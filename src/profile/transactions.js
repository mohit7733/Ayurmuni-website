export const TRANSACTION_PAGE_SIZE = 10;

export const formatTransactionDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const mapStatusLabel = (status) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'success') return 'PAID';
  if (normalized === 'failed') return 'FAILED';
  if (normalized === 'pending') return 'PENDING';
  if (normalized === 'refunded') return 'REFUNDED';
  return String(status ?? 'UNKNOWN').toUpperCase();
};

export const getStatusColor = (status) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'success' || normalized === 'paid') return '#16A34A';
  if (normalized === 'failed' || normalized === 'refunded') return '#DC2626';
  if (normalized === 'pending') return '#F59E0B';
  return '#64748B';
};

export const getStatusDetailLabel = (status) => {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'success') return 'Paid';
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const mapTransactionIcon = (txn) => {
  const method = String(txn?.payment_method ?? '').toLowerCase();
  if (method.includes('upi') || method.includes('wallet')) return 'wallet';
  if (method.includes('card')) return 'card';
  if (txn?.order?.order_code) return 'cart';
  return 'receipt';
};

export const transactionIconGlyph = (iconName) => {
  if (iconName === 'wallet') return '₹';
  if (iconName === 'card') return '▣';
  if (iconName === 'cart') return '▣';
  if (iconName === 'refund') return '↩';
  return '≡';
};

export const formatEventType = (eventType) => {
  const text = String(eventType || '').replace(/_/g, ' ').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const getPaymentEntryTitle = (entry) => {
  if (entry?.doctor?.name) return `Dr. ${entry.doctor.name}`;
  return entry?.type === 'order' ? 'Order payment' : 'Consultation';
};

const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const paymentMonthKey = (at) => {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  return `${MONTHS_FULL[date.getMonth()]} ${date.getFullYear()}`;
};

export const mapPaymentHistoryEntry = (entry) => {
  const isCredit = entry?.entry_type === 'credit';
  return {
    id: String(entry?.id ?? ''),
    name: getPaymentEntryTitle(entry),
    date: formatTransactionDate(entry?.created_at),
    amount: Number(entry?.amount ?? 0),
    status: mapStatusLabel(entry?.status),
    iconName: isCredit ? 'refund' : entry?.type === 'order' ? 'cart' : 'receipt',
    paymentMethod: formatEventType(entry?.event_type),
    isCredit,
    month: paymentMonthKey(entry?.created_at),
    raw: entry,
  };
};

export const mapTransaction = (txn) => {
  const orderCode = txn?.order?.order_code;
  const referenceCode = txn?.reference_code;
  const paymentMethod = String(txn?.payment_method ?? txn?.payment_type ?? '')
    .replace(/_/g, ' ')
    .toUpperCase();

  return {
    id: String(txn.id),
    name: orderCode || referenceCode || 'Transaction',
    date: formatTransactionDate(txn.paid_at || txn.created_at),
    amount: Number(txn.amount ?? 0).toLocaleString('en-IN'),
    status: mapStatusLabel(txn.status),
    iconName: mapTransactionIcon(txn),
    paymentMethod,
    referenceCode,
    orderCode,
    raw: txn,
  };
};

export const normalizeTransactionList = (res) => {
  const data = res?.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  if (Array.isArray(res?.results)) return res.results;
  return [];
};

export const hasMoreTransactionPages = (res, pageResultsLength, pageSize) => {
  const data = res?.data;

  if (Array.isArray(data)) return false;

  if (data && typeof data === 'object' && 'next' in data) {
    return data.next != null && data.next !== '';
  }

  if (
    data &&
    typeof data === 'object' &&
    typeof data.count === 'number' &&
    typeof data.page === 'number'
  ) {
    return data.page * pageSize < data.count;
  }

  if (data && typeof data === 'object' && typeof data.count === 'number') {
    return pageResultsLength >= pageSize;
  }

  return pageResultsLength >= pageSize;
};
