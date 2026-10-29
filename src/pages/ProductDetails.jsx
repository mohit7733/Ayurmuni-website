import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileText,
  Flame,
  Leaf,
  Minus,
  Package,
  Plus,
  RotateCcw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Star,
  Truck,
  Zap,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import ImageMagnifier from '../components/ui/ImageMagnifier';
import AutoScrollRail from '../components/AutoScrollRail';
import ProductDiscoveryRails from '../components/ProductDiscoveryRails';
import ReviewSubmitModal from '../components/ReviewSubmitModal';
import ShareButton from '../components/ShareButton';
import { formatRupee, resolveImageUrl } from '../home/catalog';
import { useCart } from '../hooks/useCart';
import {
  getAddQtyBlockMessage,
  getProductStockDisplay,
  getProductStockQty,
  isPrescriptionRequired,
  isProductLowStock,
  isProductOutOfStock,
  LOW_STOCK_THRESHOLD,
} from '../product/stock';
import { extractAPlusBlocks, splitHighlightLines } from '../product/detailContent';
import {
  getProductByVariant,
  getReviews,
  toggleWishlistProduct,
} from '../services/productService';
import { requireAuth } from '../services/guestAuth';
import { findReviewableProductOrder } from '../services/reviewService';
import { showPrescriptionRequired } from '../services/prescriptionGate';
import { showSuccessToast } from '../config/key';
import {
  extractReviewsList,
  isReviewVideoUrl,
  normalizeReviewsForDisplay,
} from '../utils/reviewUtils';
import {
  Button,
  EmptyState,
  FavButton,
  Modal,
  ReviewCard,
  SectionHeader,
  SectionHold,
} from '../components/ui';
import { PRODUCT_DETAIL_COPY as T } from '../content/productDetail';
import '../design/pages/product-detail.css';
import '../design/brand.css';
import '../design/product-card-home.css';
import '../design/pages/product-detail-brand.css';

const galleryFromProduct = (product, variant) => {
  const urls = [];
  const push = (value) => {
    const uri = typeof value === 'string' ? value.trim() : value?.media_url || value?.url || '';
    if (uri && !/example\.com|placeholder/i.test(uri) && !urls.includes(uri)) urls.push(uri);
  };
  push(variant?.cover_image);
  push(variant?.image_url);
  (Array.isArray(variant?.media) ? variant.media : []).forEach(push);
  push(product?.cover_image);
  push(product?.image_url);
  (Array.isArray(product?.media) ? product.media : []).forEach(push);
  const fallback = resolveImageUrl(variant) || resolveImageUrl(product);
  if (fallback) push(fallback);
  return urls;
};

