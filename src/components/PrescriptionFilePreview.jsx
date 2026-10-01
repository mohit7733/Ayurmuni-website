import { useState } from 'react';

export const isPdfFile = (fileType, uri) => {
  const type = String(fileType || '').toLowerCase();
  if (type.includes('pdf')) return true;
  return /\.pdf(\?|$)/i.test(String(uri || ''));
};

export const isImageFile = (fileType, uri) => {
  if (isPdfFile(fileType, uri)) return false;
  const type = String(fileType || '').toLowerCase();
  if (type.includes('image') || type === 'jpg' || type === 'jpeg' || type === 'png') return true;
  if (!uri) return false;
  return /\.(jpe?g|png|gif|webp|heic|bmp)(\?|$)/i.test(uri);
};

export function PrescriptionPreviewModal({ uri, fileType, onClose }) {
  if (!uri) return null;
  const pdf = isPdfFile(fileType, uri);
  const image = !pdf && isImageFile(fileType, uri);
  return (
    <div className="web-modal" role="dialog" onClick={onClose}>
      <div className="web-modal-card record-preview" onClick={(event) => event.stopPropagation()}>
        <h3>{pdf ? 'PDF preview' : image ? 'Image preview' : 'File preview'}</h3>
        {image ? (
          <img src={uri} alt="" />
        ) : (
          <div className="record-preview-pdf">
            <iframe title="Prescription file" className="rx-preview-frame" src={uri} />
            <a href={uri} target="_blank" rel="noopener noreferrer">
              Open file
            </a>
          </div>
        )}
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function PrescriptionFilePreview({ uri, fileType, label }) {
  const [open, setOpen] = useState(false);
  const pdf = isPdfFile(fileType, uri);
  const image = isImageFile(fileType, uri);

  if (!uri) {
    return (
      <div className="media-card">
        <div className="media-thumb">
          <span>No prescription file</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="media-card rx-file-preview" onClick={() => setOpen(true)}>
        <div className="media-thumb">
          {image ? <img src={uri} alt="" /> : <span>{pdf ? 'PDF prescription' : 'Prescription file'}</span>}
        </div>
        <p>{label || 'Preview'}</p>
        <small>Preview</small>
      </button>
      {open ? (
        <PrescriptionPreviewModal uri={uri} fileType={fileType} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
