import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell,
  Check,
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import logoImg from '/greenlogo.png';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import { useLocation as useDeliveryLocation } from '../context/LocationContext';
import { useCart } from '../hooks/useCart';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import useLoggedIn from '../hooks/useLoggedIn';
import { requireAuth } from '../services/guestAuth';
import { savedAddressToParsed } from '../services/locationService';
import { getAddresses, listAddresses, updateAddress } from '../services/profileService';
import { PRIMARY_NAV } from '../site/nav';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import { cx } from './ui/cx';

function placeName(item) {
  return item?.city || item?.address_type_name || item?.address_line_1 || 'Saved address';
}

function headerPlace({ defaultAddress, deliveryLocation, loadingLocation, locationEnabled, currentAddress }) {
  if (defaultAddress?.city) return defaultAddress.city;
  if (deliveryLocation?.city) return deliveryLocation.city;
  if (loadingLocation) return 'Detecting…';
  if (locationEnabled && currentAddress?.city) return currentAddress.city;
  if (defaultAddress) return placeName(defaultAddress);
  return 'Select';
}

function Avatar({ user, letter }) {
  if (user?.profile_picture) {
    return <img className="site-avatar-img" src={user.profile_picture} alt="" />;
  }
  return <span className="site-avatar-fallback">{letter}</span>;
}

