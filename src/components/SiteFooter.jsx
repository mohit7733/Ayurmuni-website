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

  return (
    <footer className="site-footer">
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

      <div className="site-footer-bar">
        <p className="site-footer-disclaimer">{COPY.healthDisclaimerLong}</p>
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
