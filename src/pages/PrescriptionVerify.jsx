import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { showSuccessToast } from '../config/key';
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
  const files = Array.isArray(location.state?.files) ? location.state.files : [];
  const variantIds = Array.isArray(location.state?.variantIds)
    ? location.state.variantIds.map(String).filter(Boolean)
    : [];
  const [notes, setNotes] = useState('');
  const [saveToRecords, setSaveToRecords] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState(null);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = files.map((file) =>
      file?.type === 'application/pdf' ? '' : URL.createObjectURL(file),
    );
    setPreviews(urls);
    return () => urls.forEach((url) => url && URL.revokeObjectURL(url));
  }, [files]);

  const requestId = request?.id ? String(request.id) : '';
  const pending = request ? isPrescriptionPending(request) : false;
  const approved = isPrescriptionApproved(request);
  const rejected = isPrescriptionRejected(request);
  const savedFiles = useMemo(() => getPrescriptionFiles(request), [request]);

  useEffect(() => {
    if (!requestId) return undefined;
    const load = async () => {
      const res = await getPrescriptionRequests({ id: requestId });
      const next = extractPrescriptionRequest(res);
      if (next) setRequest(next);
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
            <div key={item.uri || item.name || index} className="media-card">
              <div className="media-thumb">
                {item.uri && !/\.pdf/i.test(item.uri || '') ? (
                  <img src={item.uri} alt="" />
                ) : previews[index] ? (
                  <img src={previews[index]} alt="" />
                ) : (
                  <span>Rx</span>
                )}
              </div>
              <p>{item.name || `File ${index + 1}`}</p>
            </div>
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
            {rejected ? <p>This request was rejected. Please upload a clearer prescription.</p> : null}
            <div className="detail-cta">
              <button type="button" className="ghost" onClick={() => navigate('/medicines')}>
                Medicine store
              </button>
              <button
                type="button"
                className="cta"
                onClick={() =>
                  approved
                    ? navigate('/medicines/checkout', {
                        state: { request, notes: notes || request?.notes, approved: true },
                      })
                    : navigate('/medicines/order-status', {
                        state: { request, notes: notes || request?.notes },
                      })
                }
              >
                {approved ? 'Finalize order' : 'Track request'}
              </button>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
