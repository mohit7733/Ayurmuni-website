import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, ShoppingBag } from 'lucide-react';
import { buildCartSections } from '../cart/mapCart';
import { formatRupee } from '../home/catalog';
import { useCart } from '../hooks/useCart';
import useLoggedIn from '../hooks/useLoggedIn';
import '../design/components/cart-float.css';

const HIDDEN_EXACT = ['/'];
const HIDDEN_PREFIXES = [
  '/welcome',
  '/login',
  '/otp',
  '/access-mode',
  '/onboarding',
  '/assessment',
  '/patient-faq',
  '/prakriti-profile',
  '/complete-details',
  '/policy-detail',
  '/network-error',
  '/cart',
  '/checkout',
  '/order-confirmation',
  '/medicines/checkout',
  '/medicines/order-status',
  '/mentor/checkout',
  '/profile/video',
];

const matchesPrefix = (pathname, prefixes) => prefixes.some((p) => pathname.startsWith(p));

export default function CartFloat() {
  const { pathname } = useLocation();
  const loggedIn = useLoggedIn();
  const { itemCount, cartData } = useCart();

  const { total, thumbs } = useMemo(() => {
    const items = buildCartSections(cartData).flatMap((section) => section.items);
    return {
      total: items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0),
      thumbs: items.filter((item) => item.image).slice(0, 3),
    };
  }, [cartData]);

  if (
    !loggedIn ||
    itemCount <= 0 ||
    HIDDEN_EXACT.includes(pathname) ||
    matchesPrefix(pathname, HIDDEN_PREFIXES)
  ) {
    return null;
  }

  const countLabel = `${itemCount > 99 ? '99+' : itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  return (
    <div className="cart-float">
      <Link to="/cart" className="cart-float__bar" aria-label={`View cart, ${countLabel}${total ? `, ${formatRupee(total)}` : ''}`}>
        <span className="cart-float__media" aria-hidden>
          {thumbs.length ? (
            thumbs.map((item) => (
              <img key={item.id || item.variant_id} src={item.image} alt="" loading="lazy" decoding="async" />
            ))
          ) : (
            <ShoppingBag size={20} />
          )}
        </span>
        <span className="cart-float__copy" aria-hidden>
          <strong key={itemCount}>{countLabel}</strong>
          {total ? <small>{formatRupee(total)}</small> : null}
        </span>
        <span className="cart-float__cta" aria-hidden>
          View cart
          <ChevronRight size={18} />
        </span>
      </Link>
    </div>
  );
}
