import { calculateBmi } from './bmi';

/** Keep digits and at most one decimal point (blocks letters / symbols). */
const sanitizeDecimal = (value) => {
  const cleaned = String(value ?? '').replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const [whole, ...fractionParts] = cleaned.split('.');
  if (!fractionParts.length) return whole.slice(0, 5);
  return `${whole.slice(0, 5)}.${fractionParts.join('').replace(/\./g, '').slice(0, 2)}`;
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
            pattern="[0-9]*[.]?[0-9]*"
            autoComplete="off"
            placeholder="Enter height"
            value={heightValue}
            onChange={(e) => onChange(`${heightId}_height`, sanitizeDecimal(e.target.value))}
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
            pattern="[0-9]*[.]?[0-9]*"
            autoComplete="off"
            placeholder="Enter weight"
            value={weightValue}
            onChange={(e) => onChange(`${heightId}_weight`, sanitizeDecimal(e.target.value))}
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
