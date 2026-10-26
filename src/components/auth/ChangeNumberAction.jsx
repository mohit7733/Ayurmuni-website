import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { Utils } from '../../common/utils';
import { useLocation as useDeliveryLocation } from '../../context/LocationContext';
import { logoutOneSignalUser } from '../../services/pushNotificationService';
import { Button, Modal } from '../ui';
import { AUTH_COPY as T } from '../../content/auth';

/** App signOutToChangeNumber (CompleteDetails / Onboarding / AccessMode): confirm, sign out, back to login. */
export default function ChangeNumberAction({ disabled = false }) {
  const navigate = useNavigate();
  const { clearLocationSession } = useDeliveryLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setOpen(false);
    try {
      try {
        await clearLocationSession();
      } catch {
        // Session storage still has to clear.
      }
      logoutOneSignalUser();
      await Utils.clearAllData();
      navigate('/welcome', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        block
        disabled={disabled || busy}
        loading={busy}
        leadingIcon={busy ? null : <Phone size={15} aria-hidden />}
        onClick={() => setOpen(true)}
      >
        {T.changeNumber}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={T.changeNumberTitle}
        description={T.changeNumberText}
        footer={
          <>
            <Button variant="primary" onClick={confirm} disabled={busy}>
              {T.changeSignOut}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              {T.changeStay}
            </Button>
          </>
        }
      />
    </>
  );
}
