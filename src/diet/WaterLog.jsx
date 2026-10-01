import { useEffect, useMemo, useState } from 'react';
import {
  WATER_GLASS_ML,
  WATER_LITER_ML,
  formatWaterLiters,
  getWaterGlassCount,
} from './utils';

export function WaterGlass({ filled, fillRatio, size = 'sm', disabled, onClick, label }) {
  const ratio = typeof fillRatio === 'number' ? Math.max(0, Math.min(1, fillRatio)) : filled ? 0.74 : 0.1;
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`water-glass water-glass-${size} ${ratio > 0.12 ? 'on' : ''}`}
      disabled={disabled}
      aria-pressed={onClick ? Boolean(filled) : undefined}
      aria-label={label}
      onClick={onClick}
    >
      <i style={{ height: `${Math.round(ratio * 74)}%` }} />
    </Tag>
  );
}

export default function WaterLog({ waterMl, waterGoalMl, dayLabel, updating, onSetIntake }) {
  const [open, setOpen] = useState(false);
  const [draftMl, setDraftMl] = useState(waterMl);

  useEffect(() => {
    if (open) setDraftMl(waterMl);
    // Keep the draft after the API updates waterMl while the dialog stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalGlasses = getWaterGlassCount(waterGoalMl);
  const cardFilled = Math.floor(waterMl / WATER_GLASS_ML);
  const cardPct = Math.min(100, waterGoalMl > 0 ? Math.round((waterMl / waterGoalMl) * 100) : 0);
  const goalReached = waterMl >= waterGoalMl && waterGoalMl > 0;
  const cardFill = waterGoalMl > 0 ? Math.min(1, waterMl / waterGoalMl) : 0;

  const filledGlasses = Math.floor(draftMl / WATER_GLASS_ML);
  const progressPct = Math.min(100, waterGoalMl > 0 ? Math.round((draftMl / waterGoalMl) * 100) : 0);
  const fillRatio = waterGoalMl > 0 ? Math.min(1, draftMl / waterGoalMl) : 0;
  const literCount = Math.ceil((Number(waterGoalMl) || 0) / WATER_LITER_ML);

  const literGroups = useMemo(() => {
    const groups = [];
    for (let liter = 1; liter <= literCount; liter += 1) {
      const startIndex = (liter - 1) * 4;
      const endIndex = Math.min(startIndex + 4, totalGlasses);
      const glasses = [];
      for (let i = startIndex; i < endIndex; i += 1) glasses.push(i);
      if (glasses.length) groups.push({ liter, glasses });
    }
    return groups;
  }, [literCount, totalGlasses]);

  const applyIntake = (nextMl) => {
    const next = Math.max(0, Math.min(nextMl, waterGoalMl));
    setDraftMl(next);
    onSetIntake(next);
  };

  const onGlassPress = (glassIndex) => {
    if (updating) return;
    const targetMl = (glassIndex + 1) * WATER_GLASS_ML;
    applyIntake(draftMl >= targetMl ? targetMl - WATER_GLASS_ML : targetMl);
  };

  const onStep = (direction) => {
    if (updating) return;
    applyIntake(draftMl + direction * WATER_GLASS_ML);
  };

  return (
    <>
      <button type="button" className="diet-water" onClick={() => setOpen(true)}>
        <WaterGlass filled={cardFill > 0} fillRatio={cardFill} size="xs" />
        <span className="diet-water-copy">
          <span className="diet-water-title">
            <strong>Hydration</strong>
            <small>
              {formatWaterLiters(waterMl)} / {formatWaterLiters(waterGoalMl)}
            </small>
          </span>
          <span className="diet-water-track" aria-hidden="true">
            <i style={{ width: `${cardPct}%` }} />
          </span>
          <span className="diet-water-meta">
            {dayLabel ? `${dayLabel} · ` : ''}
            {cardFilled}/{totalGlasses} glasses
            {goalReached ? ' · Goal reached' : ` · ${cardPct}%`}
          </span>
        </span>
        <span className={`diet-water-action ${goalReached ? 'done' : ''}`}>{goalReached ? 'Done' : 'Log'}</span>
      </button>

      {open ? (
        <div className="web-modal" role="dialog" aria-modal="true" aria-labelledby="water-log-title">
          <button type="button" className="water-log-backdrop" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="web-modal-card water-log-card">
            <div className="water-log-head">
              <div>
                <h3 id="water-log-title">Log water</h3>
                <p>
                  {dayLabel ? `${dayLabel} · ` : ''}1 glass = {WATER_GLASS_ML} ml
                </p>
              </div>
              <button type="button" className="ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="water-log-summary">
              <WaterGlass
                filled={fillRatio > 0}
                fillRatio={Math.max(fillRatio, fillRatio > 0 ? 0.18 : 0)}
                size="md"
              />
              <div>
                <strong>
                  {formatWaterLiters(draftMl)}
                  <small> / {formatWaterLiters(waterGoalMl)}</small>
                </strong>
                <p>
                  {filledGlasses}/{totalGlasses} glasses · {progressPct}%
                </p>
              </div>
              <div className="water-log-step">
                <button type="button" className="ghost" disabled={updating || draftMl <= 0} onClick={() => onStep(-1)}>
                  −
                </button>
                <button
                  type="button"
                  className="cta"
                  disabled={updating || draftMl >= waterGoalMl}
                  onClick={() => onStep(1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="diet-water-track" aria-hidden="true">
              <i style={{ width: `${progressPct}%` }} />
            </div>

            <div className="water-log-liters">
              {literGroups.map((group) => {
                const literFilled = group.glasses.filter(
                  (glassIndex) => draftMl >= (glassIndex + 1) * WATER_GLASS_ML,
                ).length;
                return (
                  <div key={group.liter} className="water-log-liter">
                    <div>
                      <strong>{group.liter} L</strong>
                      <small>
                        {literFilled}/{group.glasses.length}
                      </small>
                    </div>
                    <div className="water-log-glasses">
                      {group.glasses.map((glassIndex) => (
                        <WaterGlass
                          key={glassIndex}
                          filled={draftMl >= (glassIndex + 1) * WATER_GLASS_ML}
                          disabled={updating}
                          label={`Glass ${glassIndex + 1}`}
                          onClick={() => onGlassPress(glassIndex)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button" className="cta water-log-done" disabled={updating} onClick={() => setOpen(false)}>
              {updating ? 'Saving…' : 'Done'}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
