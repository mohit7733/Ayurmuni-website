const SECTIONS = [
  { key: 'products', title: 'Products' },
  { key: 'medicines', title: 'Ayurveda Medicines' },
  { key: 'brands', title: 'Brands' },
  { key: 'doctors', title: 'Doctors' },
  { key: 'yoga_sessions', title: 'Yoga Sessions' },
  { key: 'diet_plans', title: 'Diet Plans' },
];

/** Live hits from customers/search/ while the header query is being typed. */
export default function LiveSearchResults({ results, loading, error, onPick, onSeeAll }) {
  const sections = SECTIONS.map((section) => ({
    ...section,
    hits: (results?.[section.key] || []).filter((hit) => hit && String(hit.title || '').trim()),
  })).filter((section) => section.hits.length > 0);

  if (loading && sections.length === 0) {
    return <p className="gs-recent__loading">Searching…</p>;
  }
  if (error && sections.length === 0) {
    return <p className="gs-error" role="alert">{error}</p>;
  }
  if (!sections.length) {
    return <p className="gs-recent__empty">No results for this search.</p>;
  }

  return (
    <div className="site-live">
      <p className="gs-recent__hint">Suggestions — tap one to open and save in Recent</p>
      {sections.map((section) => (
        <section key={section.key} className="gs-section" aria-label={section.title}>
          <h2 className="gs-section__title">
            {section.title} <span>{section.hits.length}</span>
          </h2>
          <ul className="gs-hits site-live__hits">
            {section.hits.slice(0, 4).map((hit) => (
              <li key={`${hit.type}:${hit.id}`}>
                <button type="button" className="gs-hit" onClick={() => onPick(hit)}>
                  <span className={`gs-hit__img gs-hit__img--${hit.type}`}>
                    {hit.image ? <img src={hit.image} alt="" /> : <span aria-hidden>{hit.title.charAt(0)}</span>}
                  </span>
                  <span className="gs-hit__text">
                    <strong>{hit.title}</strong>
                    {hit.subtitle ? <small>{hit.subtitle}</small> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <button type="button" className="gs-link site-live__all" onClick={onSeeAll}>
        See all results
      </button>
    </div>
  );
}
