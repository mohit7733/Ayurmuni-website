import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FileText,
  Leaf,
  ShieldCheck,
  Store,
  Upload,
  XCircle,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import AdvanceLoad from '../components/ui/AdvanceLoad';
import PrescriptionFilePreview from '../components/PrescriptionFilePreview';
import { Badge, Button } from '../components/ui';
import { showSuccessToast } from '../config/key';
import { formatRupee } from '../home/catalog';
import {
  getVerifyCta,
  pickPrescribedItems,
  resolveVerifyParams,
} from '../cart/rxGroups';
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
import { formatPrescriptionId } from '../utils/formatDisplayId';
import '../design/pages/rx-verify.css';

const STEPS = ['Upload', 'Verify', 'Review'];

export default function PrescriptionVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(
    () => resolveVerifyParams(location.state, location.search),
    [location.state, location.search],
  );
  const { files, previewItems } = params;
  const productName = String(location.state?.productName || '').trim();
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
  const displayFiles = savedFiles.length ? savedFiles : files;

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
          state: { request: created, notes: notes.trim(), approved: true, productName },
        });
      } else {
        navigate('/medicines/order-status', {
          state: { request: created, notes: notes.trim(), productName },
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
      navigate('/cart', {
        state: { request, notes: notes || request?.notes, approved: true, productName },
      });
    } else if (cta.action === 'upload') {
      showSuccessToast('This request was rejected. Please upload a clearer prescription.', 'error');
      navigate('/medicines/prescription', {
        state: { variantIds, productName },
      });
    } else if (cta.action === 'view') {
      navigate('/profile/orders', { state: { tab: 'requested', requestId } });
    } else {
      showSuccessToast('Waiting for prescription approval', 'error');
    }
  };

  const statusTone = rejected ? 'danger' : approved ? 'success' : 'warning';
  const statusClass = rejected ? 'is-rejected' : approved ? 'is-approved' : 'is-pending';
  const StatusIcon = rejected ? XCircle : approved ? CheckCircle2 : Clock3;
  const statusCopy = rejected
    ? request?.rejection_reason ||
      'This request was rejected. Please upload a clearer prescription.'
    : approved
      ? 'Approved. You can continue to checkout for this medicine.'
      : 'A pharmacist usually reviews this within 12–24 hours.';

  if (!files.length && !request && requestId && !loadFailed) {
    return (
      <AppShell tab="medicines">
        <section className="rxv">
          <div className="rxv-shell">
            <AdvanceLoad variant="detail" label="Loading prescription request" />
          </div>
        </section>
      </AppShell>
    );
  }

  if (!files.length && !request) {
    return (
      <AppShell tab="medicines">
        <section className="rxv">
          <div className="rxv-shell">
            <header className="rxv-head">
              <button
                type="button"
                className="am-back"
                onClick={() => navigate('/medicines/prescription')}
                aria-label="Back"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <div className="rxv-head__copy">
                <p className="rxv-eyebrow">Medicines</p>
                <h1>Verify prescription</h1>
                <p>No file to review yet</p>
              </div>
            </header>
            <div className="rxv-card rxv-empty">
              <span className="rxv-empty__mark" aria-hidden>
                <FileText size={22} strokeWidth={1.85} />
              </span>
              <strong>No prescription file selected</strong>
              <p>Go back and upload a photo or PDF to continue.</p>
              <Button
                variant="primary"
                leadingIcon={<Upload size={16} aria-hidden />}
                onClick={() => navigate('/medicines/prescription')}
              >
                Upload prescription
              </Button>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell tab="medicines">
      <section className="rxv">
        <div className="rxv-shell">
          <header className="rxv-head">
            <button type="button" className="am-back" onClick={() => navigate(-1)} aria-label="Back">
              <ChevronLeft size={20} aria-hidden />
            </button>
            <div className="rxv-head__copy">
              <p className="rxv-eyebrow">Medicines</p>
              <h1>Verify prescription</h1>
              <p>
                {productName
                  ? productName
                  : request
                    ? getStatusLabel(request)
                    : 'Review and submit · Step 2 of 3'}
              </p>
            </div>
          </header>

          <ol className="rxv-steps" aria-label="Prescription steps">
            {STEPS.map((label, index) => {
              const step = index + 1;
              const current = 2;
              const done = step < current || Boolean(request && approved);
              const active = step === current && !approved;
              return (
                <li
                  key={label}
                  className={`rxv-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
                >
                  <span className="rxv-step__dot" aria-hidden>
                    {done ? <CheckCircle2 size={14} /> : step}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>

          {productName && !request ? (
            <aside className="rxv-notice">
              <div className="rxv-notice__mark" aria-hidden>
                <ShieldCheck size={16} strokeWidth={1.85} />
              </div>
              <div>
                <strong>Ready to submit</strong>
                <p>Confirm your Rx file for “{productName}”.</p>
              </div>
            </aside>
          ) : null}

          <section className="rxv-card">
            <div className="rxv-card__head">
              <h2 className="rxv-card__title">
                {displayFiles.length === 1
                  ? 'Prescription file'
                  : `Prescription files (${displayFiles.length})`}
              </h2>
              {!request ? (
                <button
                  type="button"
                  className="rxv-card__link"
                  onClick={() =>
                    navigate('/medicines/prescription', {
                      state: { variantIds, productName },
                    })
                  }
                >
                  Change
                </button>
              ) : null}
            </div>
            <div className="rxv-files">
              {displayFiles.map((item, index) => (
                <div key={item.uri || item.name || index} className="rxv-file">
                  <PrescriptionFilePreview
                    uri={item.uri || previews[index]}
                    fileType={item.fileType || item.type}
                    label={item.name || `File ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          </section>

          {!request ? (
            <section className="rxv-card">
              <h2 className="rxv-card__title">Details for pharmacist</h2>
              <label className="rxv-field">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional — doctor name, dosage, or special instructions"
                />
              </label>
              <label className="rxv-check">
                <input
                  type="checkbox"
                  checked={saveToRecords}
                  onChange={(e) => setSaveToRecords(e.target.checked)}
                />
                <span>Save this prescription to my medical records</span>
              </label>
            </section>
          ) : (
            <section className={`rxv-card rxv-status ${statusClass}`}>
              <div className="rxv-status__head">
                <span className="rxv-status__icon" aria-hidden>
                  <StatusIcon size={18} strokeWidth={1.85} />
                </span>
                <div className="rxv-status__copy">
                  <strong>{getStatusLabel(request)}</strong>
                  {request?.id ? <small>{formatPrescriptionId(request.id)}</small> : null}
                </div>
                <Badge tone={statusTone} icon={<StatusIcon size={12} aria-hidden />}>
                  {approved ? 'Approved' : rejected ? 'Rejected' : 'In review'}
                </Badge>
              </div>
              <p>{statusCopy}</p>
            </section>
          )}

          {request && (notes || request?.notes) ? (
            <section className="rxv-card rxv-notes">
              <small>Your notes</small>
              <p>{notes || request?.notes}</p>
            </section>
          ) : null}

          {prescribedItems.length ? (
            <section className="rxv-card">
              <h2 className="rxv-card__title">
                {approved ? 'Prescribed items' : 'Requested items'} ({prescribedItems.length})
              </h2>
              <div className="rxv-items">
                {prescribedItems.map((item, index) => {
                  const qty = Math.max(1, Number(item.raw?.quantity) || 1);
                  return (
                    <div key={`${item.id}-${index}`} className="rxv-item">
                      <span className="rxv-item__thumb" aria-hidden>
                        {item.image ? (
                          <img src={item.image} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <Leaf size={18} strokeWidth={1.85} />
                        )}
                      </span>
                      <span className="rxv-item__copy">
                        <strong>{item.name}</strong>
                        {item.desc ? <small>{item.desc}</small> : null}
                        {item.notes ? <small>{item.notes}</small> : null}
                      </span>
                      <span className="rxv-item__side">
                        <span>×{qty}</span>
                        {item.price != null ? <span>{formatRupee(item.price)}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="rxv-foot">
            {!request ? (
              <Button
                variant="primary"
                block
                loading={submitting}
                leadingIcon={<ShieldCheck size={18} aria-hidden />}
                onClick={submitRequest}
              >
                Submit for review
              </Button>
            ) : (
              <div className="rxv-foot__row">
                <Button
                  variant="secondary"
                  leadingIcon={<Store size={16} aria-hidden />}
                  onClick={() => navigate('/medicines')}
                >
                  Medicine store
                </Button>
                <Button variant="primary" onClick={onCta}>
                  {cta.label}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
