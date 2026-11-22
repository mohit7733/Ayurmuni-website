import { useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  PhoneCall,
  ShieldAlert,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

export default function Contact() {
  const navigate = useNavigate();

  const channels = [
    {
      id: 'phone',
      label: T.contactPhoneLabel,
      value: T.contactPhone,
      hint: 'Call for orders & inquiries',
      href: T.contactPhoneHref,
      icon: PhoneCall,
    },
    {
      id: 'whatsapp',
      label: T.contactWhatsAppLabel,
      value: T.contactWhatsApp,
      hint: 'Chat with support',
      href: T.contactWhatsAppHref,
      external: true,
      icon: MessageCircle,
    },
    {
      id: 'email',
      label: T.contactEmailLabel,
      value: T.contactEmail,
      hint: 'Orders, appointments & account help',
      href: T.contactEmailHref,
      icon: Mail,
    },
    {
      id: 'faq',
      label: 'Help center',
      value: T.contactFaq,
      hint: 'Quick answers for common questions',
      to: '/profile/faq',
      icon: CircleHelp,
    },
  ];

  return (
    <AppShell tab="profile">
      <section className="sx-page sx-contact-page">
        <PageHeader
          className="sx-contact-page__header"
          eyebrow="Support"
          title={T.contactTitle}
          subtitle={T.contactLead}
          onBack={() => navigate(-1)}
        />

        <p className="sx-contact-page__meta">
          <Clock3 size={14} aria-hidden />
          <span>
            {T.contactHoursLabel}: {T.contactHours}
          </span>
        </p>

        <section className="sx-contact-page__channels" aria-label="Ways to reach us">
          {channels.map((item) => {
            const Icon = item.icon;
            const body = (
              <>
                <span className="sx-contact-page__channel-icon" aria-hidden>
                  <Icon size={18} />
                </span>
                <span className="sx-contact-page__channel-copy">
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                  {item.hint ? <em>{item.hint}</em> : null}
                </span>
                <ChevronRight className="sx-contact-page__channel-arrow" size={16} aria-hidden />
              </>
            );

            if (item.to) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className="sx-contact-page__channel"
                  onClick={() => navigate(item.to)}
                >
                  {body}
                </button>
              );
            }

            return (
              <a
                key={item.id}
                className="sx-contact-page__channel"
                href={item.href}
                {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : undefined)}
              >
                {body}
              </a>
            );
          })}
        </section>

        <section className="sx-contact-page__office" aria-labelledby="sx-contact-office-title">
          <span className="sx-contact-page__office-icon" aria-hidden>
            <Building2 size={18} />
          </span>
          <div>
            <h2 id="sx-contact-office-title">{T.contactOfficeLabel}</h2>
            <p>
              <MapPin size={14} aria-hidden />
              <span>{T.contactOffice}</span>
            </p>
          </div>
        </section>

        <aside className="sx-contact-page__disclaimer" role="note">
          <span className="sx-contact-page__disclaimer-icon" aria-hidden>
            <ShieldAlert size={16} />
          </span>
          <p>
            Online consultations are not a substitute for emergency care. In an emergency,{' '}
            <a href="tel:112">call 112</a>.
          </p>
        </aside>
      </section>
    </AppShell>
  );
}
