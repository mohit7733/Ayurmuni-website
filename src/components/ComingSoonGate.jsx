import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Modal } from './ui';
import { isComingSoonMode, isComingSoonPath } from '../launch/comingSoonMode';

/**
 * Temporary: when VITE_COMING_SOON is on, intercept non-consult feature routes
 * and show a modal instead of opening the page. Safe to delete later.
 */
export default function ComingSoonGate() {
  const enabled = isComingSoonMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const lastAllowedRef = useRef('/home');

  useLayoutEffect(() => {
    if (!enabled) return;

    if (!isComingSoonPath(location.pathname)) {
      lastAllowedRef.current = `${location.pathname}${location.search}${location.hash}`;
      return;
    }

    setOpen(true);
    const fallback = lastAllowedRef.current || '/home';
    navigate(fallback, { replace: true });
  }, [enabled, location.pathname, location.search, location.hash, navigate]);

  if (!enabled) return null;

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Coming soon"
      description="Doctor consultations are live. Medicines, products, diet, yoga, and more wellness features are on the way — thank you for your patience."
      size="sm"
      footer={
        <Button type="button" variant="primary" block onClick={() => setOpen(false)}>
          Got it
        </Button>
      }
    />
  );
}
