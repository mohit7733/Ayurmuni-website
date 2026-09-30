import { useId } from 'react';
import { Search, X } from 'lucide-react';
import Button from './Button';
import { cx } from './cx';

export default function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  submitLabel,
  clearLabel = 'Clear search',
  autoFocus,
  className,
}) {
  const id = useId();
  return (
    <form
      role="search"
      className={cx('am-search', className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
      }}
    >
      <label htmlFor={id} className="am-sr-only">
        {label || placeholder}
      </label>
      <Search className="am-search__icon" size={18} aria-hidden />
      <input
        id={id}
        type="search"
        className="am-search__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {value ? (
        <button type="button" className="am-search__clear" aria-label={clearLabel} onClick={() => onChange('')}>
          <X size={16} aria-hidden />
        </button>
      ) : null}
      {submitLabel ? (
        <Button type="submit" size="sm" className="am-search__submit">
          {submitLabel}
        </Button>
      ) : null}
    </form>
  );
}
