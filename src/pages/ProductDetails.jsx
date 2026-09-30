import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Heart, Leaf, Minus, Plus, ShoppingBag, Star } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import ProductDiscoveryRails from '../components/ProductDiscoveryRails';
import ReviewSubmitModal from '../components/ReviewSubmitModal';
import ShareButton from '../components/ShareButton';
import { formatRupee, resolveImageUrl } from '../home/catalog';
import { useCart } from '../hooks/useCart';
import {
  getAddQtyBlockMessage,
  isPrescriptionRequired,
  isProductOutOfStock,
} from '../product/stock';
import {
  getProductByVariant,
  getReviews,
  toggleWishlistProduct,
} from '../services/productService';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import {
  extractReviewsList,
  isReviewVideoUrl,
  normalizeReviewsForDisplay,
} from '../utils/reviewUtils';
import {
  Badge,
  Button,
  Chip,
  Disclaimer,
  EmptyState,
  IconButton,
  Modal,
  ReviewCard,
  SectionHeader,
  Skeleton,
  SkeletonText,
} from '../components/ui';
import { PRODUCT_DETAIL_COPY as T } from '../content/productDetail';
import '../design/pages/product-detail.css';

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

export default function ProductDetails() {
  const { variantId } = useParams();
  const navigate = useNavigate();
  const { variantQuantities, addingVariantId, syncCartQuantity, itemCount } = useCart();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  const [wish, setWish] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

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
  const needsRx = isPrescriptionRequired(active) || isPrescriptionRequired(product);
  const out = isProductOutOfStock(active);
  const displayName = product?.name || active?.name || 'Product';
  const packLabel = active?.size || active?.title || active?.weightage || '';
  const price = formatRupee(active?.selling_price ?? active?.price ?? product?.selling_price);
  const mrp =
    Number(active?.mrp) > Number(active?.selling_price || 0) ? formatRupee(active?.mrp) : '';
  const discount =
    Number(active?.mrp) > Number(active?.selling_price || 0)
      ? Math.round(((active.mrp - active.selling_price) / active.mrp) * 100)
      : 0;
  const discoveryProductId = String(
    product?.product_id ?? product?.id ?? active?.product_id ?? '',
  ).trim();

  useEffect(() => {
    setWish(Boolean(active?.is_wishlist_item ?? product?.is_wishlist_item));
    setQty(cartQty > 0 ? cartQty : 1);
    setImageIndex(0);
  }, [cartVariantId, product, cartQty, active?.is_wishlist_item]);

  const addToCart = async (goToCart = false) => {
    if (!(await requireAuth('Please login to add items to cart'))) return;
    const addQty = Math.max(1, Number(qty) || 1);
    const block = getAddQtyBlockMessage(active, addQty);
    if (block) {
      showSuccessToast(block, 'error');
      return;
    }
    if (isPrescriptionRequired(active) || isPrescriptionRequired(product)) {
      showSuccessToast(
        'This medicine needs a valid prescription before it can be added to cart.',
        'error',
      );
      navigate(
        `/medicines/prescription?variant=${encodeURIComponent(cartVariantId)}&name=${encodeURIComponent(
          product?.name || active?.name || '',
        )}`,
        { state: { variantIds: [cartVariantId], productName: product?.name || active?.name } },
      );
      return;
    }
    const ok = await syncCartQuantity({ ...active, variant_id: cartVariantId }, addQty);
    if (!ok) {
      showSuccessToast('Try again to add into cart', 'error');
      return;
    }
    if (goToCart) navigate('/cart');
  };

  const toggleWish = async () => {
    if (!(await requireAuth('Please login to save wishlist items'))) return;
    if (!cartVariantId) return;
    const res = await toggleWishlistProduct(cartVariantId);
    if (res?.success === false) {
      showSuccessToast(res?.message || 'Unable to update wishlist', 'error');
      return;
    }
    setWish((prev) => !prev);
  };

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

  const renderBuyActions = (block = false) => {
    if (needsRx) {
      return (
        <Button
          variant="primary"
          block={block}
          disabled={out}
          leadingIcon={<FileText size={18} aria-hidden />}
          onClick={() => addToCart(false)}
        >
          {T.uploadRx}
        </Button>
      );
    }
    return (
      <>
        <Button variant="secondary" block={block} disabled={out || adding} onClick={() => addToCart(false)}>
          {adding ? T.adding : T.addToCart}
        </Button>
        <Button variant="primary" block={block} disabled={out || adding} onClick={() => addToCart(true)}>
          {T.buyNow}
        </Button>
      </>
    );
  };

  if (loading) {
    return (
      <AppShell tab="products">
        <section className="pd-page" aria-busy="true" aria-label={T.loading}>
          <PageHeader title={T.title} actions={cartAction} />
          <div className="pd-skel">
            <Skeleton className="pd-skel-gallery" />
            <SkeletonText lines={4} />
          </div>
        </section>
      </AppShell>
    );
  }

  if (!product && !active) {
    return (
      <AppShell tab="products">
        <section className="pd-page">
          <PageHeader title={T.notFoundTitle} backTo="/products" actions={cartAction} />
          <EmptyState
            title={T.notFoundTitle}
            description={T.notFoundText}
            action={
              <Button variant="primary" to="/products">
                {T.backToStore}
              </Button>
            }
          />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell tab="products">
      <section className="pd-page">
        <PageHeader title={displayName} subtitle={packLabel || undefined} actions={cartAction} />

        <div className="pd-layout">
          <div className="pd-gallery">
            <div className="pd-gallery__main">
              {images[imageIndex] ? (
                <button
                  type="button"
                  className="pd-gallery__zoom"
                  onClick={() => setZoomOpen(true)}
                  aria-label="Zoom product image"
                >
                  <img src={images[imageIndex]} alt={displayName} decoding="async" />
                </button>
              ) : (
                <span className="pd-gallery__placeholder" aria-hidden>
                  <Leaf size={48} />
                </span>
              )}
              <div className="pd-gallery__badges">
                {out ? <Badge tone="neutral">{T.outOfStock}</Badge> : null}
                {needsRx ? (
                  <Badge tone="warning" icon={<FileText size={14} aria-hidden />}>
                    {T.prescriptionRequired}
                  </Badge>
                ) : null}
                {discount > 0 ? <Badge tone="success">{discount}% off</Badge> : null}
              </div>
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

          <div className="pd-aside">
            <div className="pd-main">
              <div className="pd-head">
                <IconButton
                  label={wish ? T.savedWishlist : T.saveWishlist}
                  variant="soft"
                  pressed={wish}
                  onClick={toggleWish}
                >
                  <Heart size={20} aria-hidden fill={wish ? 'currentColor' : 'none'} />
                </IconButton>
                <ShareButton
                  title={`${displayName} - Ayurmuni`}
                  text={`Check out this amazing product on Ayurmuni!`}
                  url={window.location.href}
                  variant="soft"
                  showModal={true}
                />
              </div>

              <p className="pd-price">
                <strong>{price}</strong>
                {mrp ? <s>{mrp}</s> : null}
                {discount > 0 ? <Badge tone="success">{discount}% off</Badge> : null}
                <span className="pd-price__note">{T.perUnit}</span>
              </p>

              {variants.length > 1 ? (
                <div className="pd-variants" role="group" aria-label={T.pack}>
                  {variants.map((item) => {
                    const id = String(item.id ?? item.variant_id);
                    const on = id === cartVariantId;
                    return (
                      <Chip key={id} selected={on} onClick={() => setSelected(item)}>
                        {item.title || item.size || item.weightage || T.pack}
                      </Chip>
                    );
                  })}
                </div>
              ) : null}

              <div className="pd-qty">
                <span className="pd-qty__label">{T.quantity}</span>
                <div className="am-stepper" role="group" aria-label={T.quantity}>
                  <button
                    type="button"
                    aria-label={T.decreaseQty}
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus size={18} aria-hidden />
                  </button>
                  <span aria-live="polite">{qty}</span>
                  <button type="button" aria-label={T.increaseQty} onClick={() => setQty((q) => q + 1)}>
                    <Plus size={18} aria-hidden />
                  </button>
                </div>
              </div>

              {product?.description ? (
                <div className="pd-card">
                  <h2>{T.description}</h2>
                  <p>{product.description}</p>
                </div>
              ) : null}

              {product?.benefits ? (
                <div className="pd-card">
                  <h2>{T.benefits}</h2>
                  <p>{product.benefits}</p>
                </div>
              ) : null}

              <section className="pd-reviews" aria-labelledby="pd-reviews-title">
                <SectionHeader
                  id="pd-reviews-title"
                  title={T.reviews}
                  action={
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          if (!(await requireAuth('Please login to write a review'))) return;
                          setShowReviewModal(true);
                        }}
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
                  reviews.slice(0, 5).map((item, index) => {
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
                  })
                ) : (
                  <EmptyState compact title={T.noReviews} description={T.noReviewsText} />
                )}
              </section>

              <Disclaimer />
            </div>

            <aside className="pd-buy" aria-label="Purchase options">
              <p className="pd-buy__price">{price}</p>
              {renderBuyActions(true)}
            </aside>
          </div>
        </div>

        <ProductDiscoveryRails productId={discoveryProductId} excludeVariantId={cartVariantId} />

        {!out ? (
          <div className="pd-sticky">
            {renderBuyActions()}
          </div>
        ) : null}
      </section>

      <Modal open={zoomOpen} onClose={() => setZoomOpen(false)} title={displayName} size="lg">
        {images[imageIndex] ? (
          <img className="pd-zoom-img" src={images[imageIndex]} alt={displayName} />
        ) : null}
      </Modal>

      {/* Review Submit Modal */}
      <ReviewSubmitModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        product={{
          product_id: product?.product_id || product?.id,
          variant_id: variantId,
          name: product?.name,
          image: selected?.cover_image || selected?.image_url || product?.cover_image,
          size: selected?.size,
        }}
        onSuccess={async () => {
          // Refresh reviews after successful submission
          try {
            const reviewRes = await getReviews({ entity_type: 'product', variant_id: variantId });
            setReviews(normalizeReviewsForDisplay(extractReviewsList(reviewRes)));
          } catch (error) {
            console.error('Failed to refresh reviews:', error);
          }
        }}
      />
    </AppShell>
  );
}
