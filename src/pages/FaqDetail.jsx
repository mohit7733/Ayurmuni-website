import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, CalendarClock, HelpCircle, ListChecks, Mail, MessageCircle } from 'lucide-react';
import AppShell from '../components/AppShell';
import { FAQ_CATEGORIES, formatFaqUpdatedLabel, getFaqDetail } from '../services/faqService';
import { Button } from '../components/ui';
import {
  ActionStack,
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  MetaChip,
  Steps,
} from '../components/detail/Detail';
import { STATIC_COPY as T } from '../content/static';

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
    const match = FAQ_CATEGORIES.find((item) => item.key === String(faq.category).toLowerCase());
    return match?.title || faq.category_label || String(faq.category);
  }, [faq]);

  const steps = Array.isArray(faq?.steps) ? faq.steps : [];
  const image = faq?.image_url || faq?.image || null;
  const updated = faq ? formatFaqUpdatedLabel(faq) : '';

  return (
    <AppShell tab="profile">
      <DetailPage>
        <DetailTop backTo="/profile/faq" backLabel={T.faqTitle} />

        {loading && !faq ? (
          <DetailSkeleton media={false} label={T.faqArticleLoading} />
        ) : error && !faq ? (
          <DetailEmpty
            icon={HelpCircle}
            title={error}
            text="The article may have moved. Browse all questions instead."
            action={<Button onClick={() => navigate('/profile/faq')}>{T.faqTitle}</Button>}
          />
        ) : (
          <>
            <DetailHero
              titleId="faq-title"
              eyebrow={categoryLabel || T.faqArticle}
              title={faq.question}
              chips={
                <>
                  <MetaChip icon={BookOpen}>{T.faqArticle}</MetaChip>
                  {updated ? <MetaChip icon={CalendarClock} tone="plain">{updated}</MetaChip> : null}
                  {steps.length ? (
                    <MetaChip icon={ListChecks} tone="gold">
                      {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                    </MetaChip>
                  ) : null}
                </>
              }
            />

            <DetailLayout
              aside={
                <DetailCard id="faq-help" title={T.faqHelpTitle} icon={MessageCircle} tone="accent">
                  <p className="dx-prose">{T.faqHelpText}</p>
                  <ActionStack>
                    <Button href={T.faqSupportMailto} leadingIcon={<Mail size={16} aria-hidden />}>
                      {T.faqEmail}
                    </Button>
                    <Button variant="secondary" onClick={() => navigate('/contact')}>
                      Contact us
                    </Button>
                    <Button variant="ghost" onClick={() => navigate('/profile/faq')}>
                      All questions
                    </Button>
                  </ActionStack>
                </DetailCard>
              }
            >
              <DetailCard id="faq-answer" title="Answer" icon={HelpCircle}>
                {image ? <img className="dx-figure-img" src={image} alt="" loading="lazy" decoding="async" /> : null}
                <p className="dx-prose">{faq.answer}</p>
              </DetailCard>

              {steps.length ? (
                <DetailCard id="faq-steps" title="Step by step" icon={ListChecks}>
                  <div className="dx-steps--solid">
                    <Steps
                      items={steps.map((step, index) => ({
                        id: step.id || index,
                        title: step.title || `Step ${index + 1}`,
                        text: step.description || step.body || step.text || '',
                      }))}
                    />
                  </div>
                </DetailCard>
              ) : null}
            </DetailLayout>
          </>
        )}
      </DetailPage>
    </AppShell>
  );
}
