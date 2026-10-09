import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, HelpCircle, Mail } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { FAQ_CATEGORIES, getFaqList } from '../services/faqService';
import {
  Button,
  Chip,
  Disclaimer,
  EmptyState,
  SearchField,
  Skeleton,
  SkeletonText,
} from '../components/ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';
import '../design/pages/help-center.css';

export default function HelpCenter() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [faqs, setFaqs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const list = await getFaqList(category || undefined);
      if (!alive) return;
      setFaqs(list);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((item) =>
      `${item.question} ${item.answer}`.toLowerCase().includes(q),
    );
  }, [faqs, search]);

  return (
    <AppShell tab="profile">
      <section className="sx-page sx-help-page">
        <PageHeader
          title={T.faqTitle}
          subtitle={T.faqSubtitle}
          onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/profile'))}
        />

        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={T.faqSearch}
          label={T.faqSearch}
        />

        <div className="sx-filters" role="group" aria-label="FAQ categories">
          {FAQ_CATEGORIES.map((item) => (
            <Chip
              key={item.key || 'all'}
              selected={category === item.key}
              onClick={() => setCategory(item.key)}
            >
              {item.title}
            </Chip>
          ))}
        </div>

        <div className="sx-help-results-head">
          <div>
            <span className="sx-help-eyebrow">Help library</span>
            <h2>Frequently asked questions</h2>
          </div>
          {!loading ? (
            <span className="sx-help-count">
              {filtered.length} {filtered.length === 1 ? 'question' : 'questions'}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="sx-help-loading" aria-busy="true" aria-label={T.faqLoading}>
            <Skeleton style={{ height: 72, borderRadius: 'var(--am-radius-lg)' }} />
            <Skeleton style={{ height: 72, borderRadius: 'var(--am-radius-lg)' }} />
            <SkeletonText lines={2} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<HelpCircle size={28} />}
            title={T.faqEmpty}
            description={T.faqEmptyText}
          />
        ) : (
          <div className="sx-faq-list">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className="sx-faq-row"
                onClick={() => navigate(`/profile/faq/${item.id}`, { state: { faq: item } })}
              >
                <span className="sx-faq-row__copy">
                  <strong>{item.question}</strong>
                  {item.answer ? <p>{String(item.answer).slice(0, 140)}</p> : null}
                </span>
                <span className="sx-faq-row__arrow" aria-hidden="true">
                  <ChevronRight size={18} />
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="sx-help-card">
          <div className="sx-help-card__copy">
            <span className="sx-help-card__icon" aria-hidden="true">
              <Mail size={20} />
            </span>
            <div>
              <h2>{T.faqHelpTitle}</h2>
              <p>{T.faqHelpText}</p>
            </div>
          </div>
          <Button variant="primary" href={T.faqSupportMailto} leadingIcon={<Mail size={18} aria-hidden />}>
            {T.faqEmail}
          </Button>
        </div>

        <Disclaimer />
      </section>
    </AppShell>
  );
}
