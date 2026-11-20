/** Skip QA / junk titles so the rotating placeholder stays useful. */
const isJunkSuggestion = (name) => {
  const value = String(name || '').trim();
  if (!value) return true;
  if (value.length > 32) return true;
  if (/^test(ing)?\b/i.test(value)) return true;
  if (/^(asdf|qwerty|lorem|xxx+|sample|dummy)\b/i.test(value)) return true;
  // Long runs of the same letter (e.g. testingsssssssssjjj)
  if (/(.)\1{4,}/i.test(value)) return true;
  return false;
};

/** Real names from lists a page already loaded, for PremiumSearch's rotating placeholder. */
export const searchSuggestions = (...lists) =>
  lists
    .flat()
    .map((item) =>
      typeof item === 'string'
        ? item
        : item?.name || item?.title || item?.session_name || item?.plan_name || item?.full_name || '',
    )
    .map((name) => String(name).trim())
    .filter((name) => !isJunkSuggestion(name));
