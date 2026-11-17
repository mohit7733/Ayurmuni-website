import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChefHat,
  ChevronRight,
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
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  MetaChip,
  StatGrid,
  Steps,
} from '../components/detail/Detail';
import dietCoverImg from '/images/login/14.webp';
import { requireAuth } from '../services/guestAuth';
import { getDietPlanProgress, getDietPlans, getMyDietPlans, updateDietPlanProgress } from '../services/dietService';
import {
  extractDietPlanDetail,
  getDietListStatus,
  mapPlanJsonMeals,
  normalizeDietPlanList,
  normalizeProgressList,
  nowIso,
} from '../diet/utils';
import { showSuccessToast } from '../config/key';
import '../design/pages/diet-brand.css';

const grams = (value) => `${value}g`;
const amount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const splitMealId = (mealId) => {
  const match = String(mealId || '').match(/^(day_\d+)-(.+)$/i);
  if (!match) return null;
  return { dayKey: match[1], mealKey: match[2] };
};

export default function MealDetails() {
  const navigate = useNavigate();
  const { planId, mealId } = useParams();
  const routeState = useLocation().state || {};
  const seeded = routeState.meal || null;
  const [item, setItem] = useState(seeded);
  const [loading, setLoading] = useState(!seeded);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(seeded?.status === 'done');
  const [canLog, setCanLog] = useState(routeState.planActive === true);
  const planPath = `/diet/${planId}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getMyDietPlans({
          page: 1,
          page_size: 50,
          patient_assignment_status: 'active',
        });
        const active = res?.success === false ? [] : normalizeDietPlanList(res);
        const match = active.some((plan) => {
          const id = String(plan.diet_plan_id || plan.id || '');
          return id === String(planId) && getDietListStatus(plan) === 'active';
        });
        if (alive) setCanLog(match);
      } catch {
        if (alive) setCanLog(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [planId]);

  useEffect(() => {
    if (seeded) return undefined;
    const parts = splitMealId(mealId);
    if (!planId || !parts) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const detail = extractDietPlanDetail(await getDietPlans({ id: planId }));
        let progress = [];
        if (detail?.patient_diet_plan_id) {
          try {
            progress = normalizeProgressList(await getDietPlanProgress(detail.patient_diet_plan_id));
          } catch {
            progress = [];
          }
        }
        const meal = mapPlanJsonMeals(detail, parts.dayKey, progress).find(
          (entry) => entry.id === mealId || entry.mealKey === parts.mealKey,
        );
        if (!alive) return;
        setItem(meal || null);
        setLogged(meal?.status === 'done');
      } catch {
        if (alive) setItem(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mealId, planId, seeded]);

  if (loading) {
    return (
      <AppShell tab="home">
        <DetailPage className="meal-page">
          <DetailTop backTo={planPath} backLabel="Diet plan" />
          <DetailSkeleton label="Loading meal" />
        </DetailPage>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell tab="home">
        <DetailPage className="meal-page">
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
  const kcal = amount(item.kcal);
  const nutrition = [
    kcal ? { label: 'Calories', value: String(kcal) } : null,
    amount(item.carbs) ? { label: 'Carbs', value: grams(amount(item.carbs)) } : null,
    amount(item.protein) ? { label: 'Protein', value: grams(amount(item.protein)) } : null,
    amount(item.fat) ? { label: 'Fat', value: grams(amount(item.fat)) } : null,
  ].filter(Boolean);

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
      <DetailPage className="meal-page">
        <DetailTop backTo={planPath} backLabel="Diet plan" />

        <DetailHero
          className="meal-page__hero"
          titleId="meal-title"
          media={<img src={item.image || dietCoverImg} alt="" />}
          eyebrow={[item.type, item.time].filter(Boolean).join(' · ') || 'Meal'}
          title={item.title || 'Meal'}
          lede={item.description || ''}
          chips={
            <>
              {kcal ? (
                <MetaChip icon={Flame} tone="gold">
                  {kcal} kcal
                </MetaChip>
              ) : null}
              {ingredients.length ? (
                <MetaChip icon={Leaf}>
                  {ingredients.length} {ingredients.length === 1 ? 'ingredient' : 'ingredients'}
                </MetaChip>
              ) : null}
              {canLog && logged ? <MetaChip icon={CheckCircle2}>Logged</MetaChip> : null}
            </>
          }
        >
          {canLog ? (
            <div className="meal-page__log">
              <Button
                variant={logged ? 'secondary' : 'primary'}
                loading={logging}
                aria-pressed={logged}
                leadingIcon={<CheckCircle2 size={16} aria-hidden />}
                onClick={onLogMeal}
              >
                {logged ? 'Logged · undo' : 'Mark as done'}
              </Button>
            </div>
          ) : null}
        </DetailHero>

        <DetailLayout>
          {nutrition.length ? (
            <DetailCard id="meal-nutrition" title="Nutrition" icon={Wheat} meta="Per serving">
              <StatGrid items={nutrition} />
            </DetailCard>
          ) : null}

          {ingredients.length ? (
            <DetailCard
              id="meal-ingredients"
              title="What to eat"
              icon={Utensils}
              meta={`${ingredients.length} ${ingredients.length === 1 ? 'item' : 'items'}`}
            >
              <ul className="dx-ingredients">
                {ingredients.map((food, index) => (
                  <li key={`${food.name || food.label}-${index}`}>
                    <span className="dx-ingredients__icon" aria-hidden>
                      {index + 1}
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
            <DetailCard id="meal-preparation" title="How to prepare" icon={ChefHat} meta={`${steps.length} steps`}>
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
