import Skeleton from './Block';
import { cx } from '../ui/cx';
import '../our-doctor-card.css';
import './skeletons.css';

const range = (n) => Array.from({ length: Math.max(1, n) }, (_, i) => i);

/** Accessible live wrapper every skeleton sits in. */
export function SkeletonRegion({ label = 'Loading', className, style, children, as: Tag = 'div' }) {
  return (
    <Tag className={cx('am-skel-region', className)} style={style} role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      <span className="am-sr-only">{label}</span>
      {children}
    </Tag>
  );
}

/** Same shell as ProductCard (am-product-card), so the card size does not shift. */
export function ProductCardSkeleton() {
  return (
    <article className="am-product-card am-skel-product" aria-hidden>
      <div className="am-product-card__media">
        <Skeleton variant="rect" className="am-skel-fill" />
      </div>
      <div className="am-product-card__body am-skel-product__body">
        <Skeleton width="85%" />
        <Skeleton width="55%" />
        <span className="am-skel-product__foot">
          <Skeleton width="38%" height={18} />
          <Skeleton variant="rect" width={72} height={32} />
        </span>
      </div>
    </article>
  );
}

/** Same shell as OurDoctorCard (hm-odoc). */
export function DoctorCardSkeleton() {
  return (
    <article className="hm-odoc am-skel-odoc" aria-hidden>
      <span className="hm-odoc__photo">
        <Skeleton variant="circle" className="am-skel-fill" />
      </span>
      <div className="hm-odoc__id">
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={11} className="am-skel-gap" />
      </div>
      <div className="hm-odoc__foot">
        <span className="am-skel-row">
          <Skeleton width={46} height={20} />
          <Skeleton width={38} height={20} />
          <Skeleton width={52} height={20} />
        </span>
        <Skeleton variant="rect" width={86} height={34} />
      </div>
    </article>
  );
}

export function SectionHeaderSkeleton({ action = true, description = true }) {
  return (
    <div className="am-skel-head" aria-hidden>
      <span className="am-skel-head__row">
        <Skeleton width="42%" height={22} />
        {action ? <Skeleton width={64} height={16} /> : null}
      </span>
      {description ? <Skeleton width="64%" height={12} /> : null}
    </div>
  );
}

