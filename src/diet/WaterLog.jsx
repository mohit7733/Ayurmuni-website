import { useEffect, useMemo, useState } from 'react';
import {
  WATER_GLASS_ML,
  buildWaterLiterGroups,
  countFilledWaterGlasses,
  formatWaterLiters,
  getWaterGlassCount,
  getWaterGlassEnds,
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
  const glassEnds = useMemo(() => getWaterGlassEnds(waterGoalMl), [waterGoalMl]);
  const literGroups = useMemo(() => buildWaterLiterGroups(waterGoalMl), [waterGoalMl]);
  const cardFilled = countFilledWaterGlasses(waterMl, waterGoalMl);
  const cardPct = Math.min(100, waterGoalMl > 0 ? Math.round((waterMl / waterGoalMl) * 100) : 0);
  const goalReached = waterMl >= waterGoalMl && waterGoalMl > 0;
  const cardFill = waterGoalMl > 0 ? Math.min(1, waterMl / waterGoalMl) : 0;

  const filledGlasses = countFilledWaterGlasses(draftMl, waterGoalMl);
  const progressPct = Math.min(100, waterGoalMl > 0 ? Math.round((draftMl / waterGoalMl) * 100) : 0);
  const fillRatio = waterGoalMl > 0 ? Math.min(1, draftMl / waterGoalMl) : 0;

  const applyIntake = (nextMl) => {
    const next = Math.max(0, Math.min(nextMl, waterGoalMl));
    setDraftMl(next);
    onSetIntake(next);
  };

  const onGlassPress = (glassIndex) => {
    if (updating) return;
    const endMl = glassEnds[glassIndex];
    if (endMl == null) return;
    const previousMl = glassIndex === 0 ? 0 : glassEnds[glassIndex - 1];
    applyIntake(draftMl + 0.001 >= endMl ? previousMl : endMl);
  };

  const onStep = (direction) => {
    if (updating) return;
    if (direction > 0) {
      const next = glassEnds.find((endMl) => endMl > draftMl + 0.001);
      applyIntake(next == null ? waterGoalMl : next);
      return;
    }
    const previous = [...glassEnds].reverse().find((endMl) => endMl < draftMl - 0.001);
    applyIntake(previous == null ? 0 : previous);
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
                  (glass) => draftMl + 0.001 >= glass.endMl,
                ).length;
                return (
                  <div key={group.id} className="water-log-liter">
                    <div>
                      <strong>{group.label}</strong>
                      <small>
                        {literFilled}/{group.glasses.length}
                      </small>
                    </div>
                    <div className="water-log-glasses">
                      {group.glasses.map((glass) => (
                        <WaterGlass
                          key={glass.index}
                          filled={draftMl + 0.001 >= glass.endMl}
                          disabled={updating}
                          label={`Glass ${glass.index + 1}, ${formatWaterLiters(glass.endMl)}`}
                          onClick={() => onGlassPress(glass.index)}
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
