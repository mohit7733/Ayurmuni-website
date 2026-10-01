import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import { UploadProfilePhoto } from '../services/profileService';
import { extractUploadUrl } from '../services/prescriptionService';
import {
  addMedicalRecord,
  deleteMedicalRecord,
  formatRecordDate,
  formatRecordType,
  getMedicalRecords,
  isImageRecord,
  listMedicalRecords,
} from '../services/patientService';

const TABS = [
  { key: 'All Records', type: null, label: 'All' },
  { key: 'Prescriptions', type: 'prescription', label: 'Prescriptions' },
  { key: 'Lab Reports', type: 'lab_report', label: 'Lab Reports' },
];

const RECORD_TYPES = [
  { label: 'Prescription', value: 'prescription' },
  { label: 'Lab Report', value: 'lab_report' },
];

export default function MedicalRecords() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeTab, setActiveTab] = useState('All Records');
  const [pickedFile, setPickedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [recordType, setRecordType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    setLoading(true);
    const res = await getMedicalRecords();
    setRecords(listMedicalRecords(res));
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view medical records'))) return;
      load();
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const counts = useMemo(() => {
    const list = records || [];
    return {
      all: list.length,
      prescription: list.filter((item) => item?.medical_record_type === 'prescription').length,
      lab_report: list.filter((item) => item?.medical_record_type === 'lab_report').length,
    };
  }, [records]);

  const filtered = useMemo(() => {
    const tab = TABS.find((item) => item.key === activeTab);
    let list = records || [];
    if (tab?.type) {
      list = list.filter((item) => item?.medical_record_type === tab.type);
    }
    if (!debounced) return list;
    const q = debounced.toLowerCase();
    return list.filter((item) =>
      [item?.title, item?.description, item?.medical_record_type, item?.file_name].some((field) =>
        String(field || '')
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [records, activeTab, debounced]);

  const pickFile = (list) => {
    const file = Array.from(list || []).find(
      (item) => item && (item.type?.startsWith('image/') || item.type === 'application/pdf'),
    );
    if (!file) {
      showSuccessToast('Please choose a PDF or image file', 'error');
      return;
    }
    setPickedFile(file);
    setDescription(file.name || '');
    setRecordType('');
  };

  const closeUpload = () => {
    if (uploading) return;
    setPickedFile(null);
    setDescription('');
    setRecordType('');
  };

  const submitRecord = async () => {
    if (!pickedFile || !description.trim() || !recordType) return;
    if (!(await requireAuth('Please login to upload medical records'))) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', pickedFile);
      body.append('dir', 'customer_avatar');
      const uploadResponse = await UploadProfilePhoto(body);
      const fileUrl = extractUploadUrl(uploadResponse);
      if (uploadResponse?.success === false || !fileUrl) {
        showSuccessToast(uploadResponse?.message || 'Unable to upload file', 'error');
        return;
      }
      const res = await addMedicalRecord({
        medical_record_type: recordType,
        file_type: pickedFile.type?.includes('pdf') ? 'pdf' : 'image',
        description: description.trim(),
        file_url: fileUrl,
      });
      if (res?.success === false) {
        showSuccessToast(res?.message || 'Unable to save record', 'error');
        return;
      }
      showSuccessToast('Record uploaded', 'success');
      setPickedFile(null);
      setDescription('');
      setRecordType('');
      await load();
    } catch {
      showSuccessToast('Unable to upload record', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget?.id) return;
    const res = await deleteMedicalRecord(deleteTarget.id);
    if (res?.success === false) {
      showSuccessToast(res?.message || 'Unable to delete record', 'error');
      return;
    }
    showSuccessToast('Record deleted', 'success');
    setDeleteTarget(null);
    load();
  };

  const openPreview = (item) => {
    if (!item?.file_url) return;
    setPreview(item);
  };

  return (
    <AppShell tab="profile">
      <section className="catalog-page records-page">
        <header className="catalog-head">
          <div>
            <button type="button" className="text-back" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <h1>Medical Records</h1>
            <p>Your health documents in one place</p>
          </div>
        </header>

        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setDebounced(search.trim());
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or type…"
          />
          <button type="submit" className="cta">
            Search
          </button>
        </form>

        <div className="diet-chips">
          {TABS.map((tab) => {
            const count = tab.type == null ? counts.all : counts[tab.type];
            return (
              <button
                key={tab.key}
                type="button"
                className={`chip ${activeTab === tab.key ? 'on' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label} · {count}
              </button>
            );
          })}
        </div>

        <label className="upload-drop record-upload">
          <strong>{uploading ? 'Uploading…' : 'Upload medical record'}</strong>
          <small>Prescription, lab report · PDF or image</small>
          <input
            type="file"
            accept="image/*,application/pdf"
            hidden
            disabled={uploading}
            onChange={(e) => {
              pickFile(e.target.files);
              e.target.value = '';
            }}
          />
        </label>

        <div className="home-section-head">
          <h2>Your documents</h2>
          <span className="muted">
            {filtered.length} {filtered.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {loading && records.length === 0 ? (
          <p className="muted">Loading records…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-copy">
            <strong>No records yet</strong>
            <p>Upload a prescription or lab report to keep it handy.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const title = item?.title || item?.description || item?.file_name || 'Medical record';
            const typeLabel = formatRecordType(item?.medical_record_type);
            const dateLabel = formatRecordDate(item?.created_at || item?.uploaded_at || item?.updated_at);
            const thumb = item?.file_url || item?.thumbnail_url || '';
            const image = isImageRecord(item);
            return (
              <div key={item.id} className="record-row">
                <button type="button" className="record-main" onClick={() => openPreview(item)}>
                  {image && thumb ? (
                    <img src={thumb} alt="" />
                  ) : (
                    <span className="record-file">{String(item.file_type || 'FILE').toUpperCase()}</span>
                  )}
                  <div>
                    <strong>{title}</strong>
                    <small>
                      {typeLabel}
                      {item.file_type ? ` · ${String(item.file_type).toUpperCase()}` : ''}
                      {dateLabel ? ` · ${dateLabel}` : ''}
                    </small>
                  </div>
                </button>
                <button type="button" className="ghost" onClick={() => openPreview(item)}>
                  View
                </button>
                <button type="button" className="ghost" onClick={() => setDeleteTarget(item)}>
                  Delete
                </button>
              </div>
            );
          })
        )}
      </section>

      {pickedFile ? (
        <div className="web-modal" role="dialog">
          <div className="web-modal-card">
            <h3>Upload medical record</h3>
            <p className="muted">{pickedFile.name}</p>
            <label className="form-field">
              Record name *
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="form-field">
              Record type *
              <div className="variant-row">
                {RECORD_TYPES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`chip ${recordType === item.value ? 'on' : ''}`}
                    onClick={() => setRecordType(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="detail-cta">
              <button type="button" className="ghost" onClick={closeUpload} disabled={uploading}>
                Cancel
              </button>
              <button
                type="button"
                className="cta"
                disabled={uploading || !description.trim() || !recordType}
                onClick={submitRecord}
              >
                {uploading ? 'Uploading…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="web-modal" role="dialog" onClick={() => setPreview(null)}>
          <div className="web-modal-card record-preview" onClick={(e) => e.stopPropagation()}>
            <h3>{preview.title || preview.description || 'Record'}</h3>
            {isImageRecord(preview) ? (
              <img src={preview.file_url} alt="" />
            ) : (
              <div className="record-preview-pdf">
                <strong>PDF document</strong>
                <a href={preview.file_url} target="_blank" rel="noopener noreferrer">
                  Open PDF
                </a>
              </div>
            )}
            <button type="button" className="ghost" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="web-modal" role="dialog">
          <div className="web-modal-card">
            <h3>Delete record</h3>
            <p>Are you sure you want to delete this record?</p>
            <div className="detail-cta">
              <button type="button" className="ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="cta" onClick={onDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
