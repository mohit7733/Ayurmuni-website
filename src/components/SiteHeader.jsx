import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { Images } from '../common/images';
import { Utils } from '../common/utils';
import { useCart } from '../hooks/useCart';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { requireAuth } from '../services/guestAuth';
import { PRIMARY_NAV } from '../site/nav';
import IconButton from './ui/IconButton';

function ProgressRing({ progress, children }) {
  const clamped = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <span className="progress-ring" style={{ '--am-progress': `${clamped * 3.6}deg` }}>
      <span className="progress-ring-inner">{children}</span>
    </span>
  );
}

export default function SiteHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { itemCount } = useCart();
  const { unreadCount } = useUnreadNotificationCount();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const info = await Utils.getData('_USER_INFO');
      if (alive) setUser(info || null);
    })();
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const prakritiProgress = Math.round(Number(user?.prakriti_progress) || 0);
  const prakritiComplete = prakritiProgress >= 100;
  const firstLetter = String(user?.first_name || 'G')
    .trim()
    .charAt(0)
    .toUpperCase();

  const openPrakriti = async () => {
    if (prakritiComplete) {
      navigate('/prakriti-profile');
      return;
    }
    if (!(await requireAuth('Complete your profile to start prakriti assessment'))) return;
    navigate('/patient-faq', { state: { allowBack: true } });
  };

  const navClass = ({ isActive }) => `site-nav-link ${isActive ? 'active' : ''}`;

  return (
    <header className={`site-header ${menuOpen ? 'is-menu-open' : ''}`}>
      <div className="site-header-inner">
        <Link to="/home" className="site-brand" aria-label="Ayurmuni home">
          <img src={Images.FinalLogo2} alt="Ayurmuni" width="176" height="44" />
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="site-header-actions">
          <IconButton label="Search" variant="ghost" onClick={() => navigate('/search')}>
            <Search size={20} aria-hidden />
          </IconButton>
          <IconButton
            label="Cart"
            variant="ghost"
            className="site-cart-btn"
            badge={itemCount}
            onClick={() => navigate('/cart')}
          >
            <ShoppingBag size={20} aria-hidden />
          </IconButton>
          <IconButton
            label="Notifications"
            variant="ghost"
            badge={unreadCount}
            onClick={async () => {
              if (await requireAuth('Please login to view notifications')) {
                navigate('/notifications');
              }
            }}
          >
            <Bell size={20} aria-hidden />
          </IconButton>
          <NavLink to="/profile" className="site-profile-link" aria-label="Profile">
            <UserRound size={20} aria-hidden />
            <span>Profile</span>
          </NavLink>
          <button
            type="button"
            className="progress-ring-btn"
            aria-label={
              prakritiComplete
                ? 'View your prakriti profile'
                : `Prakriti assessment ${prakritiProgress}% complete — continue`
            }
            onClick={openPrakriti}
          >
            <ProgressRing progress={prakritiProgress}>
              {user?.profile_picture ? <img src={user.profile_picture} alt="" /> : <span>{firstLetter}</span>}
            </ProgressRing>
          </button>
          <IconButton
            label={menuOpen ? 'Close menu' : 'Open menu'}
            variant="ghost"
            className="site-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="site-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </IconButton>
        </div>
      </div>

      <nav id="site-mobile-nav" className="site-nav-mobile" aria-label="Mobile" hidden={!menuOpen}>
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={navClass}>
            {item.label}
          </NavLink>
        ))}
        <NavLink to="/profile" className={navClass}>
          Profile
        </NavLink>
      </nav>
    </header>
  );
}
