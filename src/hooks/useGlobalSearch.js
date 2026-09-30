import { useState, useEffect, useCallback } from 'react';
import { Utils } from '../common/utils';

const SEARCH_HISTORY_KEY = '_SEARCH_HISTORY';
const MAX_HISTORY_ITEMS = 10;

/**
 * Custom hook for global search with autocomplete and history
 */
export function useGlobalSearch() {
  const [searchHistory, setSearchHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load search history from storage
  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const history = await Utils.getData(SEARCH_HISTORY_KEY);
      if (history && Array.isArray(history)) {
        setSearchHistory(history);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  // Add search query to history
  const addToHistory = useCallback(async (query) => {
    const trimmed = String(query || '').trim();
    if (!trimmed || trimmed.length < 2) return;

    try {
      const history = await Utils.getData(SEARCH_HISTORY_KEY) || [];
      
      // Remove if already exists (to avoid duplicates)
      const filtered = history.filter(item => 
        item.query.toLowerCase() !== trimmed.toLowerCase()
      );

      // Add to beginning
      const updated = [
        { query: trimmed, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_HISTORY_ITEMS);

      await Utils.setData(SEARCH_HISTORY_KEY, updated);
      setSearchHistory(updated);
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, []);

  // Clear search history
  const clearHistory = useCallback(async () => {
    try {
      await Utils.removeData(SEARCH_HISTORY_KEY);
      setSearchHistory([]);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, []);

  // Remove single item from history
  const removeFromHistory = useCallback(async (query) => {
    try {
      const history = await Utils.getData(SEARCH_HISTORY_KEY) || [];
      const updated = history.filter(item => item.query !== query);
      await Utils.setData(SEARCH_HISTORY_KEY, updated);
      setSearchHistory(updated);
    } catch (error) {
      console.error('Failed to remove from history:', error);
    }
  }, []);

  // Get search suggestions (can be enhanced with API call)
  const getSuggestions = useCallback(async (query) => {
    const trimmed = String(query || '').trim();
    
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    
    try {
      // For now, filter from search history
      // TODO: Replace with API call for real suggestions
      const history = await Utils.getData(SEARCH_HISTORY_KEY) || [];
      const filtered = history
        .filter(item => 
          item.query.toLowerCase().includes(trimmed.toLowerCase())
        )
        .map(item => item.query)
        .slice(0, 5);
      
      setSuggestions(filtered);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    searchHistory,
    suggestions,
    loading,
    addToHistory,
    clearHistory,
    removeFromHistory,
    getSuggestions,
  };
}

/**
 * Hook for debounced search
 */
export function useSearchDebounce(callback, delay = 300) {
  const [timeoutId, setTimeoutId] = useState(null);

  const debouncedCallback = useCallback((...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  }, [callback, delay, timeoutId]);

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return debouncedCallback;
}
