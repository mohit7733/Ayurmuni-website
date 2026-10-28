import { ArrowRight } from 'lucide-react';
import { Button, Rail, RailItem, Reveal, SectionHeader } from './ui';
import OurDoctorCard from './OurDoctorCard';
import ProductCard from './ProductCard';
import { HOME_COPY as T } from '../content/home';
import { getDoctorId } from '../consult/doctors';
import '../design/pages/home-pair.css';
import '../design/pages/home.css';

/** Homepage "View all" button. */
export function ViewAll({ onClick, label, plain = false, className }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={[plain ? 'hm-doctor-head__link' : '', className].filter(Boolean).join(' ') || undefined}
      onClick={onClick}
      trailingIcon={<ArrowRight size={16} aria-hidden />}
    >
      {T.viewAll}
      <span className="am-sr-only"> {label}</span>
    </Button>
  );
}

/** Homepage rail header (title + View all + description). */
export function DoctorRailHeader({ id, eyebrow, title, description, onViewAll, reserveEyebrow = false }) {
  return (
    <div className="hm-doctor-head">
      {eyebrow ? (
        <p className="am-eyebrow">{eyebrow}</p>
      ) : reserveEyebrow ? (
        <p className="am-eyebrow" aria-hidden="true">
          &nbsp;
        </p>
      ) : null}
      <div className="hm-doctor-head__row">
        <h2 id={id} className="hm-doctor-head__title">
          {title}
        </h2>
        <ViewAll plain label={title} onClick={onViewAll} />
      </div>
      {description ? <p className="hm-doctor-head__desc">{description}</p> : null}
    </div>
  );
}

/** Homepage product rail: auto-scrolling rail of product-size ProductCards. */
export function HomeProductRail({ items, label, auto = true }) {
  return (
    <Rail label={label} auto={auto}>
      {items.map((item) => (
        <RailItem key={`${item.variant_id || item.id}`} size="product">
          <ProductCard item={item} />
        </RailItem>
      ))}
    </Rail>
  );
}

/**
 * Homepage product panels (Medicines / Products ...): two per row, an odd last panel spans
 * the row. `panels`: [{ key, title, description, items, onViewAll }]. Must sit inside `.hm-page`.
 */
export function HomeProductPanels({ panels, idPrefix = 'hm-panel' }) {
  const list = panels.filter((panel) => panel.items?.length > 0);
  if (!list.length) return null;
  return (
    <div className="hm-product-row hm-product-grid">
      {list.map((panel) => (
        <Reveal as="section" key={panel.key} className="hm-section hm-products" aria-labelledby={`${idPrefix}-${panel.key}`}>
          <DoctorRailHeader
            id={`${idPrefix}-${panel.key}`}
            title={panel.title}
            description={panel.description}
            onViewAll={panel.onViewAll}
          />
          <HomeProductRail items={panel.items} label={panel.title} />
        </Reveal>
      ))}
    </div>
  );
}

/** Homepage "Our doctors" panel. Must sit inside `.hm-page`. */
export function HomeOurDoctors({ id = 'hm-odocs-title', items, title, description, onViewAll, onOpen }) {
  if (!items?.length) return null;
  return (
    <Reveal as="section" className="hm-section hm-panel hm-odocs" aria-labelledby={id}>
      <SectionHeader
        className="hm-head-inline"
        id={id}
        title={title}
        description={description}
        action={<ViewAll label={title} onClick={onViewAll} />}
      />
      <Rail label={title}>
        {items.map((item, index) => {
          const docId = getDoctorId(item);
          return (
            <RailItem key={docId || item.full_name}>
              <OurDoctorCard item={item} index={index} onOpen={() => onOpen(docId)} />
            </RailItem>
          );
        })}
      </Rail>
    </Reveal>
  );
}