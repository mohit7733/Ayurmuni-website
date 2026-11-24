import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Aperture,
  Camera,
  ChevronLeft,
  FileText,
  Images,
  ScanLine,
  ShieldCheck,
  SunMedium,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { Badge, Button } from '../components/ui';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import PrescriptionFilePreview, {
  PrescriptionPreviewModal,
} from '../components/PrescriptionFilePreview';
import {
  createPrescriptionRequest,
  extractPrescriptionRequest,
  isPrescriptionApproved,
} from '../services/prescriptionService';
import {
  formatRecordDate,
  formatRecordType,
  getMedicalRecords,
  isImageRecord,
  listMedicalRecords,
} from '../services/patientService';
import '../design/pages/rx-upload.css';

const TIPS = [
  {
    title: 'Bright lighting',
    desc: 'Well-lit paper, no harsh shadows.',
    Icon: SunMedium,
  },
  {
    title: 'Perfect alignment',
    desc: 'Keep all four corners in frame.',
    Icon: ScanLine,
  },
  {
    title: 'Sharp focus',
    desc: 'Hold steady so text stays readable.',
    Icon: Aperture,
  },
];

const getRecordFile = (item) => {
  const uri = String(item?.file_url || item?.thumbnail_url || '').trim();
  if (!uri) return null;
  const rawType = String(item?.file_type || '').toLowerCase();
  const fileType = rawType.includes('pdf') || /\.pdf(\?|$)/i.test(uri) ? 'pdf' : rawType || 'image';
  return { uri, fileType };
};

const recordTitle = (item) =>
  String(item?.title || item?.description || item?.file_name || 'Prescription document').trim();

