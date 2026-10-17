import { ArrowRight, Check, Leaf, Sparkles, Stethoscope } from 'lucide-react';
import { Button } from './ui';
import '../design/pages/brand-band.css';

const BANNER = '/images/ayurmuniBrandBannerTransparent.png';

const POINTS = ['Online consultation', 'Certified medicines', 'Same-day delivery'];

export default function AyurmuniBrandShade({ onConsult, onShop }) {
  return (
    <section className="am-brand-band" aria-labelledby="am-brand-band-title">
      <div className="am-brand-band__copy">
        <p className="am-brand-band__eyebrow">
          <Sparkles size={15} aria-hidden /> ONE APP · EVERY RITUAL
        </p>
        <h2 id="am-brand-band-title">
          Your complete personalised <em>Ayurvedic ecosystem.</em>
        </h2>
        <p>
          Doctors, authentic medicines, diet, yoga and therapies — all planned around your
          prakriti, in one place.
        </p>
        <ul className="am-brand-band__points">
          {POINTS.map((label) => (
            <li key={label}>
              <Check size={15} aria-hidden /> {label}
            </li>
          ))}
        </ul>
        {onConsult || onShop ? (
          <div className="am-brand-band__actions">
            {onConsult ? (
              <Button
                variant="accent"
                size="lg"
                className="am-brand-band__primary"
                onClick={onConsult}
                leadingIcon={<Stethoscope size={16} aria-hidden />}
                trailingIcon={<ArrowRight size={16} aria-hidden />}
              >
                Consult a doctor
              </Button>
            ) : null}
            {onShop ? (
              <Button
                variant="secondary"
                size="lg"
                className="am-brand-band__ghost"
                onClick={onShop}
                leadingIcon={<Leaf size={16} aria-hidden />}
              >
                Shop medicines
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <figure className="am-brand-band__art">
        <img src={BANNER} alt="" loading="lazy" decoding="async" />
      </figure>
    </section>
  );
}
