import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Questionnaire from './Questionnaire';
import { requireAuth } from '../services/guestAuth';

export default function PatientFAQ() {
  const navigate = useNavigate();
  const location = useLocation();
  const allowIncompleteProfile = Boolean(location.state?.allowIncompleteProfile);
  const [accessChecked, setAccessChecked] = useState(allowIncompleteProfile);

  useEffect(() => {
    if (allowIncompleteProfile) {
      setAccessChecked(true);
      return undefined;
    }
    let alive = true;
    (async () => {
      const ok = await requireAuth('Complete your profile to start prakriti assessment');
      if (!alive) return;
      if (!ok) {
        if (window.history.length > 1) navigate(-1);
        else navigate('/home');
        return;
      }
      setAccessChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, [allowIncompleteProfile, navigate]);

  if (!accessChecked) {
    return <div className="quest-loader">Checking access…</div>;
  }

  return <Questionnaire mode="prakriti" />;
}
