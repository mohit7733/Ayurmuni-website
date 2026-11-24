import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Aperture,
  Camera,
  ChevronLeft,
  ChevronRight,
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
  isImageFile,
  isPdfFile,
} from '../components/PrescriptionFilePreview';
import {
  createPrescriptionRequest,
  extractPrescriptionRequest,
  formatPrescriptionDate,
  getPrescriptionFiles,
  getPrescriptionRequests,
  getStatusLabel,
  isPrescriptionApproved,
  isPrescriptionRejected,
  normalizePrescriptionRequestList,
} from '../services/prescriptionService';
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

const requestTone = (item) => {
  if (isPrescriptionApproved(item)) return 'success';
  if (isPrescriptionRejected(item)) return 'danger';
  return 'warning';
};

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
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [selectedPastId, setSelectedPastId] = useState('');
  const [reusing, setReusing] = useState(false);
  const [recentPreview, setRecentPreview] = useState(null);

  useEffect(() => {
    (async () => {
      setRecentLoading(true);
      try {
        if (!(await requireAuth('Please login to upload a prescription'))) return;
        const res = await getPrescriptionRequests();
        setRecent(normalizePrescriptionRequestList(res).slice(0, 8));
      } catch {
        setRecent([]);
      } finally {
        setRecentLoading(false);
      }
    })();
  }, []);

  const selectedPast = useMemo(
    () => recent.find((item) => String(item.id) === String(selectedPastId)) || null,
    [recent, selectedPastId],
  );

  const previousUploads = useMemo(
    () =>
      recent
        .map((item) => {
          const itemFiles = getPrescriptionFiles(item);
          if (!itemFiles.length) return null;
          return { item, files: itemFiles };
        })
        .filter(Boolean),
    [recent],
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
    setSelectedPastId('');
    setFiles((prev) => {
      const merged = [...prev, ...next].slice(0, 4);
      setPreviews((old) => {
        old.forEach((url) => URL.revokeObjectURL(url));
        return merged.map((file) => URL.createObjectURL(file));
      });
      return merged;
    });
  };

  const selectPrevious = (item) => {
    const itemFiles = getPrescriptionFiles(item);
    if (!itemFiles.length) {
      showSuccessToast('No uploaded file found for this request', 'error');
      return;
    }
    setFiles([]);
    setPreviews((old) => {
      old.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setSelectedPastId(String(item.id));
  };

  const removeFile = (index) => {
    setPreviews((old) => {
      const url = old[index];
      if (url) URL.revokeObjectURL(url);
      return old.filter((_, itemIndex) => itemIndex !== index);
    });
    setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const openRequest = (item) => {
    if (isPrescriptionApproved(item)) {
      navigate('/medicines/checkout', {
        state: {
          request: item,
          notes: item?.notes,
          approved: true,
        },
      });
      return;
    }
    navigate('/medicines/order-status', {
      state: { request: item, notes: item?.notes },
    });
  };

  const proceed = async () => {
    if (!(await requireAuth('Please login to upload prescription'))) return;
    if (files.length) {
      navigate('/medicines/prescription/verify', {
        state: { files, variantIds, productName },
      });
      return;
    }
    if (!selectedPast) {
      showSuccessToast('Please upload a prescription or choose a previous one', 'error');
      return;
    }
    const pastFiles = getPrescriptionFiles(selectedPast);
    if (!pastFiles.length) {
      showSuccessToast('No uploaded file found for this request', 'error');
      return;
    }
    setReusing(true);
    try {
      const fileUrls = pastFiles.map((file) => file.uri);
      const payload = {
        file_url: fileUrls[0],
        file_urls: fileUrls,
        file_type: pastFiles.some((file) => file.fileType === 'pdf') ? 'pdf' : 'image',
        variant_ids: variantIds,
        notes: selectedPast?.notes || undefined,
        save_to_medical_records: true,
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
              <ShieldCheck size={22} strokeWidth={1.85} />
            </div>
            <div>
              <strong>Approval needed for this product</strong>
              <p>
                Upload your Rx to get “{productName}” approved.
              </p>
            </div>
          </aside>
        ) : null}

        <div className="rxu-picks">
          <label className="rxu-pick">
            <span className="rxu-pick__icon" aria-hidden>
              <Camera size={22} strokeWidth={1.85} />
            </span>
            <strong>Camera</strong>
            <small>Take a photo</small>
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
              <Images size={22} strokeWidth={1.85} />
            </span>
            <strong>Gallery or PDF</strong>
            <small>JPG, PNG or PDF · up to 4 files</small>
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

        {selectedPast ? (
          <p className="rxu-meta">
            <span>
              Using previous upload · Request #{selectedPast.id}
            </span>
            <button type="button" className="rxu-meta__clear" onClick={() => setSelectedPastId('')}>
              Clear
            </button>
          </p>
        ) : null}

        <section className="rxu-recent">
          <div className="rxu-recent__head">
            <h2 className="rxu-panel__title">Previously uploaded</h2>
            <p className="rxu-recent__desc">
              Choose an earlier Rx for this product, or upload a new one above.
            </p>
          </div>

          {recentLoading ? (
            <div className="rxu-recent__list" role="status" aria-busy="true" aria-label="Loading previous uploads">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="rxu-row rxu-row--skel" aria-hidden />
              ))}
            </div>
          ) : recent.length > 0 ? (
            <>
              {previousUploads.length > 0 ? (
                <div className="rxu-past">
                  {previousUploads.map(({ item, files: itemFiles }) => {
                    const selected = String(item.id) === String(selectedPastId);
                    const primary = itemFiles[0];
                    const image = primary && isImageFile(primary.fileType, primary.uri);
                    const pdf = primary && isPdfFile(primary.fileType, primary.uri);
                    return (
                      <button
                        key={`past-${item.id}`}
                        type="button"
                        className={`rxu-past__card${selected ? ' is-selected' : ''}`}
                        onClick={() => selectPrevious(item)}
                        aria-pressed={selected}
                      >
                        <span className="rxu-past__thumb" aria-hidden>
                          {image ? (
                            <img src={primary.uri} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <FileText size={22} strokeWidth={1.85} />
                          )}
                          {itemFiles.length > 1 ? (
                            <em className="rxu-past__count">+{itemFiles.length - 1}</em>
                          ) : null}
                        </span>
                        <span className="rxu-past__copy">
                          <strong>Request #{item.id}</strong>
                          <small>
                            {pdf ? 'PDF' : image ? 'Image' : 'File'}
                            {item.created_at ? ` · ${formatPrescriptionDate(item.created_at)}` : ''}
                          </small>
                          <Badge tone={requestTone(item)}>{getStatusLabel(item)}</Badge>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="rxu-recent__list">
                {recent.map((item) => {
                  const itemFiles = getPrescriptionFiles(item);
                  const file = itemFiles[0];
                  const selected = String(item.id) === String(selectedPastId);
                  const image = file && isImageFile(file.fileType, file.uri);
                  return (
                    <div
                      key={item.id}
                      className={`rxu-row${selected ? ' is-selected' : ''}`}
                    >
                      <button
                        type="button"
                        className="rxu-row__main"
                        onClick={() => (itemFiles.length ? selectPrevious(item) : openRequest(item))}
                      >
                        <span className="rxu-row__mark rxu-row__mark--media" aria-hidden>
                          {image ? (
                            <img src={file.uri} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <FileText size={18} strokeWidth={1.85} />
                          )}
                        </span>
                        <span className="rxu-row__copy">
                          <strong>Request #{item.id}</strong>
                          <small>
                            {itemFiles.length
                              ? `${itemFiles.length} file${itemFiles.length === 1 ? '' : 's'}`
                              : 'No file'}
                            {item.created_at ? ` · ${formatPrescriptionDate(item.created_at)}` : ''}
                          </small>
                          <Badge tone={requestTone(item)}>{getStatusLabel(item)}</Badge>
                        </span>
                        <ChevronRight className="rxu-row__chev" size={18} aria-hidden />
                      </button>
                      <div className="rxu-row__actions">
                        {file?.uri ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRecentPreview(file)}
                          >
                            Preview
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openRequest(item)}
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rxu-empty">
              <FileText size={22} aria-hidden />
              <p>No previous uploads yet. Add a photo or PDF above to get started.</p>
            </div>
          )}
        </section>

        <section className="rxu-panel">
          <h2 className="rxu-panel__title">Photo tips</h2>
          <ul className="rxu-tips">
            {TIPS.map(({ title, desc, Icon }) => (
              <li key={title} className="rxu-tip">
                <span className="rxu-tip__icon" aria-hidden>
                  <Icon size={18} strokeWidth={1.85} />
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
            {selectedPast && !files.length ? 'Use previous upload' : 'Continue'}
          </Button>
        </div>
      </section>

      {recentPreview ? (
        <PrescriptionPreviewModal
          uri={recentPreview.uri}
          fileType={recentPreview.fileType}
          onClose={() => setRecentPreview(null)}
        />
      ) : null}
    </AppShell>
  );
}
