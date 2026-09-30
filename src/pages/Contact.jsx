import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Button, Disclaimer } from '../components/ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

export default function Contact() {
  const navigate = useNavigate();

  return (
    <AppShell tab="profile">
      <section className="sx-page sx-narrow">
        <PageHeader title={T.contactTitle} subtitle={T.contactSubtitle} onBack={() => navigate(-1)} />
        <div className="sx-prose">
          <p>{T.contactLead}</p>
          <div className="sx-contact-block">
            <small>{T.contactEmailLabel}</small>
            <a href={T.contactEmailHref}>{T.contactEmail}</a>
          </div>
          <div className="sx-actions">
            <Button
              variant="primary"
              href={T.contactEmailHref}
              leadingIcon={<Mail size={18} aria-hidden />}
            >
              {T.faqEmail}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/profile/faq')}>
              {T.contactFaq}
            </Button>
          </div>
          <p>{T.contactNote}</p>
        </div>
        <Disclaimer />
      </section>
    </AppShell>
  );
}
