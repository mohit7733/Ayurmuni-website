import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/services/apiClient', () => ({ apiClient: vi.fn(), invalidateApiCache: vi.fn() }));

import {
  buildDoctorDetailRoute,
  buildUploadVerifyRoute,
  getVerifyCta,
  groupRxLines,
  groupSubtotal,
  isUploadRxLine,
  pickPrescribedItems,
  previewItemsFor,
  resolveVerifyParams,
  splitRxGroups,
  toggleGroupSelection,
  buildRequestViewRoute,
} from '../src/cart/rxGroups';

const upload = (id, group, extra = {}) => ({
  id,
  price: 100,
  quantity: 2,
  rx_group_id: group,
  rx_source: 'upload',
  rx_group: { id: group, source: 'upload', prescription_request_id: extra.req, subtotal: 500 },
  ...extra.line,
});
const doctor = (id, group) => ({
  id,
  price: 50,
  quantity: 1,
  rx_group_id: group,
  rx_source: 'doctor',
  rx_group: { id: group, source: 'doctor', appointment_id: 'a1', prescription_id: 'p1', doctor_id: 'd1', doctor_name: 'Dr A' },
  appointment_id: 'a1',
});

describe('cart rx grouping', () => {
  it('detects uploads from rx_source or the group source', () => {
    expect(isUploadRxLine({ rx_source: 'upload' })).toBe(true);
    expect(isUploadRxLine({ rx_group: { source: 'UPLOAD' } })).toBe(true);
    expect(isUploadRxLine({ rx_source: 'doctor' })).toBe(false);
    expect(isUploadRxLine({})).toBe(false);
  });

  it('groups uploads by prescription_request_id and doctors by group id', () => {
    const lines = [
      upload('1', 'g1', { req: 'R1' }),
      upload('2', 'g2', { req: 'R1' }),
      upload('3', 'g3', { req: 'R2' }),
      doctor('4', 'g9'),
      doctor('5', 'g9'),
    ];
    const groups = groupRxLines(lines);
    expect(groups.map((g) => [g.kind, g.items.map((l) => l.id)])).toEqual([
      ['upload', ['1', '2']],
      ['upload', ['3']],
      ['doctor', ['4', '5']],
    ]);
    const { doctor: d, upload: u } = splitRxGroups(groups);
    expect(d).toHaveLength(1);
    expect(u).toHaveLength(2);
  });

  it('falls back to the cart group id without a request id', () => {
    const groups = groupRxLines([upload('1', 'g1'), upload('2', 'g1'), upload('3', 'g2')]);
    expect(groups.map((g) => g.items.length)).toEqual([2, 1]);
  });

  it('computes subtotal from meta for one API group, else from lines', () => {
    const [single] = groupRxLines([upload('1', 'g1', { req: 'R1' })]);
    expect(groupSubtotal(single)).toBe(500);
    const [merged] = groupRxLines([upload('1', 'g1', { req: 'R1' }), upload('2', 'g2', { req: 'R1' })]);
    expect(groupSubtotal(merged)).toBe(400);
    expect(groupSubtotal({ items: [], meta: {} })).toBeNull();
  });

  it('toggles a group selection, skipping out-of-stock lines', () => {
    const group = { items: [{ id: '1' }, { id: '2', _isOutOfStock: true }, { id: '3' }] };
    expect(toggleGroupSelection([], group)).toEqual(['1', '3']);
    expect(toggleGroupSelection(['1', '3', '9'], group)).toEqual(['9']);
    expect(toggleGroupSelection(['9'], { items: [{ id: '2', _isOutOfStock: true }] })).toEqual(['9']);
  });

  it('builds the verify route with the existing request', () => {
    const [group] = groupRxLines([upload('1', 'g1', { req: 'R1' })]);
    const route = buildUploadVerifyRoute(group);
    expect(route.path).toBe('/medicines/prescription/verify');
    expect(route.state.requestId).toBe('R1');
    expect(route.state.existingRequest.prescription_request_id).toBe('R1');
    expect(route.state.previewItems).toEqual(group.items);
    expect(previewItemsFor({ meta: { items: [{ a: 1 }] }, items: [{ b: 2 }] })).toEqual([{ a: 1 }]);
  });

  it('builds the doctor details route only with ids', () => {
    const [group] = groupRxLines([doctor('4', 'g9')]);
    const route = buildDoctorDetailRoute(group);
    expect(route.path).toBe('/profile/prescriptions/a1');
    expect(route.state.doctorData.doctor_id).toBe('d1');
    expect(buildDoctorDetailRoute({ items: [{}], meta: {} })).toBeNull();
  });
});

describe('verify screen params', () => {
  it('uses an existing request and its id', () => {
    const p = resolveVerifyParams({ requestId: 77, existingRequest: { id: 5, notes: 'n' } });
    expect(p.requestId).toBe('77');
    expect(p.existingRequest.notes).toBe('n');
    expect(p.files).toEqual([]);
  });

  it('falls back to the request id, then ?requestId=', () => {
    expect(resolveVerifyParams({ existingRequest: { prescription_request_id: 'X', id: 1 } }).requestId).toBe('X');
    expect(resolveVerifyParams(null, '?requestId=42').requestId).toBe('42');
    expect(resolveVerifyParams(null, '').requestId).toBe('');
  });

  it('keeps the upload flow params', () => {
    const f = new Blob(['x']);
    const p = resolveVerifyParams({ files: [f], variantIds: [1, '', 2] });
    expect(p.files).toEqual([f]);
    expect(p.variantIds).toEqual(['1', '2']);
    expect(p.existingRequest).toBeNull();
  });

  it('prefers the longer item list and keeps raw quantity', () => {
    const items = pickPrescribedItems(
      { items: [{ variant_title: 'A', quantity: 3 }] },
      [{ name: 'B' }, { name: 'C' }],
    );
    expect(items.map((i) => i.name)).toEqual(['B', 'C']);
    const own = pickPrescribedItems({ requested_variants: [{ variant_title: 'A', quantity: 3 }] }, []);
    expect(own[0].raw.quantity).toBe(3);
    expect(pickPrescribedItems(null, [])).toEqual([]);
  });

  it('maps request status to the CTA', () => {
    const none = { approved: false, rejected: false, pending: false };
    expect(getVerifyCta(null, none).action).toBe('submit');
    expect(getVerifyCta({}, { ...none, approved: true }).label).toBe('Finalize order');
    expect(getVerifyCta({}, { ...none, rejected: true }).action).toBe('upload');
    expect(getVerifyCta({}, { ...none, pending: true }).action).toBe('view');
    expect(getVerifyCta({}, none).action).toBe('wait');
  });
});

describe('buildRequestViewRoute', () => {
  it('opens the existing request in the verify screen', () => {
    const item = { id: 5, prescription_request_id: 'r-9', status: 'pending' };
    expect(buildRequestViewRoute(item)).toEqual({
      path: '/medicines/prescription/verify',
      state: { requestId: 'r-9', existingRequest: item },
    });
    expect(buildRequestViewRoute({ id: 5 }).state.requestId).toBe('5');
  });
});
