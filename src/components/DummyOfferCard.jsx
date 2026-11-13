import { useState } from 'react';
import { Check, Leaf } from 'lucide-react';
import { formatRupee } from '../home/catalog';
import { formatPlanMoney, planCta, planDiscount, planDuration } from '../packages/planTheme';
import '../design/pages/packages-premium.css';

const textList = (value) =>
  Array.isArray(value) ? value.map((line) => String(line || '').trim()).filter(Boolean) : [];

const amount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Mapped catalog plan, or the raw packages/plans row. */
const readOfferPlan = (item = {}) => {
  const fees = item.fees && typeof item.fees === 'object' ? item.fees : {};
  const includes = textList(item.includes?.length ? item.includes : item.benefits?.includes);
  const price = amount(item.price ?? fees.selling_price ?? fees.selling ?? item.selling_price);
  const mrp = amount(item.mrp ?? item.original_price);
  return {
    ...item,
    name: String(item.name || 'Plan').trim() || 'Plan',
    group: String(item.group || item.category_name || 'Plan').trim() || 'Plan',
    categoryCode: String(item.categoryCode || item.category_code || '').trim(),
    image: String(item.image || item.image_url || '').trim(),
    description: String(item.description || '').trim(),
    includes,
    price,
    mrp,
    validityDays: amount(item.validityDays || item.validity_days),
    purchaseType: String(item.purchaseType || item.purchase_type || '').trim(),
    canBePurchased: item.canBePurchased ?? item.can_be_purchased,
    buttonAction: String(item.buttonAction || item.button_action || '').trim(),
    billingMode: String(item.billingMode || item.billing_mode || 'one_time'),
    billingPeriod: String(item.billingPeriod || item.billing_period || '').trim(),
    billingInterval: amount(item.billingInterval ?? item.billing_interval) || 1,
    purchased: Boolean(item.purchased),
  };
};

const CTA = {
  package: 'Buy plan',
  lab: 'Book',
  therapy: 'Book',
};

export default function DummyOfferCard({ item, kind = 'lab', onClick, cta }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = String(item.image || item.image_url || '').trim();
  const showImage = Boolean(image) && !imageFailed;
  const off =
    item.mrp && item.mrp > item.price
      ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
      : 0;
  const badge = item.badge || item.tag;
  const extra =
    Array.isArray(item.includes) && item.includes.length > 1
      ? ` · +${item.includes.length - 1}`
      : '';
  const meta =
    kind === 'package'
      ? `${item.includes?.[0] || ''}${extra}`
      : kind === 'therapy'
        ? item.description
        : item.tests;
  const group = kind === 'therapy' ? item.duration : item.group;
  const flags = (
    <>
      {badge ? <span className="do-card__badge">{badge}</span> : null}
      {off > 0 ? <span className="do-card__off">{off}% OFF</span> : null}
    </>
  );

  if (kind === 'package') {
    const plan = readOfferPlan(item);
    const discount = planDiscount(plan);
    const owned = Boolean(plan.purchased);
    const lines = plan.includes.slice(0, 2);
    const more = Math.max(0, plan.includes.length - lines.length);
    const saving = plan.mrp > plan.price ? plan.mrp - plan.price : 0;
    const banner = Boolean(plan.image) && !imageFailed;

    return (
      <button type="button" className="pp-rail" onClick={onClick} aria-label={plan.name}>
        <span className="pp-rail__banner" aria-hidden>
          {banner ? (
            <img
              src={plan.image}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="pp-rail__fall">
              <Leaf size={26} strokeWidth={1.5} />
              <span>AyurMuni Care</span>
            </span>
          )}
          <span className="pp-rail__shade" />
          <span className="pp-rail__flags">
            <span className="pp-rail__cat">{plan.group}</span>
            {discount > 0 ? <span className="pp-rail__off">{discount}% OFF</span> : null}
          </span>
        </span>

        <span className="pp-rail__body">
          <span className="pp-rail__name">{plan.name}</span>
          <span className="pp-rail__dur">{planDuration(plan)}</span>
          {lines.length ? (
            <ul className="pp-rail__benefits">
              {lines.map((line, index) => (
                <li key={`${line}-${index}`}>
                  <Check size={11} strokeWidth={3} aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
              {more > 0 ? <li className="pp-rail__more">+{more} more benefits</li> : null}
            </ul>
          ) : (
            <p className="pp-rail__blurb">
              {plan.description || 'Personalised Ayurvedic care with expert guidance.'}
            </p>
          )}
        </span>

        <span className="pp-rail__priceblock">
          <span className="pp-rail__price">
            <strong>{formatPlanMoney(plan.price)}</strong>
            {plan.mrp > plan.price ? <s>{formatPlanMoney(plan.mrp)}</s> : null}
          </span>
          {saving > 0 ? <span className="pp-rail__save">Save {formatPlanMoney(saving)}</span> : null}
        </span>

        <span className="pp-rail__cta">{cta || planCta(plan, { owned, rail: true })}</span>
      </button>
    );
  }

  return (
    <article className={`do-card do-card--${kind}${showImage ? '' : ' do-card--no-media'}`}>
      <button type="button" className="do-card__hit" onClick={onClick} aria-label={item.name}>
        {showImage ? (
          <div className="do-card__img">
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
            {flags}
          </div>
        ) : badge || off > 0 ? (
          <div className="do-card__flags">{flags}</div>
        ) : (
          <span className="do-card__rule" aria-hidden />
        )}
        {group ? <p className="do-card__group">{group}</p> : null}
        <h3>{item.name}</h3>
        {meta ? <p className="do-card__meta">{meta}</p> : null}
        <p className="do-card__price">
          <strong>{formatRupee(item.price)}</strong>
          {item.mrp && item.mrp > item.price ? <s>{formatRupee(item.mrp)}</s> : null}
        </p>
      </button>
      <button type="button" className="do-card__book" onClick={onClick}>
        {cta || CTA[kind] || 'Book'}
      </button>
    </article>
  );
}