export default function ProductDetails({ medicine = false } = {}) {
  const { variantId } = useParams();
  const navigate = useNavigate();
  const basePath = medicine ? '/medicines' : '/products';
  const shellTab = medicine ? 'medicines' : 'products';
  const { variantQuantities, addingVariantId, syncCartQuantity, itemCount } = useCart();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  const [wish, setWish] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [galleryHold, setGalleryHold] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewLookupBusy, setReviewLookupBusy] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const galleryMainRef = useRef(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState('');
  const [wishBusy, setWishBusy] = useState(false);
  const [pendingCta, setPendingCta] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!variantId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [productRes, reviewRes] = await Promise.all([
          getProductByVariant(variantId),
          getReviews({ entity_type: 'product', variant_id: variantId }),
        ]);
        if (!alive) return;
        const raw = productRes?.data ?? productRes;
        const data = Array.isArray(raw)
          ? raw[0]
          : Array.isArray(raw?.results)
            ? raw.results[0]
            : raw;
        setProduct(data && data.success === false ? null : data);
        setReviews(normalizeReviewsForDisplay(extractReviewsList(reviewRes)));
      } catch {
        if (alive) setProduct(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [variantId]);

  const variants = useMemo(
    () => (Array.isArray(product?.variants) ? product.variants : []),
    [product],
  );
  const defaultVariant = variants.find((v) => v?.is_default) || variants[0] || product;

  useEffect(() => {
    if (!variants.length && !product) {
      setSelected(null);
      return;
    }
    const match = variants.find(
      (v) => String(v?.id) === String(variantId) || String(v?.variant_id) === String(variantId),
    );
    setSelected(match || defaultVariant || product);
  }, [product, variantId, variants, defaultVariant]);

  const active = selected || defaultVariant || product;
  const cartVariantId = String(active?.id ?? active?.variant_id ?? variantId ?? '').trim();
  const cartQty = variantQuantities[cartVariantId] ?? 0;
  const adding = addingVariantId === cartVariantId;
  const images = galleryFromProduct(product, active);
  const galleryPaused = galleryHold || zoomOpen;

  useEffect(() => {
    if (images.length < 2 || galleryPaused) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setTimeout(() => {
      setImageIndex((current) => (current + 1) % images.length);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [imageIndex, images.length, galleryPaused]);

  useEffect(() => {
    const thumb = galleryMainRef.current?.parentElement?.querySelector('.pd-thumb.is-on');
    const strip = thumb?.parentElement;
    if (!thumb || !strip) return;
    const left = thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [imageIndex]);

  const stepGallery = (direction) => {
    if (images.length < 2) return;
    setImageIndex((current) => (current + direction + images.length) % images.length);
  };
  const needsRx = isPrescriptionRequired(active) || isPrescriptionRequired(product);
  const out = isProductOutOfStock(active);
  const lowStock = isProductLowStock(active);
  const stockDisplay = getProductStockDisplay(active);
  const stockQty = getProductStockQty(active);
  const maxQty = stockQty == null || stockQty <= 0 ? null : stockQty;
  const displayName = product?.name || active?.name || 'Product';
  const packParts = [active?.title, active?.size].filter(Boolean);
  const weightLabel = [active?.weightage, active?.physical_state].filter(Boolean).join(' ');
  const sizeText = packParts.join(' · ');
  const packLabel =
    weightLabel && sizeText && !sizeText.toLowerCase().includes(String(active?.weightage).toLowerCase())
      ? `${sizeText} ${weightLabel}`
      : sizeText || weightLabel;
  const price = formatRupee(active?.selling_price ?? active?.price ?? product?.selling_price);
  const selling = Number(active?.selling_price ?? active?.price ?? product?.selling_price) || 0;
  const mrpNumber = Number(active?.mrp) || 0;
  const mrp = mrpNumber > selling ? formatRupee(active?.mrp) : '';
  const saveAmount = Math.max(0, mrpNumber - selling);
  const discount =
    mrpNumber > selling ? Math.round(((mrpNumber - selling) / mrpNumber) * 100) : 0;
  const totalPrice = selling * Math.max(1, Number(qty) || 1);
  const textOf = (value) => (typeof value === 'string' ? value.trim() : '');
  const shortDescription = textOf(product?.short_description);
  const fullDescription = textOf(product?.full_description || product?.description);
  const highlightLines = splitHighlightLines(
    product?.benifits || product?.benefits || product?.highlights,
  );
  const aboutPreview =
    fullDescription.length > 140 && !descExpanded
      ? `${fullDescription.slice(0, 140).trim()}…`
      : fullDescription;
  const aPlusBlocks = extractAPlusBlocks(product);
  const brandName = textOf(product?.brand_name);
  const ratingValue = Number(
    active?.avg_rating ?? active?.rating ?? product?.avg_rating ?? product?.rating ?? product?.average_rating,
  );
  const ratingCount = Number(product?.review_count ?? product?.reviews_count ?? reviews.length);
  const categoryLabel = textOf(product?.category_name || product?.category?.name);
  const bestDealVariantId = useMemo(() => {
    if (variants.length < 2) return null;
    let bestId = null;
    let bestDisc = 0;
    variants.forEach((item) => {
      const mrpValue = Number(item?.mrp) || 0;
      const sell = Number(item?.selling_price ?? item?.price) || 0;
      const disc =
        Number(item?.discount) ||
        (mrpValue > sell ? Math.round(((mrpValue - sell) / mrpValue) * 100) : 0);
      if (disc > bestDisc) {
        bestDisc = disc;
        bestId = String(item?.id ?? item?.variant_id);
      }
    });
    return bestDisc > 0 ? bestId : null;
  }, [variants]);
  const specItems = [
    { label: 'Brand', value: brandName },
    { label: 'Pack size', value: [active?.size || active?.title, active?.weightage].filter(Boolean).join(' ') },
    { label: 'Manufacturer', value: textOf(product?.manufacturer) },
    { label: 'Origin', value: textOf(product?.origin) },
    { label: 'Treatment', value: textOf(product?.treatment_type) },
    { label: 'Dosage', value: textOf(product?.dosages) },
  ].filter((item) => item.value);
  const detailLinks = [
    { key: 'description', label: T.productDescription, preview: fullDescription, text: fullDescription },
    {
      key: 'benefits',
      label: T.benefits,
      preview: textOf(product?.benifits || product?.benefits),
      text: textOf(product?.benifits || product?.benefits),
    },
    {
      key: 'composition',
      label: T.composition,
      preview: textOf(product?.compositions || product?.ingredients),
      text: textOf(product?.compositions || product?.ingredients),
    },
    {
      key: 'howToUse',
      label: T.howToUse,
      preview: textOf(product?.how_to_use || product?.usage),
      text: textOf(product?.how_to_use || product?.usage),
    },
    {
      key: 'safety',
      label: T.safety,
      preview: textOf(product?.safety_information),
      text: textOf(product?.safety_information),
    },
  ].filter((item) => item.text);
  const returnLabel = active?.returnable_days
    ? `${active.returnable_days}D return`
    : active?.is_returnable
      ? T.easyReturns
      : T.nonReturnable;
  const goBack = () => {
    if (medicine) navigate('/medicines');
    else if (window.history.length > 1) navigate(-1);
    else navigate('/products');
  };
  const discoveryProductId = String(
    product?.product_id ?? product?.id ?? active?.product_id ?? '',
  ).trim();

  const openReviewModal = async () => {
    if (!(await requireAuth('Please login to write a review'))) return;
    setReviewLookupBusy(true);
    try {
      const match = await findReviewableProductOrder([cartVariantId, variantId]);
      if (!match) {
        showSuccessToast('You can review this product once your order for it is delivered', 'error');
        return;
      }
      if (match.alreadyReviewed) {
        showSuccessToast('You have already reviewed this product', 'error');
        return;
      }
      setReviewTarget(match);
    } catch {
      showSuccessToast('Could not check your orders. Please try again.', 'error');
    } finally {
      setReviewLookupBusy(false);
    }
  };

  useEffect(() => {
    setWish(Boolean(active?.is_wishlist_item ?? product?.is_wishlist_item));
    setQty(cartQty > 0 ? cartQty : 1);
    setImageIndex(0);
  }, [cartVariantId, product, cartQty, active?.is_wishlist_item]);

  const increaseQty = () => {
    setQty((current) => {
      const next = current + 1;
      const block = getAddQtyBlockMessage(active, next);
      if (block) {
        showSuccessToast(block, 'error');
        return current;
      }
      if (maxQty == null) return next;
      return Math.min(next, maxQty);
    });
  };

  const addToCart = async (goToCart = false) => {
    if (!(await requireAuth('Please login to add items to cart'))) return;
    if (!cartVariantId) return;
    const addQty = Math.max(1, Number(qty) || 1);
    const block = getAddQtyBlockMessage(active, addQty);
    if (block) {
      showSuccessToast(block, 'error');
      return;
    }
    if (isPrescriptionRequired(active) || isPrescriptionRequired(product)) {
      showPrescriptionRequired({
        variantId: cartVariantId,
        productName: product?.name || active?.name,
      });
      return;
    }
    setPendingCta(goToCart ? 'buy' : 'add');
    const ok = await syncCartQuantity({ ...active, variant_id: cartVariantId }, addQty);
    setPendingCta(null);
    if (!ok) {
      showSuccessToast('Try again to add into cart', 'error');
      return;
    }
    if (goToCart) navigate('/cart');
  };

  const toggleWish = async () => {
    if (wishBusy) return;
    if (!(await requireAuth('Please login to save wishlist items'))) return;
    if (!cartVariantId) {
      showSuccessToast('Product variant unavailable', 'error');
      return;
    }
    const previous = wish;
    setWish(!previous);
    setWishBusy(true);
    try {
      const res = await toggleWishlistProduct(cartVariantId);
      if (res?.success === false) throw new Error(res?.message || 'Wishlist update failed');
      setSelected((prev) => (prev ? { ...prev, is_wishlist_item: !previous } : prev));
      showSuccessToast(previous ? 'Removed from wishlist' : 'Added to wishlist', 'success');
    } catch (error) {
      setWish(previous);
      showSuccessToast(error?.message || 'Unable to update wishlist', 'error');
    } finally {
      setWishBusy(false);
    }
  };

  const ctaBusy = adding || pendingCta != null;
  const addBusy = pendingCta === 'add' || (adding && pendingCta !== 'buy');
  const buyBusy = pendingCta === 'buy';
  const atMax = maxQty != null && qty >= maxQty;

  const cartAction = (
    <Button
      variant="soft"
      size="sm"
      onClick={() => navigate('/cart')}
      leadingIcon={<ShoppingBag size={18} aria-hidden />}
    >
      {T.cart}
      {itemCount ? ` (${itemCount})` : ''}
    </Button>
  );

  const renderBuyActions = () => {
    if (needsRx) {
      return (
        <div className="pd-buy">
          <Button
            variant="primary"
            disabled={out || ctaBusy}
            loading={addBusy}
            onClick={() => addToCart(false)}
            leadingIcon={<FileText size={16} aria-hidden />}
          >
            {T.uploadRx}
          </Button>
        </div>
      );
    }
    return (
      <div className="pd-buy">
        <Button
          variant="secondary"
          disabled={out || ctaBusy}
          loading={addBusy}
          onClick={() => addToCart(false)}
          leadingIcon={<ShoppingCart size={16} aria-hidden />}
        >
          {out ? T.soldOut : T.addToCart}
        </Button>
        <Button
          variant="primary"
          disabled={(cartQty <= 0 && out) || ctaBusy}
          loading={buyBusy}
          onClick={() => addToCart(true)}
        >
          {cartQty > 0 ? T.goToCart : T.buyNow}
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <AppShell tab={shellTab}>
        <section className="pd-page pd-page--brand" aria-busy="true" aria-label={T.loading}>
          <div className="pd-topbar">
            <span />
            {cartAction}
          </div>
          <SectionHold label={T.loading} minHeight={420} />
        </section>
      </AppShell>
    );
  }

  if (!product && !active) {
    return (
      <AppShell tab={shellTab}>
        <section className="pd-page pd-page--brand">
          <div className="pd-topbar">
            <button type="button" className="am-back" onClick={() => navigate(basePath)}>
              <ArrowLeft size={16} aria-hidden />
              {medicine ? 'Back to medicines' : T.backToStore}
            </button>
            {cartAction}
          </div>
          <EmptyState
            title={T.notFoundTitle}
            description={T.notFoundText}
            action={
              <Button variant="primary" to={basePath}>
                {medicine ? 'Back to medicines' : T.backToStore}
              </Button>
            }
          />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell tab={shellTab}>
      <section className="pd-page pd-page--brand">
        <div className="pd-topbar">
          <button type="button" className="am-back" onClick={goBack}>
            <ArrowLeft size={16} aria-hidden />
            {medicine ? 'Medicines' : 'Back'}
          </button>
          {medicine ? (
            <nav className="pd-crumbs" aria-label="Breadcrumb" style={{ fontSize: 13, opacity: 0.8 }}>
              <a href="/medicines" onClick={(e) => { e.preventDefault(); navigate('/medicines'); }}>Medicines</a>
              {' > '}
              <span aria-current="page">{displayName}</span>
            </nav>
          ) : null}
          <div className="pd-topbar__actions">
            <ShareButton
              title={`${displayName} - Ayurmuni`}
              text={`${displayName}${packLabel ? ` (${packLabel})` : ''} — ${price} on Ayurmuni`}
              url={window.location.href}
              variant="soft"
              showModal={true}
            />
            {cartAction}
          </div>
        </div>

        <div className="pd-layout">
          <div className="pd-gallery">
            <div
              className={`pd-gallery__main${images.length > 1 ? ' is-carousel' : ''}${galleryPaused ? ' is-paused' : ''}`}
              ref={galleryMainRef}
              onMouseEnter={() => setGalleryHold(true)}
              onMouseLeave={() => setGalleryHold(false)}
              onFocus={() => setGalleryHold(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setGalleryHold(false);
              }}
            >
              {images[imageIndex] ? (
                <button
                  type="button"
                  key={images[imageIndex]}
                  className="pd-gallery__zoom"
                  onClick={() => setZoomOpen(true)}
                  aria-label="Zoom product image"
                >
                  <ImageMagnifier src={images[imageIndex]} anchorRef={galleryMainRef}>
                    <img src={images[imageIndex]} alt={displayName} decoding="async" />
                  </ImageMagnifier>
                </button>
              ) : (
                <span className="pd-gallery__placeholder" aria-hidden>
                  <Leaf size={48} />
                </span>
              )}
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="pd-gallery__nav pd-gallery__nav--prev"
                    aria-label="Previous image"
                    onClick={() => stepGallery(-1)}
                  >
                    <ChevronLeft size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="pd-gallery__nav pd-gallery__nav--next"
                    aria-label="Next image"
                    onClick={() => stepGallery(1)}
                  >
                    <ChevronRight size={18} aria-hidden />
                  </button>
                  <span className={`pd-gallery__progress${galleryPaused ? ' is-paused' : ''}`} key={imageIndex} />
                </>
              ) : null}
              <div className="pd-gallery__badges">
                {discount > 0 ? <span className="pd-badge">{discount}% off</span> : null}
                {needsRx ? (
                  <span className="pd-badge pd-badge--rx">
                    <FileText size={12} aria-hidden /> Rx
                  </span>
                ) : null}
              </div>
              <FavButton
                corner
                on={wish}
                label={wish ? T.savedWishlist : T.saveWishlist}
                disabled={wishBusy}
                onClick={toggleWish}
              />
            </div>
            {images.length > 1 ? (
              <div className="pd-thumbs" role="tablist" aria-label="Product images">
                {images.map((src, index) => (
                  <button
                    key={src}
                    type="button"
                    role="tab"
                    aria-selected={index === imageIndex}
                    aria-label={`${T.showImage} ${index + 1}`}
                    className={`pd-thumb${index === imageIndex ? ' is-on' : ''}`}
                    onClick={() => setImageIndex(index)}
                  >
                    <img src={src} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="pd-aside pd-info">
            <div className="pd-info__top">
              <p className="pd-info__eyebrow">{brandName || categoryLabel || 'Ayurmuni'}</p>
            </div>

            <h1 className="pd-title">{displayName}</h1>
            {ratingValue > 0 || packLabel || (brandName && categoryLabel) ? (
              <p className="pd-meta">
                {ratingValue > 0 ? (
                  <span className="pd-meta__rating">
                    <Star size={14} aria-hidden fill="currentColor" />
                    {ratingValue.toFixed(1)}
                    {ratingCount > 0 ? (
                      <span className="pd-meta__count">
                        ({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {packLabel ? <span className="pd-meta__pack">{packLabel}</span> : null}
                {brandName && categoryLabel ? <span className="pd-meta__pack">{categoryLabel}</span> : null}
              </p>
            ) : null}
            {shortDescription ? <p className="pd-short">{shortDescription}</p> : null}

            <div>
              <p className="pd-price">
                <strong>{price}</strong>
                {mrp ? (
                  <s>
                    <span>MRP </span>
                    {mrp}
                  </s>
                ) : null}
                {discount > 0 ? <em>{discount}% off</em> : null}
              </p>
              <p className="pd-price__note">{T.perUnit}</p>
              {lowStock && stockDisplay.qty ? (
                <p className="pd-hurry">
                  <Flame size={14} aria-hidden />
                  Hurry! Only {stockDisplay.qty} left at this price
                </p>
              ) : (
                <p className={`pd-stock pd-stock--${stockDisplay.tone}`}>
                  <span className="pd-stock__dot" aria-hidden />
                  {stockDisplay.label}
                </p>
              )}
            </div>

            {saveAmount > 0 ? (
              <p className="pd-save">
                <span className="pd-save__icon">
                  <Zap size={13} aria-hidden />
                </span>
                {T.youSave} {formatRupee(saveAmount)} {T.onThisPack}
              </p>
            ) : null}

            <p className="pd-delivery">
              <span className="pd-delivery__icon">
                <Truck size={14} aria-hidden />
              </span>
              <span>
                {T.deliveryLead} <strong>{T.deliveryStrong}</strong>
              </span>
            </p>

            {variants.length > 0 ? (
              <div className="pd-field">
                <div className="pd-field__row">
                  <span className="pd-field__label">{variants.length > 1 ? T.selectPack : T.pack}</span>
                  {cartQty > 0 ? (
                    <span className="pd-incart">
                      {cartQty} {T.inCart}
                    </span>
                  ) : null}
                </div>
                <div className="pd-packs" role="listbox" aria-label={T.selectPack}>
                  {variants.map((item) => {
                    const id = String(item.id ?? item.variant_id);
                    const on = id === cartVariantId;
                    const isBest = bestDealVariantId === id;
                    const image = resolveImageUrl(item) || images[0];
                    const itemWeight = [item?.weightage, item?.physical_state].filter(Boolean).join(' ');
                    const itemSize = String(item?.size || item?.title || T.pack).trim();
                    const showWeight =
                      itemWeight && !itemSize.toLowerCase().includes(String(item?.weightage || '').toLowerCase());
                    return (
                      <button
                        key={id}
                        type="button"
                        role="option"
                        aria-selected={on}
                        className={`pd-pack${on ? ' is-on' : ''}`}
                        onClick={() => setSelected(item)}
                      >
                        {isBest ? <span className="pd-pack__best">{T.bestDeal}</span> : null}
                        {on ? (
                          <span className="pd-pack__check" aria-hidden>
                            <Check size={12} />
                          </span>
                        ) : null}
                        <span className="pd-pack__img">
                          {image ? <img src={image} alt="" /> : <Package size={22} aria-hidden />}
                        </span>
                        <span className="pd-pack__size">
                          {itemSize}
                          {showWeight ? ` ${itemWeight}` : ''}
                        </span>
                        <span className="pd-pack__price">
                          {formatRupee(item?.selling_price ?? item?.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="pd-purchase">
              <div className={`am-stepper${out ? ' is-off' : ''}`} role="group" aria-label={T.quantity}>
                <button
                  type="button"
                  aria-label={T.decreaseQty}
                  disabled={out || qty <= 1}
                  onClick={() => setQty((current) => (current > 1 ? current - 1 : 1))}
                >
                  <Minus size={14} aria-hidden />
                </button>
                <span aria-live="polite">{qty}</span>
                <button
                  type="button"
                  aria-label={T.increaseQty}
                  disabled={out || atMax}
                  onClick={increaseQty}
                >
                  <Plus size={14} aria-hidden />
                </button>
              </div>
              {renderBuyActions()}
            </div>
            {maxQty != null && maxQty > 0 && maxQty <= LOW_STOCK_THRESHOLD && qty >= maxQty ? (
              <p className="pd-qty-note">
                {maxQty === 1 ? T.onlyOne : `Only ${maxQty} items available.`}
              </p>
            ) : null}

            <ul className="pd-trust" aria-label={T.trustLabel}>
              <li>
                <Truck size={18} aria-hidden />
                <span>{active?.is_free_shipping ? T.freeDelivery : T.fastDelivery}</span>
              </li>
              <li>
                <Banknote size={18} aria-hidden />
                <span>{active?.pay_on_delivery ? T.cod : T.onlinePay}</span>
              </li>
              <li>
                {active?.is_returnable || active?.returnable_days ? (
                  <RotateCcw size={18} aria-hidden />
                ) : (
                  <Shield size={18} aria-hidden />
                )}
                <span>{returnLabel}</span>
              </li>
            </ul>
          </div>
        </div>

        {highlightLines.length || fullDescription ? (
          <section className="pd-details" aria-label={T.about}>
            {highlightLines.length ? (
              <div>
                <h2 className="pd-details__title">{T.highlights}</h2>
                <ul className="pd-highlights pd-highlights--grid">
                  {highlightLines.map((line) => (
                    <li key={line}>
                      <CircleCheck size={16} aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {fullDescription ? (
              <div>
                <h2 className="pd-details__title">{T.about}</h2>
                <p className="pd-about">{aboutPreview}</p>
                {fullDescription.length > 140 ? (
                  <button type="button" className="pd-more" onClick={() => setDescExpanded((open) => !open)}>
                    {descExpanded ? T.showLess : T.readMore}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {aPlusBlocks.length ? (
          <section className="pd-details" aria-label={T.fromBrand}>
            <h2 className="pd-details__title">{T.fromBrand}</h2>
            <div className="pd-aplus">
              {aPlusBlocks.map((block) => (
                <article key={block.id} className="pd-aplus__block">
                  {block.imageUri ? <img src={block.imageUri} alt={block.title || ''} /> : null}
                  {block.title ? <h3>{block.title}</h3> : null}
                  {block.body ? <p>{block.body}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {specItems.length || detailLinks.length ? (
          <section className="pd-details" aria-label={T.details}>
            <h2 className="pd-details__title">{T.details}</h2>
            <p className="pd-details__sub">
              {specItems.length
                ? `${specItems.length} ${T.specifications}`
                : T.detailsFallback}
            </p>
            {specItems.length ? (
              <dl className="pd-specs">
                {specItems.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {detailLinks.length ? (
              <div className="pd-accordion">
                {detailLinks.map((link) => {
                  const open = expandedDetail === link.key;
                  return (
                    <div key={link.key} className={`pd-accordion__item${open ? ' is-open' : ''}`}>
                      <button
                        type="button"
                        className="pd-accordion__btn"
                        aria-expanded={open}
                        onClick={() => setExpandedDetail(open ? '' : link.key)}
                      >
                        <span>
                          <strong>{link.label}</strong>
                          {!open ? <em>{link.preview}</em> : null}
                        </span>
                        <ChevronDown size={16} aria-hidden />
                      </button>
                      {open ? <p>{link.text}</p> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="pd-reviews" aria-labelledby="pd-reviews-title">
          <SectionHeader
            id="pd-reviews-title"
            title={T.reviews}
            action={
              <div className="pd-review-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openReviewModal}
                  loading={reviewLookupBusy}
                  leadingIcon={<Star size={16} />}
                >
                  Write Review
                </Button>
                {reviews.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigate('/reviews', {
                        state: {
                          entityType: 'product',
                          variantId,
                          reviews,
                        },
                      })
                    }
                  >
                    {T.viewAllReviews}
                  </Button>
                )}
              </div>
            }
          />
          {reviews.length > 0 ? (
            <AutoScrollRail
              label="Product reviews"
              className="pd-auto-rail"
              trackClassName="pd-review-list"
              itemClassName="pd-review-item"
            >
              {reviews.slice(0, 5).map((item, index) => {
                const media = (item.image_urls || []).map((url) => ({
                  url,
                  type: isReviewVideoUrl(url) ? 'video' : 'image',
                }));
                return (
                  <ReviewCard
                    key={item.id || index}
                    name={item.patient_name || 'Patient'}
                    rating={item.rating}
                    text={item.comment || item.review || item.message || ''}
                    media={media}
                    onMediaClick={(mediaIndex) =>
                      navigate('/reviews/gallery', {
                        state: { images: item.image_urls, selectedIndex: mediaIndex },
                      })
                    }
                  />
                );
              })}
            </AutoScrollRail>
          ) : (
            <EmptyState compact title={T.noReviews} description={T.noReviewsText} />
          )}
        </section>

        <ProductDiscoveryRails productId={discoveryProductId} excludeVariantId={cartVariantId} detailBase={basePath} />

        <div className="pd-sticky">
          <div className="pd-sticky__price">
            <strong>{formatRupee(totalPrice)}</strong>
            <span>
              {cartQty > 0
                ? `${cartQty} ${T.inCart}`
                : saveAmount > 0
                  ? `Save ${formatRupee(saveAmount * Math.max(1, qty))}`
                  : T.total}
            </span>
          </div>
          {renderBuyActions()}
        </div>
      </section>

      <Modal
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        title={displayName}
        size="lg"
        className="pd-zoom-modal"
      >
        {images[imageIndex] ? (
          <div
            className={`pd-zoom${images.length > 1 ? ' pd-zoom--multi' : ''}`}
            onKeyDown={(event) => {
              if (images.length < 2) return;
              if (event.key === 'ArrowLeft') setImageIndex((i) => (i - 1 + images.length) % images.length);
              if (event.key === 'ArrowRight') setImageIndex((i) => (i + 1) % images.length);
            }}
          >
            <div className="pd-zoom__stage">
              <img className="pd-zoom-img" src={images[imageIndex]} alt={displayName} />
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="pd-zoom__nav pd-zoom__nav--prev"
                    aria-label="Previous image"
                    onClick={() => setImageIndex((i) => (i - 1 + images.length) % images.length)}
                  >
                    <ChevronLeft size={20} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="pd-zoom__nav pd-zoom__nav--next"
                    aria-label="Next image"
                    onClick={() => setImageIndex((i) => (i + 1) % images.length)}
                  >
                    <ChevronRight size={20} aria-hidden />
                  </button>
                </>
              ) : null}
            </div>
            {images.length > 1 ? (
              <div className="pd-zoom__thumbs" role="tablist" aria-label="Product images">
                {images.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={index === imageIndex}
                    aria-label={`Image ${index + 1} of ${images.length}`}
                    className={`pd-zoom__thumb${index === imageIndex ? ' is-on' : ''}`}
                    onClick={() => setImageIndex(index)}
                  >
                    <img src={src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Review Submit Modal */}
      <ReviewSubmitModal
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        product={{
          variant_id: reviewTarget?.variantId,
          order_id: reviewTarget?.orderId,
          name: product?.name,
          image: selected?.cover_image || selected?.image_url || product?.cover_image,
          size: selected?.size,
        }}
        onSuccess={async () => {
          // Refresh reviews after successful submission
          try {
            const reviewRes = await getReviews({ entity_type: 'product', variant_id: variantId });
            setReviews(normalizeReviewsForDisplay(extractReviewsList(reviewRes)));
          } catch {
            /* keep the existing list */
          }
        }}
      />
    </AppShell>
  );
}
