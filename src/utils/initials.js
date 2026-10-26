const TITLE_RE = /^(dr|prof|professor|mr|mrs|ms|miss|vaidya|vd|shri|smt|sri)\.?$/i;

/** First letter of the actual name, ignoring titles (Dr., Prof.), parentheses and punctuation. */
export function nameInitial(name, fallback = 'A') {
  const words = String(name || '')
    .replace(/[()[\]{}.,]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  const real = words.find((w) => !TITLE_RE.test(w)) || words[0] || '';
  return real ? real.charAt(0).toUpperCase() : fallback;
}
