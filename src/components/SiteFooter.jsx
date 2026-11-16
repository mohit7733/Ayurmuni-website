import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Leaf, LockKeyhole, ShieldCheck } from 'lucide-react';
import logoImg from '/greenlogo.png';
import { COPY } from '../content/copy';
import useLoggedIn from '../hooks/useLoggedIn';
import { navigateToLogin } from '../services/guestAuth';
import { FOOTER_COLUMNS, FOOTER_LEGAL } from '../site/nav';

const TRUST_ICONS = {
  doctors: BadgeCheck,
  secure: LockKeyhole,
  authentic: Leaf,
  private: ShieldCheck,
};

/** Open without login. Everything else still shows, but click asks to log in. */
const PUBLIC_FOOTER_LINKS = new Set(['/about', '/contact', '/terms', '/home', '/profile/faq', '/profile/privacy', '/profile/help-center', '/profile/legal-policies']);

export default function SiteFooter() {
  const loggedIn = useLoggedIn();
  const footerRef = useRef(null);

  const onFooterLinkClick = (event, to) => {
    if (loggedIn || PUBLIC_FOOTER_LINKS.has(to)) return;
    event.preventDefault();
    navigateToLogin('Please login to continue');
  };

  // Pin the background mark so the emblem's top lines up with the CARE column's
  // CARE heading (top of the link columns). Falls back to the stacked layout when that row is absent.
  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer) return undefined;
    const inner = footer.querySelector('.site-footer-inner');
    const mark = footer.querySelector('.site-footer-mark');
    const place = () => {
      footer.classList.remove('is-mark-pinned');
      inner.style.paddingBottom = '';
      if (!window.matchMedia('(min-width: 768px)').matches) {
        // Phones: same background layer, its base resting on the bottom of the link columns.
        footer.classList.add('is-mark-pinned');
        const fTop = footer.getBoundingClientRect().top;
        const contentBottom = Math.max(
          ...[...inner.children].map((n) => n.getBoundingClientRect().bottom - fTop),
        );
        footer.style.setProperty('--mark-top', `${Math.max(350, Math.round(contentBottom - mark.offsetHeight))}px`);
        return;
      }
      const care = [...footer.querySelectorAll('.site-footer-col')].find(
        (n) => n.getAttribute('aria-label') === 'Care',
      );
      const head = care?.querySelector('h2');
      if (!head) return;
      footer.classList.add('is-mark-pinned');
      const fTop = footer.getBoundingClientRect().top;
      const top = head.getBoundingClientRect().top - fTop;
      footer.style.setProperty('--mark-top', `${Math.max(350, Math.round(top))}px`);
      const markBottom = top + mark.offsetHeight;
      // Lowest real content in the grid (ignores the inner's own padding).
      const contentBottom = Math.max(
        ...[...inner.children].map((n) => n.getBoundingClientRect().bottom - fTop),
      );
      const innerTop = inner.getBoundingClientRect().top - fTop;
      const padTop = parseFloat(getComputedStyle(inner).paddingTop) || 0;
      const target = Math.max(markBottom, contentBottom) + 2;
      // Bottom padding so the © row starts just below whichever ends lower.
      const contentHeight = contentBottom - innerTop - padTop;
      inner.style.paddingBottom = `${Math.max(0, Math.ceil(target - innerTop - padTop - contentHeight))}px`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(footer.querySelector('.site-footer-trust'));
    window.addEventListener('resize', place);
    document.fonts?.ready.then(place);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [loggedIn]);

  return (
    <footer className="site-footer" ref={footerRef}>
      <ul className="site-footer-trust" aria-label="Why Ayurmuni">
        {COPY.trust.map((item) => {
          const Icon = TRUST_ICONS[item.id];
          return (
            <li key={item.id}>
              <Icon size={22} aria-hidden />
              <div>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </div>
            </li>
          );
        })}
      </ul>


      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <img src={logoImg} alt="Ayurmuni" width="208" height="52" loading="lazy" />
          <p className="site-footer-tagline">{COPY.brandTagline}</p>
          <p>{COPY.brandMission}</p>
          <div className="site-footer-app-store-links">
            <ul className='site-footer-app-store-links-list'>
              {/* <li>
                <a href="https://www.facebook.com/ayurmuni" target="_blank" rel="noopener noreferrer"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 2H15C13.6739 2 13 2.67392 13 4V7H11V4C11 2.67392 10.3261 2 9 2H6C4.34315 2 3 3.34315 3 5V19C3 20.6569 4.34315 22 6 22H18C19.6569 22 21 20.6569 21 19V5C21 3.34315 19.6569 2 18 2Z" fill="currentColor"/></svg></a>
              </li> */}
              <li>
                <a href="https://www.instagram.com/ayurmuniofficial?igsh=NjZ1MHJ0cXVvNndo" target="_blank" rel="noopener noreferrer"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-instagram h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line></svg></a>
              </li>
              <li>
                <a href="https://www.linkedin.com/company/ayurmuni" target="_blank" rel="noopener noreferrer"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-linkedin h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect width="4" height="12" x="2" y="9"></rect><circle cx="4" cy="4" r="2"></circle></svg></a>
              </li>
              {/* <li>
                <a href="https://www.twitter.com/ayurmuni" target="_blank" rel="noopener noreferrer">Twitter</a>
              </li>
              <li>
                <a href="https://www.youtube.com/channel/UC_x-mryoa1Gqygz36q3_Brw" target="_blank" rel="noopener noreferrer">YouTube</a>
              </li> */}
            </ul>
          </div>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.title} className="site-footer-col" aria-label={column.title}>
            <h2>{column.title}</h2>
            <ul>
              {column.links.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} onClick={(event) => onFooterLinkClick(event, item.to)}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="site-footer-app-store">
          <h2>Download the Ayurmuni app</h2>
          <a href="https://play.google.com/store/apps/details?id=com.ayurmuniecosystem" target="_blank" rel="noopener noreferrer"><img src="public/images/playstore.avif" alt="App Store" className='' style={{ width: '150px' }} /></a>

        </div>
      </div>


      {/* Original footer mark, now a background layer (adds no height). */}
      <div className="site-footer-mark" aria-hidden="true">
        <img alt="" src="https://ayurmuni.com/assets/logoround-CDmnakog.png" />
        <span>AYURMUNI</span>
      </div>

      <div className="site-footer-bar site-footer-bar-legal">
        <div className="site-footer-legal">
          <span>© {new Date().getFullYear()} Ayurmuni. All rights reserved.</span>
          <nav aria-label="Legal">
            {FOOTER_LEGAL.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={(event) => onFooterLinkClick(event, item.to)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

      </div>
    </footer>
  );
}
