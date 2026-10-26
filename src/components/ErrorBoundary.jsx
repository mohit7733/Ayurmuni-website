import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

const CHUNK_RELOAD_KEY = 'am_chunk_reload_at';

export const isChunkLoadError = (error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed/i.test(
    String(error?.message || error || ''),
  );

/** Reloads once per minute at most, so a stale tab picks up the newly deployed build. */
export const reloadForNewBuild = () => {
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - last < 60_000) return false;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
  return true;
};

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (isChunkLoadError(error) && reloadForNewBuild()) return;
    if (import.meta.env.DEV) console.error(error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="sx-network" role="alert">
        <div className="sx-network__card">
          <span className="sx-network__mark">
            <AlertTriangle size={12} aria-hidden />
            {T.crashMark}
          </span>
          <h1>{T.crashTitle}</h1>
          <p>{T.crashText}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            {T.reload}
          </Button>
        </div>
      </section>
    );
  }
}
