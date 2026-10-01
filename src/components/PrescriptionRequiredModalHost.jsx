import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribePrescriptionRequired } from '../services/prescriptionGate';

export default function PrescriptionRequiredModalHost() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);

  useEffect(() => subscribePrescriptionRequired(setState), []);

  if (!state) return null;

  const close = () => setState(null);

  const openConsult = () => {
    setState(null);
    navigate('/consult/doctors');
  };

  const openUpload = () => {
    const variantId = state.variantId;
    const productName = state.productName;
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

  return (
    <div className="web-modal" role="dialog" onClick={close}>
      <div className="web-modal-card" onClick={(event) => event.stopPropagation()}>
        <h3>Prescription required</h3>
        {state.productName ? <p className="muted">{state.productName}</p> : null}
        <p>{state.message}</p>
        <div className="detail-cta">
          <button type="button" className="cta" onClick={openConsult}>
            Consult a doctor
          </button>
          <button type="button" className="ghost" onClick={openUpload}>
            Upload prescription
          </button>
          <button type="button" className="ghost" onClick={close}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
