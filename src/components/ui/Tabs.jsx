import { useRef } from 'react';
import { cx } from './cx';

export default function Tabs({ items, value, onChange, label, variant = 'underline', idPrefix, className }) {
  const listRef = useRef(null);

  const focusTab = (index) => {
    const tabs = listRef.current?.querySelectorAll('[role="tab"]');
    if (!tabs?.length) return;
    const next = (index + tabs.length) % tabs.length;
    tabs[next].focus();
    onChange?.(items[next].id);
  };

  const onKeyDown = (event, index) => {
    if (event.key === 'ArrowRight') focusTab(index + 1);
    else if (event.key === 'ArrowLeft') focusTab(index - 1);
    else if (event.key === 'Home') focusTab(0);
    else if (event.key === 'End') focusTab(items.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cx('am-tabs', `am-tabs--${variant}`, className)}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${item.id}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${item.id}` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cx('am-tab', selected && 'is-selected')}
            onClick={() => onChange?.(item.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {item.label}
            {item.count != null ? <span className="am-tab__count">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
