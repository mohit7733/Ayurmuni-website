import { Search, X } from 'lucide-react';

/** Recent-search chips from the app's ProductSearchScreen (customers/search/recent/). */
export default function RecentSearchList({
  items = [],
  loading = false,
  clearing = false,
  activeId = '',
  onPick,
  onClear,
  onRemove,
}) {
  if (loading && items.length === 0) {
    return <p className="gs-recent__loading">Loading recent searches…</p>;
  }

  return (
    <div className="gs-recent" aria-label="Recent searches">
      <div className="gs-recent__head">
        <h2>Recent searches</h2>
        {items.length > 0 ? (
          <button type="button" className="gs-link" onClick={onClear} disabled={clearing}>
            {clearing ? 'Clearing…' : 'Clear'}
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="gs-recent__empty">Tap a suggestion while searching to save it here</p>
      ) : (
        <ul className="gs-chips">
          {items.map((item) => (
            <li key={item.id || item.query} className={item.id === activeId ? 'gs-chip is-active' : 'gs-chip'}>
              <button type="button" className="gs-chip__main" onClick={() => onPick?.(item)}>
                <Search size={12} aria-hidden />
                <span>{item.query}</span>
              </button>
              {onRemove ? (
                <button
                  type="button"
                  className="gs-chip__x"
                  aria-label={`Remove ${item.query}`}
                  onClick={() => onRemove(item)}
                >
                  <X size={12} aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
