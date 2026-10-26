import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { Button } from '../components/ui';
import useLoggedIn from '../hooks/useLoggedIn';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

export default function NotFound() {
  const navigate = useNavigate();
  const loggedIn = useLoggedIn();

  return (
    <AuthShell>
      <section className="sx-network">
        <div className="sx-network__card">
          <span className="sx-network__mark">
            <Compass size={12} aria-hidden />
            {T.notFoundMark}
          </span>
          <h1>{T.notFoundTitle}</h1>
          <p>{T.notFoundText}</p>
          <Button variant="primary" onClick={() => navigate(loggedIn ? '/home' : '/', { replace: true })}>
            {T.goHome}
          </Button>
        </div>
      </section>
    </AuthShell>
  );
}
