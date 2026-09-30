import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { Images } from '../common/images';
import useDietPlans from '../diet/useDietPlans';

const DEMO_MEALS = [
  { id: 'demo-breakfast', type: 'Breakfast', name: 'Berry Acai Bowl', kcal: 420, tags: ['High Fiber', 'Plant-based'] },
  { id: 'demo-lunch', type: 'Lunch', name: 'Berry Acai Bowl', kcal: 420, tags: ['High Fiber', 'Plant-based'] },
  { id: 'demo-snacks', type: 'Snacks', name: 'Almond & Apple', kcal: 420, tags: ['High Fiber', 'Plant-based'] },
];

const DEMO_MACROS = [
  { label: 'Protein', value: '124g', total: '150g' },
  { label: 'Carbs', value: '210g', total: '250g' },
];

const generateDates = (daysBefore = 3, daysAfter = 10) => {
  const today = new Date();
  const dates = [];
  for (let i = -daysBefore; i <= daysAfter; i += 1) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    dates.push({
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate(),
      fullDate: d.toDateString(),
      isToday: i === 0,
    });
  }
  return dates;
};

const formatKcal = (value) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function WeeklyMeal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { planId } = useParams();
  const resolvedId = planId || location.state?.planId || location.state?.item?.id || null;
  const dates = useMemo(() => generateDates(), []);
  const [selectedDate, setSelectedDate] = useState(
    dates.find((item) => item.isToday)?.fullDate,
  );

  const {
    planDetail,
    selectedSummary,
    meals,
    nutrition,
    planDays,
    currentDayKey,
    selectDay,
    loadingDetail,
    isStarted,
  } = useDietPlans({ initialPlanId: resolvedId });

  const plan = planDetail || selectedSummary || location.state?.item;
  const hasPlan = Boolean(resolvedId && plan);
  const eaten = hasPlan ? Number(nutrition.eatenKcal) || 0 : 1840;
  const goal = hasPlan ? Number(nutrition.goalKcal) || 2200 : 2200;
  const percent = goal > 0 ? Math.min(100, Math.round((eaten / goal) * 100)) : 0;

  const macros = hasPlan
    ? [
        {
          label: 'Protein',
          value: `${Math.round(nutrition.proteinG || 0)}g`,
          total: `${Math.round(meals.reduce((sum, item) => sum + (Number(item.protein) || 0), 0) || 150)}g`,
        },
        {
          label: 'Carbs',
          value: `${Math.round(nutrition.carbsG || 0)}g`,
          total: `${Math.round(meals.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0) || 250)}g`,
        },
      ]
    : DEMO_MACROS;

  const displayMeals = hasPlan
    ? meals.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.title,
        kcal: item.kcal,
        image: item.image,
        tags: (item.dietItems || []).slice(0, 2),
        raw: item,
      }))
    : DEMO_MEALS;

  const openMeal = (item) => {
    if (!item?.raw || !resolvedId) return;
    navigate(`/diet/${resolvedId}/meals/${item.id}`, {
      state: { meal: item.raw, planId: resolvedId },
    });
  };

  const backTo = resolvedId ? `/diet/${resolvedId}` : '/diet';

  return (
    <AppShell tab="home">
      <section className="catalog-page weekly-meal">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(backTo)}>
            ← Back
          </button>
          <div>
            <h1>Meal Details</h1>
            <p>{plan?.title || plan?.name || 'Weekly planner'}</p>
          </div>
        </header>

        <h2 className="weekly-title">Weekly Planner</h2>

        {loadingDetail && resolvedId && !plan ? (
          <p className="muted">Loading plan…</p>
        ) : (
          <>
            <div className="weekly-energy">
              <div>
                <small>Daily Energy</small>
                <p>
                  <strong>{formatKcal(eaten)}</strong>
                  <span> / {formatKcal(goal)} kcal</span>
                </p>
              </div>
              <em>{percent}%</em>
              <i>
                <b style={{ width: `${percent}%` }} />
              </i>
            </div>

            <div className="weekly-macros">
              {macros.map((item) => (
                <div key={item.label}>
                  <small>{item.label}</small>
                  <p>
                    <strong>{item.value}</strong>
                    <span>of {item.total}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="weekly-days">
              {hasPlan
                ? planDays.map((day) => (
                    <button
                      key={day.dayKey}
                      type="button"
                      className={`${day.dayKey === currentDayKey ? 'on' : ''} ${day.isLocked ? 'locked' : ''}`}
                      disabled={day.isLocked}
                      onClick={() => selectDay(day.dayKey)}
                    >
                      <small>{day.label}</small>
                      <strong>
                        {day.mealsDone}/{day.mealsTotal}
                      </strong>
                    </button>
                  ))
                : dates.map((item) => (
                    <button
                      key={item.fullDate}
                      type="button"
                      className={selectedDate === item.fullDate ? 'on' : ''}
                      onClick={() => setSelectedDate(item.fullDate)}
                    >
                      <small>{item.day}</small>
                      <strong>{item.date}</strong>
                    </button>
                  ))}
            </div>

            <h3 className="yoga-section">Today&apos;s Meals</h3>
            {displayMeals.length === 0 ? (
              <p className="muted">
                {isStarted
                  ? 'No meals for this day yet.'
                  : 'Start a diet plan to fill this week, or browse the sample meals below.'}
              </p>
            ) : (
              displayMeals.map((item) => {
                const MealTag = item.raw ? 'button' : 'div';
                return (
                  <MealTag
                    key={item.id}
                    type={item.raw ? 'button' : undefined}
                    className="weekly-meal-card"
                    onClick={item.raw ? () => openMeal(item) : undefined}
                  >
                    <img src={item.image || Images.journeyDiet} alt="" />
                    <div>
                      <div className="weekly-meal-top">
                        <small>{item.type}</small>
                        {item.kcal != null ? <span>{item.kcal} kcal</span> : null}
                      </div>
                      <strong>{item.name}</strong>
                      <div className="weekly-tags">
                        {(item.tags?.length ? item.tags : ['High Fiber', 'Plant-based']).map((tag) => (
                          <em key={tag}>{tag}</em>
                        ))}
                      </div>
                    </div>
                  </MealTag>
                );
              })
            )}

            <div className="weekly-plan-dinner">
              <span>+</span>
              <p>Plan Dinner</p>
            </div>

            <button type="button" className="cta" onClick={() => navigate('/yoga')}>
              Smart Auto-Fill Week
            </button>
          </>
        )}
      </section>
    </AppShell>
  );
}
