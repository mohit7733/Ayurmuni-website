import { useNavigate } from 'react-router-dom';
import { ChevronRight, CircleHelp, FileText, Scale, Shield } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Disclaimer } from '../components/ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';
import '../design/pages/feedback-information.css';

const ICONS = {
  help: CircleHelp,
  terms: FileText,
  privacy: Shield,
  legal: Scale,
};

export default function FeedbackInformation() {
  const navigate = useNavigate();
  const supportItems = T.feedbackItems.filter((item) => item.icon === 'help');
  const legalItems = T.feedbackItems.filter((item) => item.icon !== 'help');

  const renderItem = (item) => {
    const Icon = ICONS[item.icon] || FileText;
    return (
      <button
        key={item.title}
        type="button"
        className="sx-feedback-card"
        onClick={() => navigate(item.to, item.state ? { state: item.state } : undefined)}
      >
        <span className="sx-feedback-card__icon" aria-hidden>
          <Icon size={20} />
        </span>
        <span className="sx-feedback-card__copy">
          <strong>{item.title}</strong>
          <small>{item.subtitle}</small>
        </span>
        <ChevronRight className="sx-feedback-card__arrow" size={20} aria-hidden />
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
          onBack={() => navigate(-1)}
        />
        {supportItems.length ? (
          <section className="sx-feedback-section" aria-labelledby="feedback-support-title">
            <h2 id="feedback-support-title">Help & support</h2>
            <div className="sx-feedback-grid">{supportItems.map(renderItem)}</div>
          </section>
        ) : null}
        {legalItems.length ? (
          <section className="sx-feedback-section" aria-labelledby="feedback-legal-title">
            <h2 id="feedback-legal-title">Policies & legal</h2>
            <div className="sx-feedback-grid">{legalItems.map(renderItem)}</div>
          </section>
        ) : null}
        <Disclaimer />
      </section>
    </AppShell>
  );
}
