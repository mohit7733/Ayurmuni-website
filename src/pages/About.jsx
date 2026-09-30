import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Button, Disclaimer } from '../components/ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

export default function About() {
  const navigate = useNavigate();

  return (
    <AppShell tab="profile">
      <section className="sx-page sx-narrow">
        <PageHeader title={T.aboutTitle} subtitle={T.aboutSubtitle} onBack={() => navigate(-1)} />
        <div className="sx-prose">
          <p>{T.aboutLead}</p>
          <div className="sx-points">
            {T.aboutPoints.map((item) => (
              <article key={item.title} className="sx-point">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <div className="sx-actions">
            <Button variant="primary" onClick={() => navigate('/home')}>
              {T.aboutCtaHome}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/consult/doctors')}>
              {T.aboutCtaConsult}
            </Button>
          </div>
        </div>
        <Disclaimer />
      </section>
    </AppShell>
  );
}
