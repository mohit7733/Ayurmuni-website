// Shared inline-SVG ornaments for the luxury quest / prakriti screens.
const ICON_PATHS = {
  vata: (
    <path d="M2 6h8a2 2 0 1 0-2-2M2 9h10a2 2 0 1 1-2 2M2 12h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  ),
  pitta: (
    <path d="M8 1.5c.5 2.5 3.5 4 3.5 7.5a3.5 3.5 0 0 1-7 0c0-1.6.8-2.6 1.6-3.4.2 1.2.8 1.9 1.4 2.1C7 5.6 7.4 3.4 8 1.5Z" fill="currentColor" />
  ),
  kapha: (
    <>
      <path d="M8 1.8C10 5 12 7.2 12 9.8a4 4 0 0 1-8 0C4 7.2 6 5 8 1.8Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14.2h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
};

export function ElementIcon({ type }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      {ICON_PATHS[type] || null}
    </svg>
  );
}

export function Lotus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 4c2 2.2 2.6 5 2 8-1 .6-1.4.8-2 1-.6-.2-1-.4-2-1-.6-3 0-5.8 2-8Z" fill="currentColor" />
      <path d="M5 8.5c2.6.4 4.6 2 5.6 4.8-.4.8-.6 1.2-.8 1.7C7.2 14.6 5.4 12.4 5 8.5Zm14 0c-2.6.4-4.6 2-5.6 4.8.4.8.6 1.2.8 1.7 2.6-.4 4.4-2.6 4.8-6.5Z" fill="currentColor" opacity=".8" />
      <path d="M3 13.5c3 .2 5.6 1.4 9 3.5 3.4-2.1 6-3.3 9-3.5-1.6 3.6-5 5.5-9 5.5s-7.4-1.9-9-5.5Z" fill="currentColor" opacity=".6" />
    </svg>
  );
}

export function Mandala({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth=".6">
        {Array.from({ length: 16 }, (_, i) => (
          <ellipse key={i} cx="100" cy="58" rx="14" ry="42" transform={`rotate(${i * 22.5} 100 100)`} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <path key={`p${i}`} d="M100 10c8 10 8 22 0 32-8-10-8-22 0-32Z" transform={`rotate(${i * 45} 100 100)`} />
        ))}
        <circle cx="100" cy="100" r="96" />
        <circle cx="100" cy="100" r="74" />
        <circle cx="100" cy="100" r="22" />
        <circle cx="100" cy="100" r="12" />
      </g>
    </svg>
  );
}

export function Ornament() {
  return (
    <svg className="lux-ornament" viewBox="0 0 60 8" aria-hidden>
      <path d="M0 4h24M36 4h24" stroke="currentColor" strokeWidth=".8" />
      <path d="M30 0l4 4-4 4-4-4z" fill="currentColor" />
    </svg>
  );
}
