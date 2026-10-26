export default function ThreadAvatar({ name, src, className = 'ci-avatar' }) {
  const initial = String(name || '?')
    .replace(/^dr\.?\s*/i, '')
    .charAt(0)
    .toUpperCase();
  return (
    <span className={className} aria-hidden>
      {src ? <img src={src} alt="" /> : <span>{initial}</span>}
    </span>
  );
}
