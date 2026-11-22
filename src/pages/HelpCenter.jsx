import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, HelpCircle, Mail, MessageCircle, PhoneCall } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import {
  buildFaqCategories,
  getFaqList,
  groupFaqsByCategory,
} from '../services/faqService';
import {
  Button,
  Chip,
  EmptyState,
  SearchField,
  SectionHold,
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
  const [openId, setOpenId] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const list = await getFaqList();
      if (!alive) return;
      setFaqs(list);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(() => buildFaqCategories(faqs), [faqs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return faqs.filter((item) => {
      if (category && item.categoryId !== category && item.categoryName !== category) {
        return false;
      }
      if (!q) return true;
      return `${item.question} ${item.answer} ${item.categoryName}`
        .toLowerCase()
        .includes(q);
    });
  }, [faqs, search, category]);

  const grouped = useMemo(() => groupFaqsByCategory(filtered), [filtered]);

  const toggleFaq = (id) => {
    setOpenId((current) => (current === id ? '' : id));
  };

  return (
    <AppShell tab="profile">
      <section className="sx-page sx-help-page">
        <PageHeader
          title={T.faqTitle}
          subtitle={T.faqSubtitle}
          onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/profile'))}
        />

        <div className="sx-help-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={T.faqSearch}
            label={T.faqSearch}
          />

          {categories.length > 1 ? (
            <div className="sx-filters" role="group" aria-label="FAQ categories">
              {categories.map((item) => (
                <Chip
                  key={item.key || 'all'}
                  selected={category === item.key}
                  title={item.title}
                  onClick={() => {
                    setCategory(item.key);
                    setOpenId('');
                  }}
                >
                  {item.title}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>

        {loading ? (
          <SectionHold label={T.faqLoading} minHeight={220} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<HelpCircle size={28} />}
            title={T.faqEmpty}
            description={T.faqEmptyText}
          />
        ) : (
          <div className="sx-faq-groups">
            {grouped.map((group) => (
              <section key={group.key} className="sx-faq-group" aria-labelledby={`faq-cat-${group.key}`}>
                <div className="sx-faq-panel">
                  <header className="sx-faq-panel__head">
                    <div className="sx-faq-panel__title-wrap">
                      {group.imageUrl ? (
                        <img
                          className="sx-faq-panel__thumb"
                          src={group.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                      <h3 id={`faq-cat-${group.key}`}>{group.title}</h3>
                    </div>
                    <span className="sx-faq-panel__count">
                      {group.items.length}
                    </span>
                  </header>

                  <div className="sx-faq-accordion" role="list">
                    {group.items.map((item) => {
                      const isOpen = openId === item.id;
                      const panelId = `faq-panel-${item.id}`;
                      const buttonId = `faq-trigger-${item.id}`;
                      return (
                        <article
                          key={item.id}
                          className={`sx-faq-item${isOpen ? ' is-open' : ''}`}
                          role="listitem"
                        >
                          <h4 className="sx-faq-item__title">
                            <button
                              id={buttonId}
                              type="button"
                              className="sx-faq-item__trigger"
                              aria-expanded={isOpen}
                              aria-controls={panelId}
                              onClick={() => toggleFaq(item.id)}
                            >
                              <span>{item.question}</span>
                              <span className="sx-faq-item__icon" aria-hidden="true">
                                <ChevronDown size={18} />
                              </span>
                            </button>
                          </h4>
                          <div
                            id={panelId}
                            role="region"
                            aria-labelledby={buttonId}
                            className="sx-faq-item__panel"
                            hidden={!isOpen}
                          >
                            {item.answer ? <p>{item.answer}</p> : null}
                            {Array.isArray(item.image_urls) && item.image_urls.length ? (
                              <div className="sx-faq-item__media">
                                {item.image_urls.map((src) => (
                                  <img
                                    key={src}
                                    src={src}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>
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
              <p>
                <a href={T.contactPhoneHref}>{T.contactPhone}</a>
              </p>
            </div>
          </div>
          <div className="sx-help-card__actions">
            <Button variant="primary" href={T.contactPhoneHref} leadingIcon={<PhoneCall size={18} aria-hidden />}>
              {T.faqCall}
            </Button>
            <Button
              variant="secondary"
              href={T.contactWhatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              leadingIcon={<MessageCircle size={18} aria-hidden />}
            >
              {T.faqWhatsApp}
            </Button>
            <Button variant="ghost" href={T.faqSupportMailto} leadingIcon={<Mail size={18} aria-hidden />}>
              {T.faqEmail}
            </Button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
