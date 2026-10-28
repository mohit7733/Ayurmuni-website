import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Button from './Button';
import { SkeletonFor } from '../skeletons/Skeletons';
import { cx } from './cx';

const SLOW_MS = 4500;
const STALLED_MS = 12000;

/**
 * Section reloader. A shape-matched skeleton shows until the section's data arrives.
 * After a few seconds it says the response is late, and after longer it offers a retry.
 */
export default function AdvanceLoad({
  variant = 'list',
  count,
  label = 'Loading',
  slowText = 'Still waiting for this. A slow connection can take a moment.',
  stalledText = 'This still hasn’t arrived. Check your connection and try again.',
  onRetry,
  delayMs = 0,
  patience = false,
  className,
}) {
  const [visible, setVisible] = useState(delayMs <= 0);
  const [stage, setStage] = useState('loading');

  useEffect(() => {
    if (delayMs <= 0) return undefined;
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  useEffect(() => {
    if (!visible || !patience) return undefined;
    const slow = setTimeout(() => setStage('slow'), SLOW_MS);
    const stalled = setTimeout(() => setStage('stalled'), STALLED_MS);
    return () => {
      clearTimeout(slow);
      clearTimeout(stalled);
    };
  }, [visible, patience]);

  if (!visible) {
    return <div className="am-load am-load--hold" role="status" aria-label={label} />;
  }

  const retry = onRetry || (() => window.location.reload());

  return (
    <div
      className={cx('am-load', `am-load--${variant}`, stage !== 'loading' && 'is-patient', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <SkeletonFor variant={variant} count={count} label={label} />
      {patience && stage !== 'loading' ? (
        <div className="am-load__note">
          <p>{stage === 'stalled' ? stalledText : slowText}</p>
          {stage === 'stalled' ? (
            <Button variant="secondary" size="sm" leadingIcon={<RefreshCw size={14} aria-hidden />} onClick={retry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
