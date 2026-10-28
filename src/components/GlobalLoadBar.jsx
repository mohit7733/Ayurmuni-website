import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import LogoSpinner from './ui/LogoSpinner';
import { subscribeRequests } from '../loading/requestActivity';

const SHOW_MS = 280;
const SLOW_MS = 5000;
const STALLED_MS = 12000;

export default function GlobalLoadBar() {
  const [inflight, setInflight] = useState(0);
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState('loading');

  useEffect(() => subscribeRequests(setInflight), []);

  useEffect(() => {
    if (inflight <= 0) {
      setVisible(false);
      setStage('loading');
      return undefined;
    }
    const show = setTimeout(() => setVisible(true), SHOW_MS);
    const slow = setTimeout(() => setStage((current) => (current === 'stalled' ? current : 'slow')), SLOW_MS);
    const stalled = setTimeout(() => setStage('stalled'), STALLED_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(slow);
      clearTimeout(stalled);
    };
  }, [inflight]);

  if (!visible || inflight <= 0 || stage === 'loading') return null;

  const message =
    stage === 'stalled'
      ? 'This is taking longer than usual.'
      : 'Still loading your data…';

  return (
    <div className={`am-loadbar is-${stage}`} role="status" aria-live="polite">
      <div className="am-loadbar__note">
        <LogoSpinner scale="micro" label={message} />
        <p>{message}</p>
        {stage === 'stalled' ? (
          <button type="button" onClick={() => window.location.reload()}>
            <RefreshCw size={14} aria-hidden />
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
