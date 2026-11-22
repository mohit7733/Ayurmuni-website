import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  CircleHelp,
  FileText,
  Mail,
  MessageCircle,
  MessageSquare,
  PhoneCall,
  Scale,
  Shield,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';
import '../design/pages/feedback-information.css';

const ICONS = {
  help: CircleHelp,
  terms: FileText,
  privacy: Shield,
  legal: Scale,
  mail: Mail,
  contact: MessageSquare,
  phone: PhoneCall,
  whatsapp: MessageCircle,
};

export default function FeedbackInformation() {
  const navigate = useNavigate();
  const helpItem = T.feedbackItems.find((item) => item.icon === 'help');
  const legalItems = T.feedbackItems.filter((item) => item.icon !== 'help');
  const supportItems = [
    helpItem,
    {
      title: T.contactTitle,
      subtitle: T.contactSubtitle,
      to: '/contact',
      icon: 'contact',
    },
    {
      title: T.contactPhoneLabel,
      subtitle: T.contactPhone,
      href: T.contactPhoneHref,
      icon: 'phone',
    },
    {
      title: T.contactWhatsAppLabel,
      subtitle: T.contactWhatsApp,
      href: T.contactWhatsAppHref,
      icon: 'whatsapp',
    },
    {
      title: T.contactEmailLabel,
      subtitle: T.contactEmail,
      href: T.contactEmailHref,
      icon: 'mail',
    },
  ].filter(Boolean);

  const renderItem = (item) => {
    const Icon = ICONS[item.icon] || FileText;
    const body = (
      <>
        <span className="sx-feedback-card__icon" aria-hidden>
          <Icon size={18} />
        </span>
        <span className="sx-feedback-card__copy">
          <strong>{item.title}</strong>
          <small>{item.subtitle}</small>
        </span>
        <ChevronRight className="sx-feedback-card__arrow" size={16} aria-hidden />
      </>
    );
    if (item.href) {
      const external = item.href.startsWith('http');
      return (
        <a
          key={item.title}
          className="sx-feedback-card"
          href={item.href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : undefined)}
        >
          {body}
        </a>
      );
    }
    return (
      <button
        key={item.title}
        type="button"
        className="sx-feedback-card"
        onClick={() => navigate(item.to, item.state ? { state: item.state } : undefined)}
      >
        {body}
      </button>
    );
  };

  return (
    <AppShell tab="profile">
      <section className="sx-page sx-feedback-page">
        <PageHeader
          eyebrow="Support & information"
          title={T.feedbackTitle}
          subtitle={T.feedbackSubtitle}
          backTo="/profile"
        />

        <section className="sx-feedback-section" aria-labelledby="feedback-support-title">
          <div className="sx-feedback-section__head">
            <h2 id="feedback-support-title">Help & support</h2>
            <p>{T.contactLead}</p>
          </div>
          <div className="sx-feedback-grid sx-feedback-grid--support">{supportItems.map(renderItem)}</div>
        </section>

        {legalItems.length ? (
          <section className="sx-feedback-section" aria-labelledby="feedback-legal-title">
            <div className="sx-feedback-section__head">
              <h2 id="feedback-legal-title">Policies & legal</h2>
              <p>{legalItems.length} documents</p>
            </div>
            <div className="sx-feedback-grid">{legalItems.map(renderItem)}</div>
          </section>
        ) : null}

        <p className="sx-feedback-note">{T.contactNote}</p>
      </section>
    </AppShell>
  );
}
