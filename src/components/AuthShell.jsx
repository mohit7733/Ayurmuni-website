import { COPY } from '../content/copy';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

export default function AuthShell({
  children,
  hideFooter = false,
  welcomeMode = hideFooter,
}) {
  return (
    <div
      className={`app-shell auth-shell ${welcomeMode ? 'auth-shell--welcome' : ''}`}
    >
      <a className="am-skip-link" href="#main">
        {COPY.skipToContent}
      </a>
      <SiteHeader />
      <main id="main" className="app-shell-body" tabIndex={-1}>
        {children}
      </main>
      {hideFooter ? null : <SiteFooter />}
    </div>
  );
}
