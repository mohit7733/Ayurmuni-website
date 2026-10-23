import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cx } from './cx';
import useRecentSearchQueries from '../../hooks/useRecentSearchQueries';
import '../../design/premium-search.css';

const ROTATE_MS = 2800;

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return undefined;
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return reduced;
};

const isTypingTarget = (el) =>
  !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * Shared premium search field. Drop-in for the old SearchField (same props), plus:
 * - suggestions: real names already loaded on the page; rotated in the placeholder when empty.
 * - shortcut: '/' focuses the field (ignored while typing elsewhere). Default on.
 * - includeRecent: put the user's server-side recent searches first in the rotation.
 * - submitLabel: label of the green submit pill. Defaults to 'Search' when onSubmit is given;
 *   pass submitLabel={false} to hide it.
 */
export default function PremiumSearch({
  value = '',
  onChange,
  onSubmit,
  placeholder,
  label,
  submitLabel,
  clearLabel = 'Clear search',
  autoFocus,
  className,
  suggestions,
  shortcut = true,
  inputRef: externalRef,
  includeRecent = false,
}) {
  const recentQueries = useRecentSearchQueries(includeRecent);
  const id = useId();
  const localRef = useRef(null);
  const inputRef = externalRef || localRef;
  const reduced = usePrefersReducedMotion();
  const [focused, setFocused] = useState(false);
  const [tick, setTick] = useState(0);

  const pool = [...(includeRecent ? recentQueries : []), ...(Array.isArray(suggestions) ? suggestions : [])];
  const names = pool.length
    ? [...new Set(pool.map((s) => String(s || '').trim()).filter(Boolean))].slice(0, 8)
    : [];
  const rotating = names.length > 1 && !value && !focused && !reduced;
  const hint = names.length ? names[tick % names.length] : '';

  useEffect(() => {
    if (!rotating) return undefined;
    const timer = window.setInterval(() => setTick((t) => t + 1), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating]);

  useEffect(() => {
    if (!shortcut) return undefined;
    const onKey = (event) => {
      if (event.key !== '/' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(document.activeElement)) return;
      const input = inputRef.current;
      if (!input || !input.offsetParent) return;
      event.preventDefault();
      input.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut, inputRef]);

  const showOverlay = !value && names.length > 0;
  const submitText = submitLabel === false ? '' : submitLabel || (onSubmit ? 'Search' : '');

  return (
    <form
      role="search"
      className={cx('pm-search', value && 'has-value', className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
      }}
    >
      <label htmlFor={id} className="am-sr-only">
        {label || placeholder}
      </label>
      <span className="pm-search__icon" aria-hidden>
        <Search size={15} strokeWidth={2.4} />
      </span>
      <span className="pm-search__field">
        <input
          id={id}
          ref={inputRef}
          type="search"
          className="pm-search__input"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={showOverlay ? '' : placeholder}
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
        />
        {showOverlay ? (
          <span className="pm-search__ph" aria-hidden>
            <span className="pm-search__ph-lead">Search</span>{' '}
            <span key={hint} className="pm-search__ph-hint">
              “{hint}”
            </span>
          </span>
        ) : null}
      </span>
      {value ? (
        <button
          type="button"
          className="pm-search__clear"
          aria-label={clearLabel}
          onClick={() => {
            onChange?.('');
            inputRef.current?.focus();
          }}
        >
          <X size={14} aria-hidden />
        </button>
      ) : shortcut ? (
        <kbd className="pm-search__kbd" aria-hidden>
          /
        </kbd>
      ) : null}
      {submitText ? (
        <button type="submit" className="pm-search__submit">
          {submitText}
        </button>
      ) : null}
    </form>
  );
}
