import { Check } from 'lucide-react';
import { cx } from './cx';

export default function StepIndicator({ steps, current = 0, label = 'Progress', className }) {
  return (
    <nav aria-label={label} className={cx('am-steps', className)}>
      <ol>
        {steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo';
          return (
            <li key={step} className={`am-step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="am-step__dot" aria-hidden>
                {state === 'done' ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span className="am-step__label">{step}</span>
              {state === 'done' ? <span className="am-sr-only"> (completed)</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
