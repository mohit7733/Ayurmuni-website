import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PrescriptionFilePreview from '../components/PrescriptionFilePreview';
import { showSuccessToast } from '../config/key';
import { formatRupee } from '../home/catalog';
import {
  getVerifyCta,
  pickPrescribedItems,
  resolveVerifyParams,
} from '../cart/rxGroups';
import '../design/pages/rx-verify.css';
import { UploadProfilePhoto } from '../services/profileService';
import {
  createPrescriptionRequest,
  extractPrescriptionRequest,
  extractUploadUrl,
  getPrescriptionFiles,
  getPrescriptionRequests,
  getStatusLabel,
  isPrescriptionApproved,
  isPrescriptionPending,
  isPrescriptionRejected,
} from '../services/prescriptionService';

export default function PrescriptionVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  // An existing request (from the cart's uploaded-prescription Details, or ?requestId=) opens
  // read-only and polls, as in the app; otherwise this is the upload-and-submit flow.
  const params = useMemo(
    () => resolveVerifyParams(location.state, location.search),
    [location.state, location.search],
  );
  const { files, previewItems } = params;
  const [notes, setNotes] = useState(String(params.existingRequest?.notes || '').trim());
  const [saveToRecords, setSaveToRecords] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState(params.existingRequest);
  const [loadFailed, setLoadFailed] = useState(false);
  const [previews, setPreviews] = useState([]);
  const variantIds = useMemo(() => {
    const fromRequest = Array.isArray(request?.variant_ids) ? request.variant_ids : [];
    return [...new Set([...params.variantIds, ...fromRequest].map(String).filter(Boolean))];
  }, [params.variantIds, request]);

  useEffect(() => {
    const urls = files.map((file) => (file instanceof File ? URL.createObjectURL(file) : ''));
    setPreviews(urls);
    return () => urls.forEach((url) => url && URL.revokeObjectURL(url));
  }, [files]);

  const requestId = String(params.requestId || request?.prescription_request_id || request?.id || '');
  const pending = request ? isPrescriptionPending(request) : false;
  const approved = isPrescriptionApproved(request);
  const rejected = isPrescriptionRejected(request);
  const savedFiles = useMemo(() => getPrescriptionFiles(request), [request]);

  useEffect(() => {
    if (!requestId) return undefined;
    const load = async () => {
      try {
        const res = await getPrescriptionRequests({ id: requestId });
        const next = extractPrescriptionRequest(res);
        if (next) {
          setRequest(next);
          setLoadFailed(false);
        }
      } catch {
        setLoadFailed(true);
      }
    };
    load();
    const timer = setInterval(load, 12000);
    return () => clearInterval(timer);
  }, [requestId]);

  const submitRequest = async () => {
    if (requestId && request) {
      showSuccessToast('Request already submitted', 'success');
      return;
    }
    if (!files.length) {
      showSuccessToast('Missing prescription file', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const fileUrls = [];
      for (const file of files) {
        const body = new FormData();
        body.append('image', file);
        body.append('dir', 'prescription_requests');
        const uploadResponse = await UploadProfilePhoto(body);
        const fileUrl = extractUploadUrl(uploadResponse);
        if (!fileUrl) throw new Error('Upload failed');
        fileUrls.push(fileUrl);
      }
      const payload = {
        file_url: fileUrls[0],
        file_urls: fileUrls,
        file_type: files.some((file) => String(file.type).includes('pdf')) ? 'pdf' : 'image',
        notes: notes.trim() || undefined,
        variant_ids: variantIds,
        save_to_medical_records: saveToRecords,
      };
      const res = await createPrescriptionRequest(payload);
      if (res?.success === false) {
        throw new Error(res?.message || 'Could not submit request');
      }
      const created = extractPrescriptionRequest(res) || {
        ...payload,
        id: res?.data?.id,
        status: 'pending_review',
      };
      if (!created.status) created.status = 'pending_review';
      setRequest(created);
      showSuccessToast(
        'Submitted — pending pharmacist review (usually 12–24 hours)',
        'success',
      );
      if (isPrescriptionApproved(created)) {
        navigate('/medicines/checkout', {
          state: { request: created, notes: notes.trim(), approved: true },
        });
      } else {
        navigate('/medicines/order-status', {
          state: { request: created, notes: notes.trim() },
        });
      }
    } catch (error) {
      showSuccessToast(error?.message || 'Failed to submit prescription', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const prescribedItems = pickPrescribedItems(request, previewItems);
  const cta = getVerifyCta(request, { approved, rejected, pending });
  const onCta = () => {
    if (cta.action === 'finalize') {
      navigate('/medicines/checkout', {
        state: { request, notes: notes || request?.notes, approved: true },
      });
    } else if (cta.action === 'upload') {
      showSuccessToast('This request was rejected. Please upload a clearer prescription.', 'error');
      navigate('/medicines/prescription', { state: { variantIds } });
    } else if (cta.action === 'view') {
      navigate('/profile/orders', { state: { tab: 'requested', requestId } });
    } else {
      showSuccessToast('Waiting for prescription approval', 'error');
    }
  };

  if (!files.length && !request && requestId && !loadFailed) {
    return (
      <AppShell tab="medicines">
        <section className="catalog-page">
          <p className="empty-copy">Loading prescription request…</p>
        </section>
      </AppShell>
    );
  }

  if (!files.length && !request) {
    return (
      <AppShell tab="medicines">
        <section className="catalog-page">
          <p className="empty-copy">No prescription file selected</p>
          <button type="button" className="cta" onClick={() => navigate('/medicines/prescription')}>
            Upload again
          </button>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell tab="medicines">
      <section className="catalog-page rx-verify-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Verify prescription</h1>
            <p>{request ? getStatusLabel(request) : 'Review and submit'}</p>
          </div>
        </header>

        <div className="home-rail">
          {(savedFiles.length ? savedFiles : files).map((item, index) => (
            <PrescriptionFilePreview
              key={item.uri || item.name || index}
              uri={item.uri || previews[index]}
              fileType={item.fileType || item.type}
              label={item.name || `File ${index + 1}`}
            />
          ))}
        </div>

        {!request ? (
          <>
            <label className="form-field">
              Notes for pharmacist
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={saveToRecords}
                onChange={(e) => setSaveToRecords(e.target.checked)}
              />
              Save to medical records
            </label>
            <button type="button" className="cta" disabled={submitting} onClick={submitRequest}>
              {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
          </>
        ) : (
          <div className="checkout-card">
            <h3>{getStatusLabel(request)}</h3>
            {pending ? <p>A pharmacist usually reviews this within 12–24 hours.</p> : null}
            {approved ? <p>Approved. You can add this medicine to cart from the product page.</p> : null}
            {rejected ? (
              <p>{request?.rejection_reason || 'This request was rejected. Please upload a clearer prescription.'}</p>
            ) : null}
            <div className="detail-cta">
              <button type="button" className="ghost" onClick={() => navigate('/medicines')}>
                Medicine store
              </button>
              <button
                type="button"
                className="cta"
                onClick={onCta}
              >
                {cta.label}
              </button>
            </div>
          </div>
        )}

        {request && (notes || request?.notes) ? (
          <div className="rx-notes">
            <small>Your notes</small>
            <p>{notes || request?.notes}</p>
          </div>
        ) : null}

        {prescribedItems.length ? (
          <div className="rx-items">
            <h2>
              {approved ? 'Prescribed items' : 'Requested items'} ({prescribedItems.length})
            </h2>
            {prescribedItems.map((item, index) => {
              const qty = Math.max(1, Number(item.raw?.quantity) || 1);
              return (
                <div key={`${item.id}-${index}`} className="rx-item">
                  <span className="rx-item__thumb">
                    {item.image ? <img src={item.image} alt="" loading="lazy" /> : null}
                  </span>
                  <span className="rx-item__copy">
                    <strong>{item.name}</strong>
                    {item.desc ? <small>{item.desc}</small> : null}
                    {item.notes ? <small>{item.notes}</small> : null}
                  </span>
                  <span className="rx-item__side">
                    <span>×{qty}</span>
                    {item.price != null ? <span>{formatRupee(item.price)}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
