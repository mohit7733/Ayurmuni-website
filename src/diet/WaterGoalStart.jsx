import { useEffect, useState } from 'react';
import { WaterGlass } from './WaterLog';
import {
  WATER_GLASS_ML,
  WATER_GOAL_OPTIONS,
  formatWaterLiters,
  getWaterGlassCount,
} from './utils';

export default function WaterGoalStart({ planName, loading, onClose, onConfirm }) {
  const [unit, setUnit] = useState('glasses');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setSelected(null);
    setUnit('glasses');
  }, []);

  const glasses = selected ? getWaterGlassCount(selected) : 0;
  const subtitle = planName
    ? `How do you want to drink water for ${planName}?`
    : 'How do you want to drink water for this diet?';

  return (
    <div className="web-modal" role="dialog" aria-modal="true" aria-labelledby="water-goal-title">
      <button type="button" className="water-log-backdrop" aria-label="Close" disabled={loading} onClick={onClose} />
      <div className="web-modal-card water-goal-card">
        <h3 id="water-goal-title">Daily water goal</h3>
        <p>{subtitle}</p>

        <div className="water-goal-units" role="group" aria-label="Water unit">
          <button
            type="button"
            className={unit === 'glasses' ? 'on' : ''}
            disabled={loading}
            onClick={() => setUnit('glasses')}
          >
            Glasses
          </button>
          <button
            type="button"
            className={unit === 'liters' ? 'on' : ''}
            disabled={loading}
            onClick={() => setUnit('liters')}
          >
            Liters
          </button>
        </div>

        <p className="water-goal-hint">
          {unit === 'glasses'
            ? `Tap how many glasses a day · 1 glass = ${WATER_GLASS_ML} ml`
            : 'Tap how many liters a day'}
        </p>

        <div className="water-goal-grid">
          {WATER_GOAL_OPTIONS.map((option) => {
            const isOn = selected === option.value;
            const glassCount = getWaterGlassCount(option.value);
            const primary = unit === 'glasses' ? String(glassCount) : option.label;
            const secondary =
              unit === 'glasses' ? `glasses · ${formatWaterLiters(option.value)}` : `${glassCount} glasses`;
            return (
              <button
                key={option.value}
                type="button"
                className={`water-goal-option ${isOn ? 'on' : ''}`}
                disabled={loading}
                aria-pressed={isOn}
                onClick={() => setSelected(option.value)}
              >
                <WaterGlass filled={isOn} size="sm" />
                <strong>{primary}</strong>
                <small>{secondary}</small>
                {option.recommended ? <em>Popular</em> : <em className="spacer" />}
              </button>
            );
          })}
        </div>

        <p className="water-goal-selected">
          {selected
            ? `Selected · ${glasses} glasses · ${formatWaterLiters(selected)} / day`
            : 'Pick one amount to continue'}
        </p>

        <div className="detail-cta">
          <button type="button" className="ghost" disabled={loading} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="cta"
            disabled={!selected || loading}
            onClick={() => selected && onConfirm(selected)}
          >
            {loading ? 'Starting…' : 'Start diet'}
          </button>
        </div>
      </div>
    </div>
  );
}
