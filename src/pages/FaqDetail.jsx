import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { FAQ_CATEGORIES, formatFaqUpdatedLabel, getFaqDetail } from '../services/faqService';
import { Button, Disclaimer, EmptyState, Skeleton, SkeletonText } from '../components/ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

export default function FaqDetail() {
  const navigate = useNavigate();
  const { faqId = '' } = useParams();
  const location = useLocation();
  const seed = location.state?.faq || null;
  const [faq, setFaq] = useState(seed);
  const [loading, setLoading] = useState(!seed);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!faqId) return;
      setLoading(true);
      setError('');
      const detail = await getFaqDetail(faqId);
      if (!alive) return;
      if (detail) setFaq(detail);
      else if (!seed) setError(T.faqArticleError);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [faqId, seed]);

  const categoryLabel = useMemo(() => {
    if (!faq?.category) return faq?.category_label || '';
    const match = FAQ_CATEGORIES.find(
      (item) => item.key === String(faq.category).toLowerCase(),
    );
    return match?.title || faq.category_label || String(faq.category);
  }, [faq]);

  const steps = Array.isArray(faq?.steps) ? faq.steps : [];
  const image = faq?.image_url || faq?.image || null;

  return (
    <AppShell tab="profile">
      <section className="sx-page sx-narrow">
        <PageHeader
          title={T.faqTitle}
          subtitle={categoryLabel || T.faqArticle}
          backTo="/profile/faq"
        />
        {loading && !faq ? (
          <div aria-busy="true" aria-label={T.faqArticleLoading}>
            <SkeletonText lines={2} />
            <Skeleton style={{ height: 180, borderRadius: 'var(--am-radius-lg)', marginTop: 16 }} />
          </div>
        ) : error && !faq ? (
          <EmptyState
            icon={<HelpCircle size={28} />}
            title={error}
            action={
              <Button variant="primary" onClick={() => navigate('/profile/faq')}>
                {T.faqTitle}
              </Button>
            }
          />
        ) : (
          <article className="sx-article">
            <h2>{faq.question}</h2>
            {formatFaqUpdatedLabel(faq) ? (
              <span className="sx-article__meta">{formatFaqUpdatedLabel(faq)}</span>
            ) : null}
            {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : null}
            <p>{faq.answer}</p>
            {steps.length > 0 ? (
              <ol>
                {steps.map((step, index) => (
                  <li key={step.id || index}>
                    <strong>{step.title || `Step ${index + 1}`}</strong>
                    <p>{step.description || step.body || step.text || ''}</p>
                  </li>
                ))}
              </ol>
            ) : null}
          </article>
        )}
        <Disclaimer />
      </section>
    </AppShell>
  );
}
