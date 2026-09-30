const classify = (bmi) => {
  if (bmi < 18.5) {
    return { label: 'Underweight', hint: 'Below the healthy range', tone: '#0F766E', bg: '#E7F6F1' };
  }
  if (bmi < 25) {
    return { label: 'Healthy', hint: 'Within the healthy range', tone: '#0D614E', bg: '#E7F6F1' };
  }
  if (bmi < 30) {
    return { label: 'Overweight', hint: 'Above the healthy range', tone: '#B45309', bg: '#FEF3C7' };
  }
  return { label: 'Obese', hint: 'Well above the healthy range', tone: '#B91C1C', bg: '#FEE2E2' };
};

const toCentimeters = (raw) => {
  if (!(raw > 0)) return null;
  if (raw > 30 && raw < 280) return raw;
  if (raw > 0.9 && raw < 2.6) return raw * 100;
  if (raw >= 3 && raw < 8.5) return raw * 30.48;
  return null;
};

export const calculateBmi = (heightInput, weightKg) => {
  const heightCm = toCentimeters(heightInput);
  if (heightCm == null || !(weightKg > 0) || weightKg > 400) return null;
  const meters = heightCm / 100;
  const bmi = weightKg / (meters * meters);
  if (!Number.isFinite(bmi) || bmi < 8 || bmi > 80) return null;
  const value = Math.round(bmi * 10) / 10;
  return { value, ...classify(value) };
};
