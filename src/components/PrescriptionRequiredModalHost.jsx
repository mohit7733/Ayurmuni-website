import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribePrescriptionRequired } from '../services/prescriptionGate';
import { Button, Modal } from './ui';
import '../design/components/prescription-gate.css';

export default function PrescriptionRequiredModalHost() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);

  useEffect(() => subscribePrescriptionRequired(setState), []);

  const close = () => setState(null);

  const openConsult = () => {
    setState(null);
    navigate('/consult/doctors');
  };

  const openUpload = () => {
    const variantId = state?.variantId;
    const productName = state?.productName;
    setState(null);
    const params = new URLSearchParams();
    if (variantId) params.set('variant', variantId);
    if (productName) params.set('name', productName);
    const query = params.toString();
    navigate(`/medicines/prescription${query ? `?${query}` : ''}`, {
      state: {
        variantIds: variantId ? [variantId] : [],
        productName,
        fromPrescriptionGate: true,
      },
    });
  };

  const message =
    state?.message ||
    'This medicine needs a valid prescription before it can be added to cart.';

  return (
    <Modal
      open={Boolean(state)}
      onClose={close}
      title="Prescription required"
      description={state?.productName || undefined}
      className="rx-gate-modal"
      footer={
        <div className="rx-gate-actions">
          <Button variant="primary" onClick={openConsult}>
            Consult a doctor
          </Button>
          <Button variant="secondary" onClick={openUpload}>
            Upload prescription
          </Button>
          <Button variant="ghost" onClick={close}>
            Not now
          </Button>
        </div>
      }
    >
      <p className="rx-gate-message">{message}</p>
    </Modal>
  );
}
