import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Stethoscope, Upload } from 'lucide-react';
import { Button, Modal } from './ui';
import { PRODUCT_DETAIL_COPY as copy } from '../content/productDetail';
import { subscribePrescriptionRequired } from '../services/prescriptionGate';
import '../design/components/rx-gate-modal.css';

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
    <Modal
      open
      onClose={close}
      size="sm"
      title={copy.prescriptionRequired}
      className="rx-gate-modal"
      footer={
        <div className="rx-gate__actions">
          <Button
            variant="primary"
            block
            leadingIcon={<Stethoscope size={18} aria-hidden />}
            onClick={openConsult}
          >
            {copy.consultDoctor}
          </Button>
          <Button
            variant="secondary"
            block
            leadingIcon={<Upload size={18} aria-hidden />}
            onClick={openUpload}
          >
            {copy.uploadRx}
          </Button>
          <Button variant="ghost" block onClick={close}>
            {copy.notNow}
          </Button>
        </div>
      }
    >
      <div className="rx-gate">
        <div className="rx-gate__mark" aria-hidden>
          <FileText size={22} strokeWidth={1.85} />
        </div>
        {state.productName ? (
          <p className="rx-gate__product">
            <span className="rx-gate__product-label">{copy.prescriptionProduct}</span>
            <strong>{state.productName}</strong>
          </p>
        ) : null}
        <p className="rx-gate__message">{state.message}</p>
        <p className="rx-gate__hint">{copy.prescriptionHint}</p>
      </div>
    </Modal>
  );
}
