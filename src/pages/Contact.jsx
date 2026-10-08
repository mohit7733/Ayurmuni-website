import { useNavigate } from 'react-router-dom';
import { ArrowRight, CircleHelp, Mail, PhoneCall } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Button, Disclaimer } from '../components/ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

export default function Contact() {
  const navigate = useNavigate();

  return (
    <AppShell tab="profile">
      <section className="sx-page sx-contact-page">
        <PageHeader
          className="sx-contact-page__header"
          eyebrow="SUPPORT"
          title={T.contactTitle}
          subtitle={T.contactSubtitle}
          onBack={() => navigate(-1)}
        />

        <div className="sx-contact-page__layout">
          <div className="sx-contact-page__intro">
            <span className="sx-contact-page__eyebrow">HOW CAN WE HELP?</span>
            <h2>We’re just a message away.</h2>
            <p>{T.contactLead}</p>

            <aside className="sx-contact-page__emergency">
              <span className="sx-contact-page__emergency-icon" aria-hidden="true">
                <PhoneCall size={19} />
              </span>
              <div>
                <strong>Need emergency care?</strong>
                <p>{T.contactNote}</p>
                <a href="tel:112">Call 112</a>
              </div>
            </aside>
          </div>

          <div className="sx-contact-page__options">
            <article className="sx-contact-page__card sx-contact-page__card--email">
              <span className="sx-contact-page__icon" aria-hidden="true">
                <Mail size={21} />
              </span>
              <span className="sx-contact-page__card-label">EMAIL SUPPORT</span>
              <h2>Talk to our team</h2>
              <p>For help with orders, appointments, or your account, send us an email.</p>
              <a className="sx-contact-page__email" href={T.contactEmailHref}>
                {T.contactEmail}
              </a>
              <Button
                variant="primary"
                href={T.contactEmailHref}
                trailingIcon={<ArrowRight size={17} aria-hidden="true" />}
              >
                {T.faqEmail}
              </Button>
            </article>

            <article className="sx-contact-page__card sx-contact-page__card--faq">
              <span className="sx-contact-page__icon" aria-hidden="true">
                <CircleHelp size={21} />
              </span>
              <span className="sx-contact-page__card-label">HELP CENTER</span>
              <h2>Looking for an answer?</h2>
              <p>Browse frequently asked questions for quick guidance and helpful information.</p>
              <Button
                variant="secondary"
                onClick={() => navigate('/profile/faq')}
                trailingIcon={<ArrowRight size={17} aria-hidden="true" />}
              >
                {T.contactFaq}
              </Button>
            </article>
          </div>
        </div>

        <div className="sx-contact-page__footer">
          <Disclaimer />
        </div>
      </section>
    </AppShell>
  );
}
