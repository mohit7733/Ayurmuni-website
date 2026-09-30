import { calculateBmi } from './bmi';

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
            inputMode="decimal"
            placeholder="Enter height"
            value={heightValue}
            onChange={(e) => onChange(`${heightId}_height`, e.target.value)}
          />
          <span>cm</span>
        </div>
      </label>
      <label>
        Weight *
        <div className="unit-row">
          <input
            inputMode="decimal"
            placeholder="Enter weight"
            value={weightValue}
            onChange={(e) => onChange(`${heightId}_weight`, e.target.value)}
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
