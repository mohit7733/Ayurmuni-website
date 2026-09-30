import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { useGlobalSearch, useSearchDebounce } from '../hooks/useGlobalSearch';
import '../design/components/enhanced-search.css';

export default function EnhancedSearchField({
  value,
  onChange,
  onSubmit,
  onSelect,
  placeholder = 'Search...',
  showHistory = true,
  showSuggestions = true,
  autoFocus = false,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const {
    searchHistory,
    suggestions,
    loading,
    clearHistory,
    removeFromHistory,
    getSuggestions,
  } = useGlobalSearch();

  const debouncedGetSuggestions = useSearchDebounce(getSuggestions, 300);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  useEffect(() => {
    if (localValue && localValue.length >= 2 && showSuggestions) {
      debouncedGetSuggestions(localValue);
    }
  }, [localValue, showSuggestions, debouncedGetSuggestions]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange?.(newValue);
  };

  const handleSelect = (query) => {
    setLocalValue(query);
    onChange?.(query);
    onSelect?.(query);
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (localValue.trim()) {
      onSubmit?.(localValue.trim());
      setIsFocused(false);
    }
  };

  const handleClear = () => {
    setLocalValue('');
    onChange?.('');
    inputRef.current?.focus();
  };

  const handleRemoveHistory = (e, query) => {
    e.stopPropagation();
    removeFromHistory(query);
  };

  const handleClearHistory = (e) => {
    e.stopPropagation();
    clearHistory();
  };

  const showDropdown = isFocused && (
    (showHistory && searchHistory.length > 0 && !localValue) ||
    (showSuggestions && suggestions.length > 0 && localValue)
  );

  return (
    <div className="enhanced-search-wrapper">
      <form className="enhanced-search-field" onSubmit={handleSubmit}>
        <Search size={20} className="enhanced-search-icon" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="enhanced-search-input"
        />
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="enhanced-search-clear"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
        {loading && (
          <div className="enhanced-search-spinner" aria-label="Loading">
            <div className="spinner-small" />
          </div>
        )}
      </form>

      {showDropdown && (
        <div ref={dropdownRef} className="enhanced-search-dropdown">
          {/* Search History */}
          {!localValue && showHistory && searchHistory.length > 0 && (
            <div className="enhanced-search-section">
              <div className="enhanced-search-section-header">
                <Clock size={16} />
                <span>Recent Searches</span>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="enhanced-search-clear-all"
                >
                  Clear all
                </button>
              </div>
              <ul className="enhanced-search-list">
                {searchHistory.slice(0, 5).map((item, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.query)}
                      className="enhanced-search-item"
                    >
                      <Clock size={16} className="enhanced-search-item-icon" />
                      <span className="enhanced-search-item-text">{item.query}</span>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveHistory(e, item.query)}
                        className="enhanced-search-item-remove"
                        aria-label="Remove"
                      >
                        <X size={14} />
                      </button>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {localValue && showSuggestions && suggestions.length > 0 && (
            <div className="enhanced-search-section">
              <div className="enhanced-search-section-header">
                <TrendingUp size={16} />
                <span>Suggestions</span>
              </div>
              <ul className="enhanced-search-list">
                {suggestions.map((suggestion, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => handleSelect(suggestion)}
                      className="enhanced-search-item"
                    >
                      <Search size={16} className="enhanced-search-item-icon" />
                      <span className="enhanced-search-item-text">
                        {/* Highlight matching part */}
                        {suggestion.split(new RegExp(`(${localValue})`, 'gi')).map((part, i) =>
                          part.toLowerCase() === localValue.toLowerCase() ? (
                            <strong key={i}>{part}</strong>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No Results */}
          {localValue && showSuggestions && suggestions.length === 0 && !loading && (
            <div className="enhanced-search-empty">
              <p>No suggestions found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
