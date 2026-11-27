import { calculateBmi } from './bmi';

/**
 * Digits + optional decimal only, with short limits so users can't paste huge numbers.
 * Height: up to 3 digits + 1 decimal (e.g. 172.5). Weight: up to 3 digits + 1 decimal (e.g. 75.5).
 */
const sanitizeDecimal = (value, { maxWhole = 3, maxFraction = 1 } = {}) => {
  const cleaned = String(value ?? '').replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const [wholeRaw, ...fractionParts] = cleaned.split('.');
  const whole = wholeRaw.slice(0, maxWhole);
  if (!fractionParts.length) return whole;
  const fraction = fractionParts.join('').replace(/\./g, '').slice(0, maxFraction);
  return fraction ? `${whole}.${fraction}` : `${whole}.`;
};

export default function BasicInfoForm({ questions, selectedAnswers, onChange }) {
  const heightQuestion = questions.find((item) => {
    const q = item?.question?.toLowerCase?.() ?? '';
    return q.includes('height') || q.includes('weight') || q.includes('body');
  });
  const heightId = heightQuestion ? String(heightQuestion.id) : '';
  const heightValue = selectedAnswers?.[`${heightId}_height`] || '';
  const weightValue = selectedAnswers?.[`${heightId}_weight`] || '';
  const bmi = calculateBmi(Number(heightValue), Number(weightValue));

  if (!heightId) return null;

  return (
    <div className="basic-info">
      <label>
        Height *
        <div className="unit-row">
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]{1,3}([.][0-9])?"
            maxLength={5}
            autoComplete="off"
            placeholder="e.g. 172"
            value={heightValue}
            onChange={(e) =>
              onChange(`${heightId}_height`, sanitizeDecimal(e.target.value, { maxWhole: 3, maxFraction: 1 }))
            }
          />
          <span>cm</span>
        </div>
      </label>
      <label>
        Weight *
        <div className="unit-row">
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]{1,3}([.][0-9])?"
            maxLength={5}
            autoComplete="off"
            placeholder="e.g. 75"
            value={weightValue}
            onChange={(e) =>
              onChange(`${heightId}_weight`, sanitizeDecimal(e.target.value, { maxWhole: 3, maxFraction: 1 }))
            }
          />
          <span>kg</span>
        </div>
      </label>
      {bmi ? (
        <div className="bmi-card" style={{ background: bmi.bg, color: bmi.tone }}>
          <strong>BMI {bmi.value}</strong>
          <span>
            {bmi.label} · {bmi.hint}
          </span>
        </div>
      ) : null}
    </div>
  );
}
