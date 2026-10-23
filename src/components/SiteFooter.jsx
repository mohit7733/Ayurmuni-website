import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Leaf, LockKeyhole, ShieldCheck } from 'lucide-react';
import logoImg from '/greenlogo.png';
import { COPY } from '../content/copy';
import useLoggedIn from '../hooks/useLoggedIn';
import { FOOTER_COLUMNS, FOOTER_LEGAL } from '../site/nav';

const TRUST_ICONS = {
  doctors: BadgeCheck,
  secure: LockKeyhole,
  authentic: Leaf,
  private: ShieldCheck,
};

const PUBLIC_FOOTER_LINKS = new Set(['/about', '/contact', '/terms']);

export default function SiteFooter() {
  const loggedIn = useLoggedIn();
  const columns = loggedIn
    ? FOOTER_COLUMNS
    : FOOTER_COLUMNS.map((column) => ({
        ...column,
        links: column.links.filter((item) => PUBLIC_FOOTER_LINKS.has(item.to)),
      })).filter((column) => column.links.length > 0);
  const legal = loggedIn
    ? FOOTER_LEGAL
    : FOOTER_LEGAL.filter((item) => PUBLIC_FOOTER_LINKS.has(item.to));

  const footerRef = useRef(null);

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
      if (!window.matchMedia('(min-width: 768px)').matches) return;
      const care = [...footer.querySelectorAll('.site-footer-col')].find(
        (n) => n.getAttribute('aria-label') === 'Care',
      );
      const head = care?.querySelector('h2');
      if (!head) return;
      footer.classList.add('is-mark-pinned');
      const fTop = footer.getBoundingClientRect().top;
      const top = head.getBoundingClientRect().top - fTop;
      footer.style.setProperty('--mark-top', `${Math.round(top)}px`);
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
        </div>
        {columns.map((column) => (
          <nav key={column.title} className="site-footer-col" aria-label={column.title}>
            <h2>{column.title}</h2>
            <ul>
              {column.links.map((item) => (
                <li key={item.to}>
                  <Link to={item.to}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Original footer mark, now a background layer (adds no height). */}
      <div className="site-footer-mark" aria-hidden="true">
        <img alt="" src="https://ayurmuni.com/assets/logoround-CDmnakog.png" />
        <span>AYURMUNI</span>
      </div>

      <div className="site-footer-bar">
        <div className="site-footer-legal">
          <span>© {new Date().getFullYear()} Ayurmuni. All rights reserved.</span>
          <nav aria-label="Legal">
            {legal.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
