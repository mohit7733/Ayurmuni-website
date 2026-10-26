import { useEffect, useState } from 'react';
import { readAuthenticated } from '../services/guestAuth';
import { getRecentSearches } from '../services/globalSearchService';

/**
 * Recent search queries (customers/search/recent/) for PremiumSearch's rotating hints.
 * One request per page load, shared by every field; logged-out visitors make none.
 */
let cache = null;
let pending = null;

export const invalidateRecentSearchQueries = () => {
  cache = null;
  pending = null;
};

export default function useRecentSearchQueries(enabled = true) {
  const [queries, setQueries] = useState(cache || []);
  useEffect(() => {
    if (!enabled || !readAuthenticated()) return undefined;
    let alive = true;
    if (!pending) {
      pending = getRecentSearches(10)
        .then((list) => (cache = list.map((item) => item.query).filter(Boolean)))
        .catch(() => (cache = []));
    }
    pending.then((list) => alive && setQueries(list || []));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return queries;
}
