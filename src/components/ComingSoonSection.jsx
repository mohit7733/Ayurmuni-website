import { openComingSoonModal } from '../launch/comingSoonMode';

/**
 * Keeps section content visible; when active, puts a Coming soon layer on top
 * and opens the modal on click.
 */
export default function ComingSoonLayer({ active = false, label = 'Coming soon', children }) {
  if (!active) return children;

  return (
    <div className="hm-soon-layer">
      <div className="hm-soon-layer__content" aria-hidden="true">
        {children}
      </div>
      <button
        type="button"
        className="hm-soon-layer__veil"
        onClick={openComingSoonModal}
        aria-label={label}
      >
        <span className="hm-soon-layer__badge">{label}</span>
      </button>
    </div>
  );
}
