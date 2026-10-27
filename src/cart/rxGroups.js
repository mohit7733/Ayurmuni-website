import { getPrescribedItems, mapPrescribedItem } from '../services/prescriptionService';

/**
 * Prescribed-cart grouping, ported from the app's MyCart.tsx (groupRxLines / doctorRxGroups /
 * uploadRxGroups / previewItemsFor) and VerifyPresciption.tsx route params.
 */

/** App: prescription_cart.items[].source === 'upload' marks an uploaded-prescription group. */
export const isUploadRxLine = (line) =>
  String(line?.rx_source ?? line?.rx_group?.source ?? '').toLowerCase() === 'upload';

const requestIdOf = (line) => {
  const raw = line?.rx_group?.prescription_request_id ?? line?.prescription_request_id;
  return raw == null || raw === '' ? '' : String(raw);
};

/**
 * Groups prescribed lines. Uploaded lines are grouped by prescription_request_id (falling back to
 * the cart group id), doctor lines by the cart group id. Each group: { key, kind, meta, items }.
 */
export const groupRxLines = (lines) => {
  const groups = new Map();
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    if (!line) return;
    const kind = isUploadRxLine(line) ? 'upload' : 'doctor';
    const requestId = kind === 'upload' ? requestIdOf(line) : '';
    const id = requestId ? `req:${requestId}` : String(line.rx_group_id || line.id);
    const key = `${kind}:${id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(line);
      return;
    }
    groups.set(key, { key, kind, meta: line.rx_group || line, items: [line] });
  });
  return [...groups.values()];
};

/** The app's two lists (doctorRxGroups / uploadRxGroups), each keeping API order. */
export const splitRxGroups = (groups) => ({
  doctor: groups.filter((g) => g.kind === 'doctor'),
  upload: groups.filter((g) => g.kind === 'upload'),
});

/** Items shown on the verify screen: the request's own list, else the cart lines. */
export const previewItemsFor = (group) => {
  const raw = Array.isArray(group?.meta?.items) ? group.meta.items : [];
  return raw.length ? raw : group?.items || [];
};

const lineTotal = (line) => (Number(line?.price) || 0) * (Number(line?.quantity) || 1);

/** meta.subtotal when the group is one API group, else the sum of its lines. */
export const groupSubtotal = (group) => {
  const ids = new Set((group?.items || []).map((l) => String(l?.rx_group_id ?? '')));
  const fromMeta = group?.meta?.subtotal;
  if (ids.size <= 1 && fromMeta != null && fromMeta !== '' && Number.isFinite(Number(fromMeta))) {
    return Number(fromMeta);
  }
  const sum = (group?.items || []).reduce((n, l) => n + lineTotal(l), 0);
  return sum > 0 ? sum : null;
};

/** Select/deselect all in-stock lines of a group (app: group checkbox). */
export const toggleGroupSelection = (selected, group) => {
  const ids = (group?.items || []).filter((l) => !l._isOutOfStock).map((l) => String(l.id));
  if (!ids.length) return selected;
  const all = ids.every((id) => selected.includes(id));
  return all
    ? selected.filter((id) => !ids.includes(id))
    : [...new Set([...selected, ...ids])];
};

/** Route + state for "Details" on an uploaded group (app: navigate('VerifyPresciption', ...)). */
export const buildUploadVerifyRoute = (group) => {
  const meta = group?.meta || {};
  const previewItems = previewItemsFor(group);
  return {
    path: '/medicines/prescription/verify',
    state: {
      requestId: meta.prescription_request_id || requestIdOf(group?.items?.[0]) || meta.id || '',
      existingRequest: { ...meta, items: previewItems },
      previewItems,
    },
  };
};

/** Route + state for "Details" on a doctor group (PrescriptionDetail), or null without ids. */
export const buildDoctorDetailRoute = (group) => {
  const first = group?.items?.[0] || {};
  const meta = group?.meta || {};
  const appointmentId = meta.appointment_id ?? first.appointment_id;
  const consultationId = meta.consultation_id ?? first.consultation_id;
  if (!appointmentId && !consultationId) return null;
  return {
    path: `/profile/prescriptions/${consultationId || appointmentId}`,
    state: {
      appointment_id: appointmentId,
      consultation_id: consultationId,
      prescription_id: meta.prescription_id ?? first.prescription_id,
      doctorData: {
        doctor_name: meta.doctor_name ?? first.doctorName,
        id: meta.doctor_id ?? first.doctor_id,
        doctor_id: meta.doctor_id ?? first.doctor_id,
      },
    },
  };
};

/**
 * PrescriptionVerify inputs from router state (or ?requestId=): an existing request opens the
 * screen read-only/polling instead of the upload form, as in the app.
 */
export const resolveVerifyParams = (state, search = '') => {
  const query = new URLSearchParams(search || '');
  const existingRequest =
    state?.existingRequest && typeof state.existingRequest === 'object' ? state.existingRequest : null;
  const requestId = String(
    state?.requestId ?? query.get('requestId') ?? existingRequest?.prescription_request_id ?? existingRequest?.id ?? '',
  ).trim();
  return {
    files: Array.isArray(state?.files) ? state.files : [],
    variantIds: Array.isArray(state?.variantIds) ? state.variantIds.map(String).filter(Boolean) : [],
    existingRequest,
    requestId,
    previewItems: Array.isArray(state?.previewItems) ? state.previewItems : [],
  };
};

/** App VerifyPresciption.prescribedItems: prefer the longer of request vs route preview list. */
export const pickPrescribedItems = (request, previewItems = []) => {
  const withRaw = (raw, index) => ({ ...mapPrescribedItem(raw, index), raw });
  const fromRequest = getPrescribedItems(request).map(withRaw);
  const fromRoute = (Array.isArray(previewItems) ? previewItems : []).map(withRaw);
  if (fromRequest.length >= fromRoute.length && fromRequest.length) return fromRequest;
  return fromRoute.length ? fromRoute : fromRequest;
};

/** What the verify CTA does for an existing request (app: submit / finalize / upload again / view). */
export const getVerifyCta = (request, { approved, rejected, pending }) => {
  if (!request) return { action: 'submit', label: 'Submit for review' };
  if (approved) return { action: 'finalize', label: 'Finalize order' };
  if (rejected) return { action: 'upload', label: 'Upload again' };
  if (pending) return { action: 'view', label: 'View request' };
  return { action: 'wait', label: 'Waiting for approval' };
};

/** "View request" from Orders -> Requested (app OrderHistory): opens the request in PrescriptionVerify. */
export const buildRequestViewRoute = (item) => {
  const requestId = String(item?.prescription_request_id || item?.id || '').trim();
  return {
    path: '/medicines/prescription/verify',
    state: { requestId, existingRequest: item },
  };
};
