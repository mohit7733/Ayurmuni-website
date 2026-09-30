import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './cx';

function useFieldIds(id, hint, error) {
  const autoId = useId();
  const fieldId = id || autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { fieldId, hintId, errorId, describedBy };
}

function FieldShell({ fieldId, label, required, hint, hintId, error, errorId, className, children }) {
  return (
    <div className={cx('am-field', error && 'has-error', className)}>
      {label ? (
        <label htmlFor={fieldId} className="am-field__label">
          {label}
          {required ? (
            <span className="am-field__req" aria-hidden>
              {' *'}
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? (
        <p id={hintId} className="am-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="am-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  id,
  label,
  hint,
  error,
  required,
  leadingIcon,
  trailing,
  className,
  inputClassName,
  ...rest
}) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldShell {...ids} label={label} required={required} hint={hint} error={error} className={className}>
      <div className={cx('am-control', leadingIcon && 'has-leading', trailing && 'has-trailing')}>
        {leadingIcon ? (
          <span className="am-control__icon" aria-hidden>
            {leadingIcon}
          </span>
        ) : null}
        <input
          id={ids.fieldId}
          className={cx('am-input', inputClassName)}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          {...rest}
        />
        {trailing ? <span className="am-control__trailing">{trailing}</span> : null}
      </div>
    </FieldShell>
  );
}

export function Textarea({ id, label, hint, error, required, className, rows = 4, ...rest }) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldShell {...ids} label={label} required={required} hint={hint} error={error} className={className}>
      <textarea
        id={ids.fieldId}
        className="am-input am-textarea"
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        {...rest}
      />
    </FieldShell>
  );
}

export function Select({
  id,
  label,
  hint,
  error,
  required,
  options = [],
  placeholder,
  className,
  children,
  ...rest
}) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldShell {...ids} label={label} required={required} hint={hint} error={error} className={className}>
      <div className="am-control am-control--select">
        <select
          id={ids.fieldId}
          className="am-input am-select"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown className="am-control__chevron" size={18} aria-hidden />
      </div>
    </FieldShell>
  );
}
