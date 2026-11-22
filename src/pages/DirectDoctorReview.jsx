import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { showSuccessToast } from '../config/key';
import { getDoctorId, normalizeDoctorList } from '../consult/doctors';
import {
  doctorDisplayName,
  mapCatalogProductItem,
  normalizeApiList,
  resolveImageUrl,
} from '../home/catalog';
import { getDoctors } from '../services/consultService';
import { isAuthenticated } from '../services/guestAuth';
import { getProducts } from '../services/productService';
import { createManagementReview } from '../services/reviewService';
import { uploadReviewAsset } from '../utils/reviewUtils';
import '../design/pages/management-review.css';

const MAX_MEDIA = 5;
const LIST_PAGE_SIZE = 40;
const MAX_REVIEW = 800;
const SEARCH_DEBOUNCE_MS = 320;

const ENTITY = {
  doctor: 'doctor',
  product: 'product',
};

const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

const formatApiError = (response) => {
  const errors = response?.data?.errors || response?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return response?.message || 'Unable to submit review';
};

const normalizeLabel = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^dr\.?\s+/i, '')
    .replace(/\s+/g, ' ');

const readEntityType = (params) => {
  const raw = String(params.get('type') || params.get('entity') || '').toLowerCase();
  if (raw === 'product' || raw === 'medicine' || raw === 'medicines') return ENTITY.product;
  return ENTITY.doctor;
};

const productDisplayName = (item) =>
  String(item?.name || item?.product_name || item?.title || item?.variant_title || '').trim();

const productSubtitle = (item) =>
  String(
    item?.variant_title ||
      item?.brand_name ||
      item?.category_name ||
      (item?.prescription_required ? 'Prescription medicine' : '') ||
      '',
  ).trim();

/**
 * Public management review page for doctors and products/medicines.
 * Open: /rate-doctor?type=doctor|product
 */