/** A horizontal rail of card skeletons using the real am-rail classes. */
export function RailSkeleton({ kind = 'product', count = 4, label = 'Loading' }) {
  const Card = kind === 'doctor' ? DoctorCardSkeleton : ProductCardSkeleton;
  return (
    <SkeletonRegion label={label}>
      <ul className="am-rail am-skel-rail">
        {range(count).map((i) => (
          <li key={i} className={cx('am-rail__item', kind === 'doctor' ? null : 'am-rail__item--product')}>
            <Card />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}

export function CardGridSkeleton({ kind = 'product', count = 4, className, label = 'Loading' }) {
  const Card = kind === 'doctor' ? DoctorCardSkeleton : ProductCardSkeleton;
  return (
    <SkeletonRegion label={label} className={cx('am-skeleton-grid', className)}>
      {range(count).map((i) => (
        <Card key={i} />
      ))}
    </SkeletonRegion>
  );
}

export function ListRowsSkeleton({ count = 4, label = 'Loading' }) {
  return (
    <SkeletonRegion label={label} className="am-load__rows">
      {range(count).map((i) => (
        <div key={i} className="am-load__row" aria-hidden>
          <Skeleton variant="circle" width={44} height={44} />
          <span className="am-load__row-copy">
            <Skeleton width="55%" />
            <Skeleton width="35%" height={11} />
          </span>
          <Skeleton width={60} height={24} />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function DetailSkeleton({ label = 'Loading' }) {
  return (
    <SkeletonRegion label={label} className="am-skel-detail">
      <Skeleton variant="rect" className="am-skel-detail__media" />
      <div className="am-skel-detail__copy" aria-hidden>
        <Skeleton width="70%" height={26} />
        <Skeleton width="40%" height={16} />
        <Skeleton width="30%" height={22} />
        <Skeleton width="100%" />
        <Skeleton width="92%" />
        <Skeleton width="60%" />
        <span className="am-skel-row">
          <Skeleton variant="rect" width={140} height={44} />
          <Skeleton variant="rect" width={140} height={44} />
        </span>
      </div>
    </SkeletonRegion>
  );
}

/** Generic section block: header + content lines, sized to the space it holds. */
export function BlockSkeleton({ label = 'Loading', minHeight = 160 }) {
  const lines = Math.max(1, Math.min(8, Math.round((minHeight - 50) / 34)));
  return (
    <SkeletonRegion label={label} className="am-skel-block" style={{ minHeight }}>
      <SectionHeaderSkeleton action={false} description={minHeight >= 140} />
      <span className="am-skel-block__lines" aria-hidden>
        {range(lines).map((i) => (
          <Skeleton key={i} variant="rect" height={22} width={i === lines - 1 ? '65%' : '100%'} />
        ))}
      </span>
    </SkeletonRegion>
  );
}

export function ChipsSkeleton({ count = 6, label = 'Loading' }) {
  return (
    <SkeletonRegion label={label} className="am-skel-row am-skel-chips">
      {range(count).map((i) => (
        <Skeleton key={i} variant="rect" width={80 + ((i * 23) % 50)} height={36} />
      ))}
    </SkeletonRegion>
  );
}

/** Homepage "Our doctors" panel placeholder (same wrapper classes as HomeOurDoctors). */
export function HomeDoctorsSkeleton({ label = 'Loading doctors', count = 4 }) {
  return (
    <section className="hm-section hm-panel hm-odocs" aria-busy="true" aria-label={label}>
      <SectionHeaderSkeleton />
      <RailSkeleton kind="doctor" count={count} label={label} />
    </section>
  );
}

/** Homepage product panels placeholder (same grid as HomeProductPanels). */
export function HomeProductsSkeleton({ label = 'Loading products', panels = 2, count = 3 }) {
  return (
    <div className="hm-product-row hm-product-grid" aria-busy="true" aria-label={label}>
      {range(panels).map((i) => (
        <section key={i} className="hm-section hm-products">
          <SectionHeaderSkeleton />
          <RailSkeleton count={count} label={label} />
        </section>
      ))}
    </div>
  );
}

/** Route-level / first paint placeholder. */
export function PageSkeleton({ label = 'Loading page' }) {
  return (
    <SkeletonRegion label={label} className="am-skel-page">
      <Skeleton variant="rect" className="am-skel-page__hero" />
      <SectionHeaderSkeleton />
      <ul className="am-rail am-skel-rail" aria-hidden>
        {range(4).map((i) => (
          <li key={i} className="am-rail__item am-rail__item--product">
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
      <SectionHeaderSkeleton />
      <span className="am-skel-block__lines" aria-hidden>
        {range(3).map((i) => (
          <Skeleton key={i} variant="rect" height={56} />
        ))}
      </span>
    </SkeletonRegion>
  );
}

/** Pick a skeleton by name: block | products | doctors | list | detail | page | chips | cards. */
export function SkeletonFor({ variant = 'block', label, minHeight, count, className }) {
  switch (variant) {
    case 'products':
      return <RailSkeleton kind="product" count={count || 4} label={label} />;
    case 'doctors':
      return <RailSkeleton kind="doctor" count={count || 4} label={label} />;
    case 'cards':
      return <CardGridSkeleton count={count || 4} className={className} label={label} />;
    case 'list':
      return <ListRowsSkeleton count={count || 4} label={label} />;
    case 'detail':
      return <DetailSkeleton label={label} />;
    case 'page':
      return <PageSkeleton label={label} />;
    case 'chips':
      return <ChipsSkeleton count={count || 6} label={label} />;
    default:
      return <BlockSkeleton label={label} minHeight={minHeight} />;
  }
}