export default function SiteHeader({ minimal = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const loggedIn = useLoggedIn();
  const { itemCount } = useCart();
  const { unreadCount } = useUnreadNotificationCount();
  const {
    currentAddress,
    deliveryLocation,
    loadingLocation,
    locationEnabled,
    setDeliveryLocation,
    clearLocationSession,
  } = useDeliveryLocation();

  const menuId = useId();
  const menuBtnRef = useRef(null);
  const panelRef = useRef(null);
  const headerRef = useRef(null);
  const searchInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState(params.get('q') || '');
  const [searchOpen, setSearchOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);

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
    setSearchOpen(false);
    setLocationOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === '/search') {
      setQuery(params.get('q') || '');
    }
  }, [location.pathname, params]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!searchOpen) return undefined;
    searchInputRef.current?.focus();
    return undefined;
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen && !locationOpen && !userOpen) return undefined;
    const onDown = (event) => {
      if (!headerRef.current?.contains(event.target)) {
        setSearchOpen(false);
        setLocationOpen(false);
        setUserOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setSearchOpen(false);
      setLocationOpen(false);
      setUserOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [searchOpen, locationOpen, userOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.activeElement;
    document.body.classList.add('am-scroll-locked');

    const panel = panelRef.current;
    const focusables = () =>
      panel
        ? Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input'))
        : [];
    const items = focusables();
    items[0]?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('am-scroll-locked');
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement) previous.focus();
      else menuBtnRef.current?.focus();
    };
  }, [menuOpen]);

  const prakritiProgress = Math.round(Number(user?.prakriti_progress) || 0);
  const prakritiComplete = prakritiProgress >= 100;
  const firstLetter = String(user?.first_name || 'G')
    .trim()
    .charAt(0)
    .toUpperCase();
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  const email = String(user?.email || '').trim();

  const defaultAddress = savedAddresses.find((item) => item?.is_default) || savedAddresses[0] || null;
  const locationLabel = headerPlace({
    defaultAddress,
    deliveryLocation,
    loadingLocation,
    locationEnabled,
    currentAddress,
  });

  const loadAddresses = async () => {
    try {
      const res = await getAddresses();
      if (res?.success !== false) setSavedAddresses(listAddresses(res));
    } catch {
      setSavedAddresses([]);
    }
  };

  const toggleLocation = () => {
    setUserOpen(false);
    setSearchOpen(false);
    setMenuOpen(false);
    setLocationOpen((open) => {
      const next = !open;
      if (next) loadAddresses();
      return next;
    });
  };

  const selectSavedAddress = async (item) => {
    await setDeliveryLocation(savedAddressToParsed(item));
    if (!item?.is_default && item?.id) {
      await updateAddress(item.id, { is_default: true });
      setSavedAddresses((list) =>
        list.map((entry) => ({ ...entry, is_default: entry?.id === item.id })),
      );
    }
    setLocationOpen(false);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const next = query.trim();
    setSearchOpen(false);
    setMenuOpen(false);
    navigate(next ? `/search?q=${encodeURIComponent(next)}` : '/search');
  };

  const signOut = async () => {
    setUserOpen(false);
    await clearLocationSession();
    await Utils.clearAllData();
    showSuccessToast('Signed out successfully', 'success');
    navigate('/welcome', { replace: true });
  };

  const navClass = ({ isActive }) => cx('site-nav-link', isActive && 'active');

  if (minimal) {
    return (
      <header className={cx('site-header', 'is-minimal', scrolled && 'is-scrolled')}>
        <div className="site-header-inner">
          <Link to="/welcome" className="site-brand" aria-label="Ayurmuni home">
            <img src={logoImg} alt="" width="176" height="44" />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header
      ref={headerRef}
      className={cx(
        'site-header',
        menuOpen && 'is-menu-open',
        scrolled && 'is-scrolled',
        searchOpen && 'is-search-open',
      )}
    >
      <div className="site-header-inner">
        <IconButton
          ref={menuBtnRef}
          label={menuOpen ? 'Close menu' : 'Open menu'}
          variant="ghost"
          className="site-menu-btn"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => {
            setSearchOpen(false);
            setLocationOpen(false);
            setUserOpen(false);
            setMenuOpen((open) => !open);
          }}
        >
          {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </IconButton>

        <Link to={loggedIn ? '/home' : '/welcome'} className="site-brand" aria-label="Ayurmuni home">
          <img src={logoImg} alt="" width="176" height="44" />
        </Link>

        <div className="site-header-center">
          <nav className="site-nav" aria-label="Primary">
            {PRIMARY_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/home'} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <form className="site-search site-search--bar" role="search" onSubmit={submitSearch}>
            <Search size={18} aria-hidden className="site-search-icon" />
            <input
              ref={searchInputRef}
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search doctors, medicines, products, yoga and more…"
              autoComplete="off"
              enterKeyHint="search"
              aria-label="Search doctors, medicines, products, yoga and more"
            />
            <button type="submit" className="site-search-submit">
              Search
            </button>
          </form>
        </div>

        <div className="site-header-actions">
          {loggedIn ? (
            <div className={cx('site-location-wrap', locationOpen && 'is-open')}>
              <button
                type="button"
                className="site-location"
                aria-expanded={locationOpen}
                aria-haspopup="listbox"
                onClick={toggleLocation}
              >
                <MapPin size={16} aria-hidden />
                <span className="site-location-copy">
                  <small>Deliver to</small>
                  <strong>{locationLabel}</strong>
                </span>
                <ChevronDown size={14} aria-hidden />
              </button>
              {locationOpen ? (
                <div className="site-popover site-location-menu" role="listbox" aria-label="Deliver to">
                  <p className="site-popover-label">Deliver to</p>
                  {savedAddresses.length ? (
                    savedAddresses.slice(0, 6).map((item) => {
                      const selected = Boolean(item?.is_default);
                      return (
                        <button
                          key={item.id || placeName(item)}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={cx('site-menu-row', selected && 'is-selected')}
                          onClick={() => selectSavedAddress(item)}
                        >
                          <MapPin size={16} aria-hidden />
                          <span>{placeName(item)}</span>
                          {selected ? <Check size={16} aria-hidden /> : null}
                        </button>
                      );
                    })
                  ) : (
                    <p className="site-menu-empty">No saved addresses yet</p>
                  )}
                  <Link
                    className="site-menu-manage"
                    to="/profile/addresses"
                    onClick={() => setLocationOpen(false)}
                  >
                    Manage addresses
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          <IconButton
            label={searchOpen ? 'Close search' : 'Search'}
            variant="ghost"
            className="site-search-btn"
            pressed={searchOpen}
            onClick={() => {
              setLocationOpen(false);
              setUserOpen(false);
              setMenuOpen(false);
              setSearchOpen((open) => !open);
            }}
          >
            {searchOpen ? <X size={20} aria-hidden /> : <Search size={20} aria-hidden />}
          </IconButton>

          {loggedIn ? (
            <>
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
              <div className={cx('site-account-wrap', userOpen && 'is-open')}>
                <button
                  type="button"
                  className="site-account"
                  aria-expanded={userOpen}
                  aria-haspopup="menu"
                  aria-label={displayName ? `Account menu, ${displayName}` : 'Account menu'}
                  onClick={() => {
                    setLocationOpen(false);
                    setSearchOpen(false);
                    setUserOpen((open) => !open);
                  }}
                >
                  <span className="site-avatar">
                    <Avatar user={user} letter={firstLetter} />
                  </span>
                  <ChevronDown size={14} aria-hidden className="site-account-chev" />
                </button>
                {userOpen ? (
                  <div className="site-popover site-user-menu" role="menu">
                    <Link to="/profile" className="site-user-menu__head" onClick={() => setUserOpen(false)}>
                      <span className="site-avatar">
                        <Avatar user={user} letter={firstLetter} />
                      </span>
                      <span>
                        <strong>{displayName || 'Member'}</strong>
                        {email ? <small>{email}</small> : null}
                      </span>
                    </Link>
                    <Link className="site-menu-row" to="/profile/orders" onClick={() => setUserOpen(false)}>
                      <ShoppingBag size={16} aria-hidden />
                      My Orders
                    </Link>
                    <Link className="site-menu-row" to="/profile/appointments" onClick={() => setUserOpen(false)}>
                      <Stethoscope size={16} aria-hidden />
                      My Consultations
                    </Link>
                    <Link
                      className="site-menu-row"
                      to={prakritiComplete ? '/prakriti-profile' : '/patient-faq'}
                      state={prakritiComplete ? undefined : { allowBack: true }}
                      onClick={() => setUserOpen(false)}
                    >
                      <Sparkles size={16} aria-hidden />
                      My Prakriti
                    </Link>
                    <Link className="site-menu-row" to="/profile/settings" onClick={() => setUserOpen(false)}>
                      <Settings size={16} aria-hidden />
                      Settings
                    </Link>
                    <button type="button" className="site-menu-row site-menu-row--danger" onClick={signOut}>
                      <LogOut size={16} aria-hidden />
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <Button to="/login" size="sm" className="site-signin">
              Sign in
            </Button>
          )}
        </div>
      </div>

      {menuOpen ? (
        <button
          type="button"
          className="site-nav-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div
        id={menuId}
        ref={panelRef}
        className="site-nav-panel"
        hidden={!menuOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="site-drawer-head">
          <img src={logoImg} alt="" width="140" height="36" />
          <button type="button" className="site-drawer-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <X size={20} aria-hidden />
          </button>
        </div>
        <nav className="site-nav-mobile" aria-label="Mobile">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/home'} className={navClass}>
              {item.label}
            </NavLink>
          ))}
          {loggedIn ? null : (
            <NavLink to="/login" className={navClass}>
              Sign in
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
