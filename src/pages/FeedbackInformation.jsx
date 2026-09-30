import { useNavigate } from 'react-router-dom';
import { ChevronRight, CircleHelp, FileText, Scale, Shield } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Disclaimer } from '../components/ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

const ICONS = {
  help: CircleHelp,
  terms: FileText,
  privacy: Shield,
  legal: Scale,
};

export default function FeedbackInformation() {
  const navigate = useNavigate();

  return (
    <AppShell tab="profile">
      <section className="sx-page sx-narrow">
        <PageHeader
          title={T.feedbackTitle}
          subtitle={T.feedbackSubtitle}
          onBack={() => navigate(-1)}
        />
        <div className="sx-list">
          {T.feedbackItems.map((item) => {
            const Icon = ICONS[item.icon] || FileText;
            return (
              <button
                key={item.title}
                type="button"
                className="sx-row"
                onClick={() => navigate(item.to, item.state ? { state: item.state } : undefined)}
              >
                <span className="sx-row__icon" aria-hidden>
                  <Icon size={18} />
                </span>
                <span className="sx-row__copy">
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
                <ChevronRight size={18} aria-hidden />
              </button>
            );
          })}
        </div>
        <Disclaimer />
      </section>
    </AppShell>
  );
}