export default function PrescriptionUpload() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const productName = params.get('name') || location.state?.productName || '';
  const variantIds = useMemo(() => {
    const fromQuery = params.get('variant');
    const fromState = Array.isArray(location.state?.variantIds)
      ? location.state.variantIds
      : [];
    return [
      ...new Set(
        [fromQuery, ...fromState]
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    ];
  }, [params, location.state]);

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [reusing, setReusing] = useState(false);
  const [docPreview, setDocPreview] = useState(null);

  useEffect(() => {
    (async () => {
      setDocsLoading(true);
      try {
        if (!(await requireAuth('Please login to upload a prescription'))) return;
        const res = await getMedicalRecords();
        const list = listMedicalRecords(res)
          .filter((item) => getRecordFile(item))
          .filter((item) => {
            const type = String(item?.medical_record_type || '').toLowerCase();
            return !type || type === 'prescription';
          })
          .slice(0, 8);
        setDocuments(list);
      } catch {
        setDocuments([]);
      } finally {
        setDocsLoading(false);
      }
    })();
  }, []);

  const selectedDoc = useMemo(
    () => documents.find((item) => String(item.id) === String(selectedDocId)) || null,
    [documents, selectedDocId],
  );

  useEffect(
    () => () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    },
    [previews],
  );

  const isAllowedFile = (file) => {
    if (!file) return false;
    const type = file.type || '';
    return (
      type.startsWith('image/') ||
      type === 'application/pdf' ||
      (!type && /\.(jpe?g|png|webp|gif|heic|pdf)$/i.test(file.name || ''))
    );
  };

  const addFiles = (list) => {
    const incoming = Array.from(list || []).filter(Boolean);
    const next = incoming.filter(isAllowedFile);
    if (!next.length) {
      if (incoming.length) showSuccessToast('Please choose a PDF or image file', 'error');
      return;
    }
    setSelectedDocId('');
    setFiles((prev) => {
      const merged = [...prev, ...next].slice(0, 4);
      setPreviews((old) => {
        old.forEach((url) => URL.revokeObjectURL(url));
        return merged.map((file) => URL.createObjectURL(file));
      });
      return merged;
    });
  };

  const selectDocument = (item) => {
    const file = getRecordFile(item);
    if (!file) {
      showSuccessToast('No file found for this document', 'error');
      return;
    }
    setFiles([]);
    setPreviews((old) => {
      old.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setSelectedDocId(String(item.id));
  };

  const removeFile = (index) => {
    setPreviews((old) => {
      const url = old[index];
      if (url) URL.revokeObjectURL(url);
      return old.filter((_, itemIndex) => itemIndex !== index);
    });
    setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const proceed = async () => {
    if (!(await requireAuth('Please login to upload prescription'))) return;
    if (files.length) {
      navigate('/medicines/prescription/verify', {
        state: { files, variantIds, productName },
      });
      return;
    }
    if (!selectedDoc) {
      showSuccessToast('Please upload a prescription or choose a previous document', 'error');
      return;
    }
    const pastFile = getRecordFile(selectedDoc);
    if (!pastFile) {
      showSuccessToast('No file found for this document', 'error');
      return;
    }
    setReusing(true);
    try {
      const payload = {
        file_url: pastFile.uri,
        file_urls: [pastFile.uri],
        file_type: pastFile.fileType === 'pdf' ? 'pdf' : 'image',
        variant_ids: variantIds,
        notes: selectedDoc?.description || selectedDoc?.title || undefined,
        save_to_medical_records: false,
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
      showSuccessToast(
        'Submitted — pending pharmacist review (usually 12–24 hours)',
        'success',
      );
      if (isPrescriptionApproved(created)) {
        navigate('/medicines/checkout', {
          state: { request: created, notes: created.notes, approved: true },
        });
      } else {
        navigate('/medicines/order-status', {
          state: { request: created, notes: created.notes },
        });
      }
    } catch (error) {
      showSuccessToast(error?.message || 'Failed to submit prescription', 'error');
    } finally {
      setReusing(false);
    }
  };

  return (
    <AppShell tab="medicines">
      <section className="rxu">
        <div className="rxu-shell">
          <header className="rxu-head">
            <button type="button" className="am-back" onClick={() => navigate(-1)} aria-label="Back">
              <ChevronLeft size={20} aria-hidden />
            </button>
            <div className="rxu-head__copy">
              <p className="rxu-eyebrow">Medicines</p>
              <h1>Prescription</h1>
              <p>{productName || 'Upload documents for review'}</p>
            </div>
          </header>

          {productName ? (
            <aside className="rxu-notice">
              <div className="rxu-notice__mark" aria-hidden>
                <ShieldCheck size={16} strokeWidth={1.85} />
              </div>
              <div>
                <strong>Approval needed</strong>
                <p>Upload your Rx to get “{productName}” approved.</p>
              </div>
            </aside>
          ) : null}

          <div className="rxu-picks">
            <label className="rxu-pick">
              <span className="rxu-pick__icon" aria-hidden>
                <Camera size={20} strokeWidth={1.85} />
              </span>
              <span className="rxu-pick__copy">
                <strong>Camera</strong>
                <small>Take a photo</small>
              </span>
              <span className="rxu-pick__hint">Open</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <label className="rxu-pick">
              <span className="rxu-pick__icon" aria-hidden>
                <Images size={20} strokeWidth={1.85} />
              </span>
              <span className="rxu-pick__copy">
                <strong>Gallery or PDF</strong>
                <small>JPG, PNG or PDF · up to 4</small>
              </span>
              <span className="rxu-pick__hint">Browse</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {files.length > 0 ? (
            <>
              <p className="rxu-meta">
                <span>
                  {files.length} of 4 file{files.length === 1 ? '' : 's'} selected
                </span>
              </p>
              <div className="rxu-files">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="rxu-file">
                    <PrescriptionFilePreview
                      uri={previews[index]}
                      fileType={file.type}
                      label={file.name}
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {selectedDoc ? (
            <p className="rxu-meta">
              <span>Using “{recordTitle(selectedDoc)}”</span>
              <button type="button" className="rxu-meta__clear" onClick={() => setSelectedDocId('')}>
                Clear
              </button>
            </p>
          ) : null}

          <section className="rxu-recent">
            <div className="rxu-recent__head">
              <h2 className="rxu-panel__title">Previously uploaded</h2>
              <p className="rxu-recent__desc">
                Your saved prescription documents. Tap one to reuse.
              </p>
            </div>

            {docsLoading ? (
              <div
                className="rxu-recent__list"
                role="status"
                aria-busy="true"
                aria-label="Loading previous documents"
              >
                {Array.from({ length: 2 }, (_, index) => (
                  <div key={index} className="rxu-row rxu-row--skel" aria-hidden />
                ))}
              </div>
            ) : documents.length > 0 ? (
              <div className="rxu-recent__list">
                {documents.map((item) => {
                  const file = getRecordFile(item);
                  const selected = String(item.id) === String(selectedDocId);
                  const image = isImageRecord(item);
                  const thumb = file?.uri || '';
                  const dateLabel = formatRecordDate(
                    item?.created_at || item?.uploaded_at || item?.updated_at,
                  );
                  const typeLabel = formatRecordType(item?.medical_record_type || 'prescription');
                  return (
                    <article
                      key={item.id}
                      className={`rxu-row${selected ? ' is-selected' : ''}`}
                    >
                      <button
                        type="button"
                        className="rxu-row__select"
                        aria-pressed={selected}
                        onClick={() => selectDocument(item)}
                      >
                        <span className="rxu-row__mark" aria-hidden>
                          {image && thumb ? (
                            <img src={thumb} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <FileText size={18} strokeWidth={1.85} />
                          )}
                        </span>
                        <span className="rxu-row__body">
                          <span className="rxu-row__top">
                            <span className="rxu-row__copy">
                              <strong>{recordTitle(item)}</strong>
                              <small>
                                {String(item.file_type || file?.fileType || 'File').toUpperCase()}
                                {dateLabel ? ` · ${dateLabel}` : ''}
                              </small>
                            </span>
                            <Badge tone="success">{typeLabel}</Badge>
                          </span>
                        </span>
                      </button>
                      <div className="rxu-row__actions">
                        {file?.uri ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setDocPreview(file)}
                          >
                            Preview
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => selectDocument(item)}>
                          Use
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rxu-empty">
                <FileText size={18} aria-hidden />
                <p>No saved prescription documents yet. Take a photo or upload a PDF above.</p>
              </div>
            )}
          </section>

          <section className="rxu-panel">
            <h2 className="rxu-panel__title">Photo tips</h2>
            <ul className="rxu-tips">
              {TIPS.map(({ title, desc, Icon }) => (
                <li key={title} className="rxu-tip">
                  <span className="rxu-tip__icon" aria-hidden>
                    <Icon size={14} strokeWidth={1.85} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <span>{desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="rxu-foot">
            <Button
              variant="primary"
              block
              loading={reusing}
              leadingIcon={<ShieldCheck size={18} aria-hidden />}
              onClick={proceed}
            >
              {selectedDoc && !files.length ? 'Use previous document' : 'Continue'}
            </Button>
          </div>
        </div>
      </section>

      {docPreview ? (
        <PrescriptionPreviewModal
          uri={docPreview.uri}
          fileType={docPreview.fileType}
          onClose={() => setDocPreview(null)}
        />
      ) : null}
    </AppShell>
  );
}
