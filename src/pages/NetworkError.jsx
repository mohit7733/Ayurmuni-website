import { useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { Button } from '../components/ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

export default function NetworkError({ onGoBack }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (onGoBack) {
      onGoBack();
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate('/home');
  };

  return (
    <AuthShell>
      <section className="sx-network">
        <div className="sx-network__card">
          <span className="sx-network__mark">
            <WifiOff size={12} aria-hidden />
            {T.networkMark}
          </span>
          <h1>{T.networkTitle}</h1>
          <p>{T.networkText}</p>
          <Button variant="primary" onClick={goBack}>
            {T.goBack}
          </Button>
        </div>
      </section>
    </AuthShell>
  );
}
