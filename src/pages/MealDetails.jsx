import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { Images } from '../common/images';
import { requireAuth } from '../services/guestAuth';
import { updateDietPlanProgress } from '../services/dietService';
import { nowIso } from '../diet/utils';
import { showSuccessToast } from '../config/key';

export default function MealDetails() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const item = useLocation().state?.meal;
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(item?.status === 'done');

  if (!item) {
    return (
      <AppShell tab="home">
        <section className="catalog-page">
          <header className="catalog-head">
            <div>
              <button type="button" className="text-back" onClick={() => navigate(`/diet/${planId}`)}>
                ← Back
              </button>
              <h1>Meal</h1>
            </div>
          </header>
          <div className="empty-copy">
            <strong>Meal unavailable</strong>
            <p>Open this meal again from the diet plan.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const ingredients =
    Array.isArray(item.dietItemDetails) && item.dietItemDetails.length
      ? item.dietItemDetails
      : (item.dietItems || []).map((entry) => ({ name: entry, quantity: '', notes: '' }));
  const steps = item.preparationSteps || [];
  const videos = item.preparationVideos || [];

  const onLogMeal = async () => {
    if (!item.dayKey || !item.mealKey) {
      showSuccessToast('Meal details unavailable', 'error');
      return;
    }
    if (!(await requireAuth('Please login to log meals'))) return;
    try {
      setLogging(true);
      const markingDone = !logged;
      const res = await updateDietPlanProgress({
        day: item.dayKey,
        meal: item.mealKey,
        status: markingDone ? 'completed' : 'pending',
        completed_at: markingDone ? nowIso() : null,
      });
      if (res?.success === false) {
        showSuccessToast(res?.message || 'Unable to update meal', 'error');
        return;
      }
      setLogged(markingDone);
      showSuccessToast(markingDone ? 'Meal completed' : 'Meal unmarked', 'success');
    } catch (e) {
      showSuccessToast(e?.message || 'Unable to update meal', 'error');
    } finally {
      setLogging(false);
    }
  };

  return (
    <AppShell tab="home">
      <section className="catalog-page meal-page">
        <header className="catalog-head">
          <div>
            <button type="button" className="text-back" onClick={() => navigate(`/diet/${planId}`)}>
              ← Back
            </button>
            <h1>{item.title || 'Meal'}</h1>
            <p>{item.type}</p>
          </div>
        </header>

        <div className="diet-hero">
          <img src={item.image || Images.journeyDiet} alt="" />
        </div>

        <div className="diet-nutrition">
          <div>
            <strong>{item.kcal ?? '—'}</strong>
            <small>Calories</small>
          </div>
          <div>
            <strong>{item.carbs ?? 0}g</strong>
            <small>Carbs</small>
          </div>
          <div>
            <strong>{item.protein ?? 0}g</strong>
            <small>Protein</small>
          </div>
          <div>
            <strong>{item.fat ?? 0}g</strong>
            <small>Fat</small>
          </div>
        </div>

        {ingredients.length ? (
          <>
            <h3 className="yoga-section">Ingredients</h3>
            <ul className="meal-list">
              {ingredients.map((food, index) => (
                <li key={index}>
                  <strong>{food.name || food.label}</strong>
                  {food.quantity ? <small>{food.quantity}</small> : null}
                  {food.notes ? <p>{food.notes}</p> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {steps.length ? (
          <>
            <h3 className="yoga-section">Preparation</h3>
            <ol className="meal-steps">
              {steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </>
        ) : null}

        {videos.length ? (
          <>
            <h3 className="yoga-section">Prep videos</h3>
            <div className="diet-chips">
              {videos.map((url) => (
                <a key={url} className="chip" href={url} target="_blank" rel="noreferrer">
                  Watch video
                </a>
              ))}
            </div>
          </>
        ) : null}

        <div className="detail-cta">
          <button type="button" className="cta" disabled={logging} onClick={onLogMeal}>
            {logging ? 'Saving…' : logged ? 'Mark as pending' : 'Mark as done'}
          </button>
        </div>
      </section>
    </AppShell>
  );
}
