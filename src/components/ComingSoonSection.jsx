import { openComingSoonModal } from '../launch/comingSoonMode';

/**
 * Keeps section content visible; when active, puts a Coming soon layer on top
 * and opens the modal on click.
 */
export default function ComingSoonLayer({
  active = false,
  label = 'Coming soon',
  className = '',
  children,
}) {
  if (!active) return children;

  const rootClass = ['hm-soon-layer', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
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
