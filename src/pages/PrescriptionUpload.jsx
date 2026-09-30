import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import {
  formatPrescriptionDate,
  getPrescriptionRequests,
  getStatusLabel,
  isPrescriptionApproved,
  normalizePrescriptionRequestList,
} from '../services/prescriptionService';

const TIPS = [
  { title: 'Bright lighting', desc: 'Well-lit paper, no harsh shadows.' },
  { title: 'Perfect alignment', desc: 'Keep all four corners in frame.' },
  { title: 'Sharp focus', desc: 'Hold steady so text stays readable.' },
];

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
    return [...new Set([fromQuery, ...fromState].map((id) => String(id || '').trim()).filter(Boolean))];
  }, [params, location.state]);

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to upload a prescription'))) return;
      const res = await getPrescriptionRequests();
      setRecent(normalizePrescriptionRequestList(res).slice(0, 8));
    })();
  }, []);

  useEffect(
    () => () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    },
    [previews],
  );

  const addFiles = (list) => {
    const next = Array.from(list || []).filter(
      (file) => file && (file.type?.startsWith('image/') || file.type === 'application/pdf'),
    );
    if (!next.length) return;
    setFiles((prev) => {
      const merged = [...prev, ...next].slice(0, 4);
      setPreviews((old) => {
        old.forEach((url) => URL.revokeObjectURL(url));
        return merged.map((file) =>
          file.type === 'application/pdf' ? '' : URL.createObjectURL(file),
        );
      });
      return merged;
    });
  };

  const proceed = async () => {
    if (!(await requireAuth('Please login to upload prescription'))) return;
    if (!files.length) {
      showSuccessToast('Please upload a prescription photo first', 'error');
      return;
    }
    navigate('/medicines/prescription/verify', {
      state: { files, variantIds, productName },
    });
  };

  return (
    <AppShell tab="medicines">
      <section className="catalog-page rx-upload-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Prescription</h1>
            <p>{productName || 'Documents upload'}</p>
          </div>
        </header>

        <label className="upload-drop">
          <strong>Upload prescription</strong>
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

        {files.length > 0 ? (
          <div className="home-rail">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="media-card">
                <div className="media-thumb">
                  {previews[index] ? <img src={previews[index]} alt="" /> : <span>PDF</span>}
                </div>
                <p>{file.name}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="checkout-card">
          <h3>Photo tips</h3>
          {TIPS.map((item) => (
            <p key={item.title}>
              <strong>{item.title}.</strong> {item.desc}
            </p>
          ))}
        </div>

        {recent.length > 0 ? (
          <section className="home-section">
            <div className="home-section-head">
              <h2>Recent requests</h2>
            </div>
            {recent.map((item) => (
              <button
                key={item.id}
                type="button"
                className="menu-row"
                onClick={() =>
                  isPrescriptionApproved(item)
                    ? navigate('/medicines/checkout', {
                        state: {
                          request: item,
                          notes: item?.notes,
                          approved: true,
                        },
                      })
                    : navigate('/medicines/order-status', {
                        state: { request: item, notes: item?.notes },
                      })
                }
              >
                <span>
                  Request #{item.id}
                  <small>
                    {getStatusLabel(item)}
                    {item.created_at ? ` · ${formatPrescriptionDate(item.created_at)}` : ''}
                  </small>
                </span>
                <em>›</em>
              </button>
            ))}
          </section>
        ) : null}

        <button type="button" className="cta" onClick={proceed}>
          Continue
        </button>
      </section>
    </AppShell>
  );
}
