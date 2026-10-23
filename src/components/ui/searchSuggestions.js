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
    .filter((name) => name && name.length <= 32);
