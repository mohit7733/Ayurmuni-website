import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { showSuccessToast } from '../config/key';
import { getDoctorId, normalizeDoctorList } from '../consult/doctors';
import { doctorDisplayName, resolveImageUrl } from '../home/catalog';
import { apiClient } from '../services/apiClient';
import { getDoctors } from '../services/consultService';
import { requireAuth } from '../services/guestAuth';
import { uploadReviewAsset } from '../utils/reviewUtils';
import '../design/pages/share-experience.css';

const MAX_MEDIA = 5;
const DOCTOR_PAGE_SIZE = 40;

/**
 * Temporary page: rate a doctor without a completed consultation.
 * Open: /rate-doctor
 * Loads doctors from customers/doctors/?page=1&page_size=40
 */
export default function DirectDoctorReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectId = String(searchParams.get('doctorId') || '').trim();

  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState('');
  const [doctorId, setDoctorId] = useState(preselectId);
  const [doctorName, setDoctorName] = useState(searchParams.get('doctorName') || '');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [mediaItems, setMediaItems] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await requireAuth('Please login to rate a doctor'))) return;
      try {
        setDoctorsLoading(true);
        setDoctorsError('');
        const res = await getDoctors({ page: 1, page_size: DOCTOR_PAGE_SIZE });
        if (!alive) return;
        if (!res || res.success === false) {
          setDoctorsError(res?.message || 'Unable to load doctors');
          setDoctors([]);
          return;
        }
        const list = normalizeDoctorList(res, { approvedOnly: true }).filter((d) => getDoctorId(d));
        setDoctors(list);
        if (preselectId) {
          const match = list.find((d) => getDoctorId(d) === preselectId);
          if (match) {
            setDoctorId(getDoctorId(match));
            setDoctorName(doctorDisplayName(match));
          }
        }
      } catch {
        if (alive) {
          setDoctorsError('Unable to load doctors');
          setDoctors([]);
        }
      } finally {
        if (alive) setDoctorsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [preselectId]);

  useEffect(
    () => () => {
      mediaItems.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    [mediaItems],
  );

  const selectDoctor = (doctor) => {
    setDoctorId(getDoctorId(doctor));
    setDoctorName(doctorDisplayName(doctor));
  };

  const pickMedia = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const room = MAX_MEDIA - mediaItems.length;
    if (room <= 0) {
      showSuccessToast(`You can add up to ${MAX_MEDIA} files`, 'error');
      return;
    }
    const next = files.slice(0, room).map((file) => ({
      id: `local-${Date.now()}-${file.name}`,
      file,
      type: String(file.type || '').startsWith('video') ? 'video' : 'image',
      previewUrl: URL.createObjectURL(file),
    }));
    setMediaItems((prev) => [...prev, ...next]);
  };

  const removeMedia = (id) => {
    setMediaItems((prev) => {
      const item = prev.find((row) => row.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((row) => row.id !== id);
    });
  };

  const handleSubmit = async () => {
    if (!rating) {
      showSuccessToast('Please select a rating', 'error');
      return;
    }
    if (!String(doctorId).trim()) {
      showSuccessToast('Please select a doctor', 'error');
      return;
    }

    try {
      setBusy(true);
      const uploadedUrls = await Promise.all(
        mediaItems.map((item) => uploadReviewAsset(item.file)),
      );

      const payload = {
        rating,
        review: review.trim(),
        doctor_id: String(doctorId).trim(),
      };
      if (uploadedUrls.length) payload.image_urls = uploadedUrls.filter(Boolean);

      const response = await apiClient('review/?entity_type=doctor', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response?.success) {
        showSuccessToast(response.message || 'Thank you for your review!', 'success');
        navigate('/home', { replace: true });
        return;
      }
      showSuccessToast(response?.message || 'Unable to submit review', 'error');
    } catch (error) {
      showSuccessToast(error?.message || 'Something went wrong while submitting', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell tab="profile">
      <section className="catalog-page review-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Rate a Doctor</h1>
            <p>Temporary page — no consultation required</p>
          </div>
        </header>

        <div className="review-hero">
          <small>Direct Review</small>
          <strong>{doctorName.trim() || 'Select a doctor'}</strong>
          <p>Pick a doctor from the list, then share your rating.</p>
        </div>

        <div className="checkout-card review-section">
          <h3>Select doctor</h3>
          {doctorsLoading ? <p className="muted">Loading doctors…</p> : null}
          {!doctorsLoading && doctorsError ? <p className="muted">{doctorsError}</p> : null}
          {!doctorsLoading && !doctorsError && !doctors.length ? (
            <p className="muted">No doctors found</p>
          ) : null}
          {!doctorsLoading && doctors.length ? (
            <ul className="review-doctor-list" role="listbox" aria-label="Doctors">
              {doctors.map((doctor) => {
                const id = getDoctorId(doctor);
                const name = doctorDisplayName(doctor);
                const specialty =
                  doctor?.specialization ||
                  doctor?.speciality ||
                  doctor?.specialty ||
                  doctor?.category_name ||
                  '';
                const photo = resolveImageUrl(doctor);
                const selected = id === String(doctorId);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`review-doctor-option${selected ? ' is-selected' : ''}`}
                      onClick={() => selectDoctor(doctor)}
                    >
                      <span className="review-doctor-option__avatar" aria-hidden>
                        {photo ? <img src={photo} alt="" /> : name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="review-doctor-option__meta">
                        <strong>{name}</strong>
                        {specialty ? <small>{specialty}</small> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div className="checkout-card review-section review-section--rating">
          <h3>Your rating</h3>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={star <= rating ? 'on' : ''}
                onClick={() => setRating(star)}
                aria-label={`${star} star`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="muted">{rating ? `You rated ${rating} out of 5` : 'Tap a star to rate'}</p>
        </div>

        <div className="checkout-card review-section review-section--text">
          <h3>Tell us more</h3>
          <textarea
            className="review-text"
            value={review}
            maxLength={800}
            placeholder="How was your experience with this doctor?"
            onChange={(event) => setReview(event.target.value)}
          />
          <small className="muted">{review.length}/800</small>
        </div>

        <div className="checkout-card review-section review-section--media">
          <div className="review-media-head">
            <h3>Photos & videos</h3>
            <small>Optional • up to {MAX_MEDIA}</small>
          </div>
          <div className="review-media-grid">
            {mediaItems.map((item) => (
              <div key={item.id} className="review-media-tile">
                {item.type === 'video' ? <span>Video</span> : <img src={item.previewUrl} alt="" />}
                <button type="button" onClick={() => removeMedia(item.id)} aria-label="Remove">
                  ×
                </button>
              </div>
            ))}
            {mediaItems.length < MAX_MEDIA ? (
              <label className="review-add-tile">
                <input type="file" accept="image/*,video/*" hidden multiple onChange={pickMedia} />
                + Add
              </label>
            ) : null}
          </div>
        </div>

        <button type="button" className="cta review-submit" disabled={busy || !doctorId} onClick={handleSubmit}>
          {busy ? 'Submitting…' : 'Submit Review'}
        </button>
      </section>
    </AppShell>
  );
}
