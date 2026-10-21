import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Circle,
  Flame,
  Leaf,
  PlayCircle,
  Salad,
  Utensils,
  Wheat,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { Button } from '../components/ui';
import {
  ActionStack,
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailPage,
  DetailTop,
  MetaChip,
  StatGrid,
  Steps,
} from '../components/detail/Detail';
import dietCoverImg from '/images/login/14.webp';
import { requireAuth } from '../services/guestAuth';
import { updateDietPlanProgress } from '../services/dietService';
import { nowIso } from '../diet/utils';
import { showSuccessToast } from '../config/key';

const grams = (value) => (value == null || value === '' ? '' : `${value}g`);

export default function MealDetails() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const item = useLocation().state?.meal;
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(item?.status === 'done');
  const planPath = `/diet/${planId}`;

  if (!item) {
    return (
      <AppShell tab="home">
        <DetailPage>
          <DetailTop backTo={planPath} backLabel="Diet plan" />
          <DetailEmpty
            icon={Salad}
            title="Meal unavailable"
            text="Open this meal again from your diet plan to see its recipe and nutrition."
            action={<Button onClick={() => navigate(planPath)}>Back to plan</Button>}
          />
        </DetailPage>
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

  const logButton = (
    <Button
      variant={logged ? 'secondary' : 'primary'}
      loading={logging}
      aria-pressed={logged}
      leadingIcon={logged ? <Circle size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
      onClick={onLogMeal}
    >
      {logged ? 'Mark as pending' : 'Mark as done'}
    </Button>
  );

  return (
    <AppShell tab="home">
      <DetailPage>
        <DetailTop backTo={planPath} backLabel="Diet plan" />

        <DetailHero
          titleId="meal-title"
          media={<img src={item.image || dietCoverImg} alt="" />}
          eyebrow={item.type || 'Meal'}
          title={item.title || 'Meal'}
          lede={
            item.description ||
            'Prepared fresh and balanced for your prakriti. Follow the recipe below and log it once you have eaten.'
          }
          chips={
            <>
              {item.kcal != null && item.kcal !== '' ? (
                <MetaChip icon={Flame} tone="gold">
                  {item.kcal} kcal
                </MetaChip>
              ) : null}
              {ingredients.length ? (
                <MetaChip icon={Leaf}>
                  {ingredients.length} {ingredients.length === 1 ? 'ingredient' : 'ingredients'}
                </MetaChip>
              ) : null}
              {logged ? (
                <MetaChip icon={CheckCircle2} tone="plain">
                  Completed
                </MetaChip>
              ) : null}
            </>
          }
        >
          <div className="dx-actions dx-actions--row">{logButton}</div>
        </DetailHero>

        <DetailLayout
          aside={
            <>
              <DetailCard id="meal-nutrition" title="Nutrition" icon={Wheat} meta="Per serving">
                <StatGrid
                  items={[
                    { label: 'Calories', value: item.kcal != null && item.kcal !== '' ? `${item.kcal}` : '—' },
                    { label: 'Carbs', value: grams(item.carbs ?? 0) },
                    { label: 'Protein', value: grams(item.protein ?? 0) },
                    { label: 'Fat', value: grams(item.fat ?? 0) },
                  ]}
                />
              </DetailCard>
              <ActionStack>
                {logButton}
                <Button variant="secondary" onClick={() => navigate(planPath)}>
                  Back to plan
                </Button>
              </ActionStack>
            </>
          }
        >
          {ingredients.length ? (
            <DetailCard id="meal-ingredients" title="Ingredients" icon={Utensils} meta={`${ingredients.length} items`}>
              <ul className="dx-ingredients">
                {ingredients.map((food, index) => (
                  <li key={`${food.name || food.label}-${index}`}>
                    <span className="dx-ingredients__icon" aria-hidden>
                      <Leaf size={14} />
                    </span>
                    <span className="dx-ingredients__copy">
                      <strong>{food.name || food.label}</strong>
                      {food.notes ? <small>{food.notes}</small> : null}
                    </span>
                    {food.quantity ? <span className="dx-ingredients__qty">{food.quantity}</span> : null}
                  </li>
                ))}
              </ul>
            </DetailCard>
          ) : null}

          {steps.length ? (
            <DetailCard id="meal-preparation" title="Preparation" icon={ChefHat} meta={`${steps.length} steps`}>
              <div className="dx-steps--solid">
                <Steps items={steps.map((step, index) => ({ id: index, text: step }))} />
              </div>
            </DetailCard>
          ) : null}

          {videos.length ? (
            <DetailCard id="meal-videos" title="Prep videos" icon={PlayCircle}>
              <div className="dx-actions">
                {videos.map((url, index) => (
                  <a key={url} className="dx-link" href={url} target="_blank" rel="noreferrer">
                    <span className="dx-link__icon" aria-hidden>
                      <PlayCircle size={18} />
                    </span>
                    <span className="dx-link__copy">
                      <strong>Watch video {videos.length > 1 ? index + 1 : ''}</strong>
                      <span>Opens in a new tab</span>
                    </span>
                    <ChevronRight className="dx-link__chev" size={18} aria-hidden />
                  </a>
                ))}
              </div>
            </DetailCard>
          ) : null}

          {!ingredients.length && !steps.length ? (
            <DetailCard id="meal-empty" title="Recipe" icon={ChefHat}>
              <p className="dx-prose">Your nutritionist has not added a recipe for this meal yet.</p>
            </DetailCard>
          ) : null}
        </DetailLayout>
      </DetailPage>
    </AppShell>
  );
}
