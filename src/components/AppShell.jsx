import { NavLink } from 'react-router-dom';
import { House, LayoutGrid, Pill, ShoppingBag, Stethoscope } from 'lucide-react';
import { COPY } from '../content/copy';
import { useCart } from '../hooks/useCart';
import { TAB_ITEMS } from '../site/nav';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

const TAB_ICONS = {
  home: House,
  products: LayoutGrid,
  cart: ShoppingBag,
  medicines: Pill,
  consult: Stethoscope,
};

export default function AppShell({ children, tab = 'home' }) {
  const { itemCount } = useCart();
  return (
    <div className="app-shell">
      <a className="am-skip-link" href="#main">
        {COPY.skipToContent}
      </a>
      <SiteHeader />
      <main id="main" className="app-shell-body" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
      <nav className="tab-bar" aria-label="Main">
        {TAB_ITEMS.map((item) => {
          const Icon = TAB_ICONS[item.id];
          const active = tab === item.id;
          const showBadge = item.id === 'cart' && itemCount > 0;
          return (
            <NavLink
              key={item.id}
              to={item.to}
              className={`tab-item ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
              aria-label={showBadge ? `${item.label} (${itemCount})` : undefined}
            >
              <span className="tab-icon" aria-hidden>
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {showBadge ? <i className="tab-badge">{itemCount > 99 ? '99+' : itemCount}</i> : null}
              </span>
              <span className="tab-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