export default function DirectDoctorReview() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEntity = readEntityType(searchParams);

  const [entityType, setEntityType] = useState(initialEntity);
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [doctorId, setDoctorId] = useState(String(searchParams.get('doctorId') || '').trim());
  const [doctorName, setDoctorName] = useState(String(searchParams.get('doctorName') || '').trim());
  const [variantId, setVariantId] = useState(String(searchParams.get('variantId') || '').trim());
  const [productId, setProductId] = useState(String(searchParams.get('productId') || '').trim());
  const [productName, setProductName] = useState(
    String(searchParams.get('productName') || '').trim(),
  );
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedMeta, setSelectedMeta] = useState('');

  const [reviewerName, setReviewerName] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [mediaItems, setMediaItems] = useState([]);
  const [canUploadMedia, setCanUploadMedia] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let alive = true;
    isAuthenticated().then((authed) => {
      if (alive) setCanUploadMedia(authed);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      mediaItems.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    [mediaItems],
  );

  useEffect(() => {
    if (entityType !== ENTITY.doctor) return undefined;
    let alive = true;
    (async () => {
      try {
        setListLoading(true);
        setListError('');
        const res = await getDoctors({ page: 1, page_size: LIST_PAGE_SIZE });
        if (!alive) return;
        if (!res || res.success === false) {
          setListError(res?.message || 'Unable to load doctors');
          setItems([]);
          return;
        }
        const list = normalizeDoctorList(res, { approvedOnly: true }).filter((d) => getDoctorId(d));
        setItems(list);
        const preId = String(searchParams.get('doctorId') || '').trim();
        if (preId) {
          const match = list.find((d) => getDoctorId(d) === preId);
          if (match) {
            setDoctorId(getDoctorId(match));
            setDoctorName(doctorDisplayName(match));
            setSelectedImage(resolveImageUrl(match) || '');
            setSelectedMeta(
              String(
                match?.specialization ||
                  match?.speciality ||
                  match?.specialty ||
                  match?.category_name ||
                  '',
              ).trim(),
            );
          }
        }
      } catch {
        if (alive) {
          setListError('Unable to load doctors');
          setItems([]);
        }
      } finally {
        if (alive) setListLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [entityType, searchParams]);

  useEffect(() => {
    if (entityType !== ENTITY.product) return undefined;
    let alive = true;
    (async () => {
      try {
        setListLoading(true);
        setListError('');
        const res = await getProducts({
          page: 1,
          page_size: LIST_PAGE_SIZE,
          ...(debouncedQuery ? { search: debouncedQuery } : {}),
        });
        if (!alive) return;
        if (!res || res.success === false) {
          setListError(res?.message || 'Unable to load products');
          setItems([]);
          return;
        }
        const list = normalizeApiList(res)
          .map(mapCatalogProductItem)
          .filter((item) => item && (item.variant_id || item.id || item.product_id));
        setItems(list);
        const preVariant = String(searchParams.get('variantId') || '').trim();
        const preProduct = String(searchParams.get('productId') || '').trim();
        if (!debouncedQuery && (preVariant || preProduct)) {
          const match = list.find(
            (item) =>
              String(item.variant_id) === preVariant ||
              String(item.id) === preProduct ||
              String(item.product_id) === preProduct,
          );
          if (match) {
            setVariantId(String(match.variant_id || '').trim());
            setProductId(String(match.id || match.product_id || '').trim());
            setProductName(productDisplayName(match));
            setSelectedImage(match.image_url || resolveImageUrl(match) || '');
            setSelectedMeta(productSubtitle(match));
          }
        }
      } catch {
        if (alive) {
          setListError('Unable to load products');
          setItems([]);
        }
      } finally {
        if (alive) setListLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [entityType, debouncedQuery, searchParams]);

  const filteredItems = useMemo(() => {
    if (entityType === ENTITY.product) return items;
    const q = debouncedQuery.toLowerCase();
    if (!q) return items;
    return items.filter((doctor) => {
      const name = doctorDisplayName(doctor).toLowerCase();
      const specialty = String(
        doctor?.specialization || doctor?.speciality || doctor?.specialty || doctor?.category_name || '',
      ).toLowerCase();
      return name.includes(q) || specialty.includes(q);
    });
  }, [items, debouncedQuery, entityType]);

  const activeRating = hoverRating || rating;
  const isDoctor = entityType === ENTITY.doctor;
  const selectedLabel = isDoctor
    ? doctorName.trim() || 'Choose a doctor'
    : productName.trim() || 'Choose a product';
  const hasMatchedId = isDoctor
    ? Boolean(String(doctorId).trim())
    : Boolean(String(variantId).trim() || String(productId).trim());
  const hasTarget = isDoctor
    ? Boolean(String(doctorId).trim() || String(doctorName).trim())
    : Boolean(String(variantId).trim() || String(productId).trim() || String(productName).trim());
  const canSubmit = hasTarget && rating > 0 && !busy;

  const clearSelection = () => {
    setDoctorId('');
    setDoctorName('');
    setVariantId('');
    setProductId('');
    setProductName('');
    setSelectedImage('');
    setSelectedMeta('');
  };

  const switchEntity = (next) => {
    if (next === entityType) return;
    setEntityType(next);
    setQuery('');
    setDebouncedQuery('');
    setItems([]);
    setListError('');
    setRating(0);
    setHoverRating(0);
    setReview('');
    setMediaItems((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
    clearSelection();
    setSubmitted(false);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('type', next);
    ['doctorId', 'doctorName', 'variantId', 'productId', 'productName'].forEach((key) =>
      nextParams.delete(key),
    );
    setSearchParams(nextParams, { replace: true });
  };

  const selectDoctor = (doctor) => {
    setDoctorId(getDoctorId(doctor));
    setDoctorName(doctorDisplayName(doctor));
    setSelectedImage(resolveImageUrl(doctor) || '');
    setSelectedMeta(
      String(
        doctor?.specialization ||
          doctor?.speciality ||
          doctor?.specialty ||
          doctor?.category_name ||
          '',
      ).trim(),
    );
  };

  const selectProduct = (product) => {
    setVariantId(String(product?.variant_id || '').trim());
    setProductId(String(product?.id || product?.product_id || '').trim());
    setProductName(productDisplayName(product));
    setSelectedImage(product.image_url || resolveImageUrl(product) || '');
    setSelectedMeta(productSubtitle(product));
  };

  const resolveDoctorFromName = (name, { partial = false } = {}) => {
    const needle = normalizeLabel(name);
    if (!needle) return null;
    const exact = items.find((doctor) => normalizeLabel(doctorDisplayName(doctor)) === needle);
    if (exact || !partial) return exact || null;
    return items.find((doctor) => normalizeLabel(doctorDisplayName(doctor)).includes(needle)) || null;
  };

  const resolveProductFromName = (name, { partial = false } = {}) => {
    const needle = normalizeLabel(name);
    if (!needle) return null;
    const exact = items.find((product) => normalizeLabel(productDisplayName(product)) === needle);
    if (exact || !partial) return exact || null;
    return (
      items.find((product) => normalizeLabel(productDisplayName(product)).includes(needle)) || null
    );
  };

  const onDoctorNameChange = (value) => {
    setDoctorName(value);
    const match = resolveDoctorFromName(value);
    if (match) {
      setDoctorId(getDoctorId(match));
      setSelectedImage(resolveImageUrl(match) || '');
      setSelectedMeta(
        String(
          match?.specialization ||
            match?.speciality ||
            match?.specialty ||
            match?.category_name ||
            '',
        ).trim(),
      );
    } else {
      setDoctorId('');
      setSelectedImage('');
      setSelectedMeta('');
    }
  };

  const onProductNameChange = (value) => {
    setProductName(value);
    const match = resolveProductFromName(value);
    if (match) {
      setVariantId(String(match.variant_id || '').trim());
      setProductId(String(match.id || match.product_id || '').trim());
      setSelectedImage(match.image_url || resolveImageUrl(match) || '');
      setSelectedMeta(productSubtitle(match));
    } else {
      setVariantId('');
      setProductId('');
      setSelectedImage('');
      setSelectedMeta('');
    }
  };

  const pickMedia = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (!canUploadMedia) {
      showSuccessToast('Sign in to attach photos or videos', 'error');
      return;
    }
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

  const resetForm = () => {
    setRating(0);
    setHoverRating(0);
    setReview('');
    setReviewerName('');
    setMediaItems((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
    clearSelection();
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!rating) {
      showSuccessToast('Please select a rating', 'error');
      return;
    }
    if (!hasTarget) {
      showSuccessToast(
        isDoctor ? 'Please select or enter a doctor name' : 'Please select or enter a product name',
        'error',
      );
      return;
    }

    try {
      setBusy(true);
      let imageUrls = [];
      if (mediaItems.length) {
        if (!canUploadMedia) {
          showSuccessToast('Sign in to attach media, or remove photos and submit', 'error');
          return;
        }
        imageUrls = await Promise.all(mediaItems.map((item) => uploadReviewAsset(item.file)));
      }

      let reviewData = {
        rating,
        review: review.trim(),
        reviewer_name: reviewerName.trim(),
        image_urls: imageUrls.filter(Boolean),
      };

      if (isDoctor) {
        const trimmedName = String(doctorName).trim();
        const matched = String(doctorId).trim()
          ? null
          : resolveDoctorFromName(trimmedName, { partial: true });
        reviewData = {
          ...reviewData,
          doctor_id: String(doctorId).trim() || (matched ? getDoctorId(matched) : '') || undefined,
          doctor_name: (matched ? doctorDisplayName(matched) : trimmedName) || undefined,
        };
      } else {
        const trimmedName = String(productName).trim();
        const matched =
          String(variantId).trim() || String(productId).trim()
            ? null
            : resolveProductFromName(trimmedName, { partial: true });
        reviewData = {
          ...reviewData,
          variant_id:
            String(variantId).trim() ||
            (matched ? String(matched.variant_id || '').trim() : '') ||
            undefined,
          product_id:
            String(productId).trim() ||
            (matched ? String(matched.id || matched.product_id || '').trim() : '') ||
            undefined,
          product_name: (matched ? productDisplayName(matched) : trimmedName) || undefined,
        };
      }

      const response = await createManagementReview({
        entityType,
        reviewData,
      });

      if (response?.success) {
        showSuccessToast(response.message || 'Thank you for your review!', 'success');
        setSubmitted(true);
        return;
      }
      showSuccessToast(formatApiError(response), 'error');
    } catch (error) {
      showSuccessToast(error?.message || 'Something went wrong while submitting', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <AppShell tab="profile">
        <section className="mgr">
          <div className="mgr-success">
            <span className="mgr-success__badge" aria-hidden>
              ★
            </span>
            <h1>Review received</h1>
            <p>
              Thank you — your {isDoctor ? 'doctor' : 'product'} feedback helps others choose with
              confidence.
            </p>
            <div className="mgr-success__actions">
              <button type="button" className="mgr-submit" onClick={resetForm}>
                Write another review
              </button>
              <button
                type="button"
                className="mgr-ghost"
                onClick={() => navigate('/home', { replace: true })}
              >
                Back to home
              </button>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell tab="profile">
      <section className="mgr">
        <div className="mgr-top">
          <div className="mgr-top__copy">
            <button type="button" className="mgr-back" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <p className="mgr-kicker">Ayurmuni feedback</p>
            <h1 className="mgr-title">Share a Review</h1>
            <p className="mgr-lede">
              Rate a doctor or product in under a minute — no login or order required.
            </p>
          </div>

          <div className="mgr-tabs" role="tablist" aria-label="Review type">
            <button
              type="button"
              role="tab"
              aria-selected={isDoctor}
              className={`mgr-tab${isDoctor ? ' is-active' : ''}`}
              onClick={() => switchEntity(ENTITY.doctor)}
            >
              Doctor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isDoctor}
              className={`mgr-tab${!isDoctor ? ' is-active' : ''}`}
              onClick={() => switchEntity(ENTITY.product)}
            >
              Product / Medicine
            </button>
          </div>
        </div>

        <div className="mgr-layout">
          <div className="mgr-panel">
            <div className="mgr-panel__head">
              <div>
                <h2>{isDoctor ? 'Find your doctor' : 'Find your product'}</h2>
                <p>
                  {isDoctor
                    ? 'Search by name or specialty, then pick from the list.'
                    : 'Search medicines and wellness products, then pick a variant.'}
                </p>
              </div>
              {!listLoading && filteredItems.length ? (
                <span className="mgr-count">{filteredItems.length} shown</span>
              ) : null}
            </div>

            <div className="mgr-search">
              <span className="mgr-search__icon" aria-hidden>
                ⌕
              </span>
              <input
                type="search"
                value={query}
                placeholder={
                  isDoctor ? 'Search doctors by name or specialty' : 'Search products or medicines'
                }
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
              />
            </div>

            {hasTarget ? (
              <div className="mgr-selected">
                <span className={`mgr-selected__media${isDoctor ? ' is-round' : ''}`} aria-hidden>
                  {selectedImage ? (
                    <img src={selectedImage} alt="" />
                  ) : (
                    selectedLabel.slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="mgr-selected__copy">
                  <small>{hasMatchedId ? 'Selected' : 'Named'}</small>
                  <strong>{selectedLabel}</strong>
                  {selectedMeta ? <span>{selectedMeta}</span> : null}
                </div>
                <button
                  type="button"
                  className="mgr-selected__clear"
                  aria-label="Clear selection"
                  onClick={clearSelection}
                >
                  ×
                </button>
              </div>
            ) : null}

            {listLoading ? (
              <p className="mgr-hint">Loading {isDoctor ? 'doctors' : 'products'}…</p>
            ) : null}
            {!listLoading && listError ? (
              <p className="mgr-hint">{listError}. You can still type a name below.</p>
            ) : null}
            {!listLoading && !listError && !items.length ? (
              <p className="mgr-empty">
                No {isDoctor ? 'doctors' : 'products'} found. Type a name below to continue.
              </p>
            ) : null}
            {!listLoading && items.length && !filteredItems.length ? (
              <p className="mgr-empty">No results match “{debouncedQuery}”.</p>
            ) : null}

            {!listLoading && filteredItems.length ? (
              <ul
                className="mgr-list"
                role="listbox"
                aria-label={isDoctor ? 'Doctors' : 'Products'}
              >
                {isDoctor
                  ? filteredItems.map((doctor) => {
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
                            className={`mgr-option${selected ? ' is-selected' : ''}`}
                            onClick={() => selectDoctor(doctor)}
                          >
                            <span className="mgr-option__media is-round" aria-hidden>
                              {photo ? <img src={photo} alt="" /> : name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="mgr-option__copy">
                              <strong>{name}</strong>
                              {specialty ? <small>{specialty}</small> : null}
                            </span>
                            <span className="mgr-option__check" aria-hidden>
                              ✓
                            </span>
                          </button>
                        </li>
                      );
                    })
                  : filteredItems.map((product) => {
                      const id = String(product.variant_id || product.id || product.product_id);
                      const name = productDisplayName(product);
                      const subtitle = productSubtitle(product);
                      const photo = product.image_url || resolveImageUrl(product);
                      const selected =
                        String(product.variant_id || '') === String(variantId) ||
                        (!variantId &&
                          String(product.id || product.product_id || '') === String(productId));
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`mgr-option${selected ? ' is-selected' : ''}`}
                            onClick={() => selectProduct(product)}
                          >
                            <span className="mgr-option__media" aria-hidden>
                              {photo ? <img src={photo} alt="" /> : name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="mgr-option__copy">
                              <strong>{name}</strong>
                              {subtitle ? <small>{subtitle}</small> : null}
                            </span>
                            <span className="mgr-option__check" aria-hidden>
                              ✓
                            </span>
                          </button>
                        </li>
                      );
                    })}
              </ul>
            ) : null}

            {/* {!hasMatchedId ? (
              <label className="mgr-manual">
                <span>{isDoctor ? 'Or type doctor name' : 'Or type product name'}</span>
                <input
                  type="text"
                  value={isDoctor ? doctorName : productName}
                  placeholder={isDoctor ? 'e.g. Dr. Vishwash Saxena' : 'e.g. Ashwagandha'}
                  onChange={(event) =>
                    isDoctor
                      ? onDoctorNameChange(event.target.value)
                      : onProductNameChange(event.target.value)
                  }
                  autoComplete={isDoctor ? 'name' : 'off'}
                />
              </label>
            ) : null} */}

            <div className={`mgr-form${hasMatchedId ? ' is-flush' : ''}`}>
              <div className="mgr-form__row">
                <label className="mgr-field">
                  <span>Your name · optional</span>
                  <input
                    type="text"
                    value={reviewerName}
                    placeholder="How should we credit you?"
                    onChange={(event) => setReviewerName(event.target.value)}
                    autoComplete="name"
                    maxLength={80}
                  />
                </label>
              </div>

              <label className="mgr-field">
                <div className="mgr-field__meta">
                  <span>Your experience · optional</span>
                  <small>
                    {review.length}/{MAX_REVIEW}
                  </small>
                </div>
                <textarea
                  value={review}
                  maxLength={MAX_REVIEW}
                  placeholder={
                    isDoctor
                      ? 'What stood out about the consultation or care?'
                      : 'How did this product or medicine help you?'
                  }
                  onChange={(event) => setReview(event.target.value)}
                />
              </label>

              <div className="mgr-field">
                <div className="mgr-field__meta">
                  <span>Photos & videos · optional</span>
                  <small>
                    {mediaItems.length}/{MAX_MEDIA}
                    {!canUploadMedia ? ' · sign in to attach' : ''}
                  </small>
                </div>
                <div className="mgr-media">
                  {mediaItems.map((item) => (
                    <div key={item.id} className="mgr-media__tile">
                      {item.type === 'video' ? (
                        <span>Video</span>
                      ) : (
                        <img src={item.previewUrl} alt="" />
                      )}
                      <button type="button" onClick={() => removeMedia(item.id)} aria-label="Remove">
                        ×
                      </button>
                    </div>
                  ))}
                  {canUploadMedia && mediaItems.length < MAX_MEDIA ? (
                    <label className="mgr-media__add">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={pickMedia}
                      />
                      + Add
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <aside className="mgr-aside">
            <div className="mgr-aside__hero">
              <span className="mgr-aside__eyebrow">
                {isDoctor ? 'Doctor review' : 'Product review'}
              </span>
              <div className="mgr-aside__preview">
                <span className={`mgr-aside__media${isDoctor ? ' is-round' : ''}`} aria-hidden>
                  {selectedImage ? (
                    <img src={selectedImage} alt="" />
                  ) : (
                    selectedLabel.slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="mgr-aside__copy">
                  <strong>{selectedLabel}</strong>
                  <p>
                    {selectedMeta ||
                      (isDoctor
                        ? 'Select a practitioner to begin.'
                        : 'Select a product or medicine to begin.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="mgr-aside__body">
              <div className="mgr-rating">
                <div className="mgr-rating__label">Your rating</div>
                <div
                  className="mgr-stars"
                  role="radiogroup"
                  aria-label="Your rating"
                  onMouseLeave={() => setHoverRating(0)}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      className={`mgr-star${star <= activeRating ? ' is-on' : ''}`}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onFocus={() => setHoverRating(star)}
                      onBlur={() => setHoverRating(0)}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div className="mgr-rating__value">
                  {activeRating ? (
                    <>
                      {activeRating}/5 <span>· {RATING_LABELS[activeRating]}</span>
                    </>
                  ) : (
                    <span>Tap a star to rate</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="mgr-submit"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {busy
                  ? 'Submitting…'
                  : isDoctor
                    ? 'Submit doctor review'
                    : 'Submit product review'}
              </button>

              <div className="mgr-trust">
                <strong>No login needed</strong>
                Your review helps the Ayurmuni community choose authentic care and products with
                confidence.
              </div>
            </div>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
