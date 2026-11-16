const TITLE_RE = /^(dr|prof|professor|mr|mrs|ms|miss|vaidya|vd|shri|smt|sri)\.?$/i;

const nameWords = (name) =>
  String(name || '')
    .replace(/[()[\]{}.,]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word && !TITLE_RE.test(word));

/** First letter of the actual name, ignoring titles (Dr., Prof.), parentheses and punctuation. */
export function nameInitial(name, fallback = 'A') {
  const real = nameWords(name)[0] || '';
  return real ? real.charAt(0).toUpperCase() : fallback;
}

/** Up to two initials from the person's name, skipping titles such as Dr. and (Prof.). */
export function nameInitials(name, count = 2, fallback = 'A') {
  const letters = nameWords(name)
    .slice(0, count)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return letters || fallback;
}
