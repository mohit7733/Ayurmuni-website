import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { Images } from '../common/images';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';
import useDietPlans from '../diet/useDietPlans';
import {
  canShowDietPlanRateButton,
  WATER_GLASS_ML,
  WATER_GOAL_OPTIONS,
  formatWaterLiters,
  getDietListStatus,
  getDietPlanGallery,
  getDietPlanRatingLabel,
  getPlanJsonDays,
  getWaterGoalMl,
  mapPlanJsonMeals,
} from '../diet/utils';
import {
  hydrateReviewedDietPlans,
  isDietPlanAssignmentReviewed,
} from '../utils/reviewedDietPlans';

const MACRO = [
  { key: 'carbsPct', label: 'Carbs', color: '#1FA77A' },
  { key: 'proteinPct', label: 'Protein', color: '#2F6BDE' },
  { key: 'fatPct', label: 'Fat', color: '#F4B400' },
];

export default function DietPlan() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const location = useLocation();
  const routeItem = location.state?.item || null;
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [waterModal, setWaterModal] = useState(false);
  const [waterGoal, setWaterGoal] = useState(3000);
  const [confirm, setConfirm] = useState(null);
  const [conflict, setConflict] = useState(null);

  const {
    planDetail,
    selectedSummary,
    meals,
    nutrition,
    waterMl,
    updatingWater,
    planDays,
    currentDayKey,
    selectDay,
    isStarted,
    loadingDetail,
    starting,
    startPlan,
    updateWaterIntake,
    pausePlan,
    stopPlan,
    repeatPlan,
    pauseActiveAndStart,
    updatingStatus,
    patientDietPlanId,
  } = useDietPlans({ initialPlanId: planId || routeItem?.id || null });

  const plan = planDetail || selectedSummary || routeItem;
  const gallery = useMemo(() => getDietPlanGallery(plan), [plan]);
  const previewMeals = useMemo(() => {
    if (isStarted) return meals;
    if (!planDetail) return [];
    const day = getPlanJsonDays(planDetail)[0] || 'day_1';
    return mapPlanJsonMeals(planDetail, day, []);
  }, [isStarted, meals, planDetail]);
  const cover = gallery[galleryIndex]?.image_url || gallery[0]?.image_url || Images.journeyDiet;
  const rating = getDietPlanRatingLabel(plan);
  const price =
    plan?.is_paid === false || Number(plan?.price) === 0 ? 'Free' : formatRupee(plan?.price);
  const status = getDietListStatus(plan);
  const waterGoalMl = getWaterGoalMl(plan);
  const [dietReviewed, setDietReviewed] = useState(false);

  useEffect(() => {
    (async () => {
      await hydrateReviewedDietPlans();
      setDietReviewed(
        isDietPlanAssignmentReviewed(patientDietPlanId || plan?.patient_diet_plan_id),
      );
    })();
  }, [patientDietPlanId, plan?.patient_diet_plan_id, location.key]);

  const canRateDiet =
    status === 'completed' && canShowDietPlanRateButton(plan) && !dietReviewed;

  const openDietReview = () => {
    const assignmentId = patientDietPlanId || plan?.patient_diet_plan_id;
    if (!assignmentId) {
      showSuccessToast('No completed diet plan found to review', 'error');
      return;
    }
    if (!canShowDietPlanRateButton(plan)) {
      showSuccessToast('You have already reviewed this diet plan', 'error');
      return;
    }
    navigate('/share-experience', {
      state: {
        entityType: 'diet_plan',
        entityName: plan?.name || plan?.title || 'Diet Plan',
        entitySubtitle: 'How was this diet plan?',
        patientDietPlanId: String(assignmentId),
        dietPlanId: planId ? String(planId) : undefined,
      },
    });
  };

  const runStart = async (options) => {
    const result = await startPlan(planId, options);
    if (result?.conflict) {
      setConflict({
        activeName: result.activePlan?.name || 'another plan',
        activeId: result.activePlan?.patient_diet_plan_id,
        catalogId: planId,
        waterGoal: options?.daily_water_intake_goal,
      });
    }
  };

  const onStart = () => {
    if (status === 'paused') {
      runStart();
      return;
    }
    if (status === 'completed') {
      setConfirm({
        title: 'Repeat this plan?',
        subtitle: 'Starts a new run from Day 1.',
        confirmText: 'Repeat',
        action: 'repeat',
      });
      return;
    }
    setWaterModal(true);
  };

  return (
    <AppShell tab="home">
      <section className="catalog-page diet-detail">
        <header className="catalog-head">
          <div>
            <button type="button" className="text-back" onClick={() => navigate('/diet')}>
              ← Back
            </button>
            <h1>{plan?.title || plan?.name || 'Diet Plan'}</h1>
            <p>{[plan?.prakriti, plan?.season, price].filter(Boolean).join(' • ') || 'Personalized meals'}</p>
          </div>
        </header>

        {loadingDetail && !plan ? (
          <p className="muted">Loading plan…</p>
        ) : (
          <>
            <div className="diet-hero">
              <img src={cover} alt="" />
            </div>
            {gallery.length > 1 ? (
              <div className="gallery-thumbs">
                {gallery.map((item, index) => (
                  <button
                    key={`${item.image_url}-${index}`}
                    type="button"
                    className={index === galleryIndex ? 'on' : ''}
                    onClick={() => setGalleryIndex(index)}
                  >
                    <img src={item.image_url} alt="" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="yoga-badges">
              {status !== 'not_started' ? (
                <span className={`yoga-badge ${status === 'active' ? 'level' : ''}`}>
                  {status.toUpperCase()}
                </span>
              ) : null}
              {rating ? <span className="yoga-badge">★ {rating}</span> : null}
              {plan?.duration || plan?.duration_days ? (
                <span className="yoga-badge">{plan.duration || `${plan.duration_days} days`}</span>
              ) : null}
            </div>

            {plan?.short_description ? <p className="yoga-subtitle">{plan.short_description}</p> : null}

            {isStarted ? (
              <>
                <div className="diet-nutrition">
                  <div>
                    <strong>{Math.round(nutrition.eatenKcal)}</strong>
                    <small>eaten</small>
                  </div>
                  <div>
                    <strong>{Math.round(nutrition.leftKcal)}</strong>
                    <small>left</small>
                  </div>
                  <div>
                    <strong>
                      {nutrition.mealsDone}/{nutrition.mealsTotal}
                    </strong>
                    <small>meals</small>
                  </div>
                </div>
                <div className="diet-macros">
                  {MACRO.map((item) => (
                    <div key={item.key}>
                      <span>{item.label}</span>
                      <b style={{ color: item.color }}>{nutrition[item.key]}%</b>
                      <i style={{ width: `${nutrition[item.key]}%`, background: item.color }} />
                    </div>
                  ))}
                </div>

                <div className="diet-water">
                  <div>
                    <strong>Hydration</strong>
                    <small>
                      {formatWaterLiters(waterMl)} / {formatWaterLiters(waterGoalMl)}
                    </small>
                  </div>
                  <div className="diet-water-actions">
                    <button
                      type="button"
                      className="ghost"
                      disabled={updatingWater || waterMl <= 0}
                      onClick={() => updateWaterIntake(waterMl - WATER_GLASS_ML)}
                    >
                      − Glass
                    </button>
                    <button
                      type="button"
                      className="cta"
                      disabled={updatingWater || waterMl >= waterGoalMl}
                      onClick={() => updateWaterIntake(waterMl + WATER_GLASS_ML)}
                    >
                      + Glass
                    </button>
                  </div>
                </div>

                <div className="diet-days">
                  {planDays.map((day) => (
                    <button
                      key={day.dayKey}
                      type="button"
                      className={`${day.dayKey === currentDayKey ? 'on' : ''} ${day.isLocked ? 'locked' : ''}`}
                      disabled={day.isLocked}
                      onClick={() => selectDay(day.dayKey)}
                    >
                      {day.label}
                      <small>
                        {day.mealsDone}/{day.mealsTotal}
                      </small>
                    </button>
                  ))}
                </div>

                <div className="diet-meals">
                  {previewMeals.map((meal) => (
                    <button
                      key={meal.id}
                      type="button"
                      className={`diet-meal ${meal.status === 'done' ? 'done' : ''}`}
                      onClick={() => navigate(`/diet/${planId}/meals/${meal.id}`, { state: { meal, planId } })}
                    >
                      <img src={meal.image || Images.journeyDiet} alt="" />
                      <div>
                        <small>{meal.type}</small>
                        <strong>{meal.title}</strong>
                        <p>{meal.kcal ? `${meal.kcal} kcal` : meal.time}</p>
                      </div>
                      <span>{meal.status === 'done' ? 'Done' : 'Open'}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="muted">Start this plan to unlock daily tracking and hydration.</p>
                {previewMeals.length ? (
                  <div className="diet-meals">
                    {previewMeals.map((meal) => (
                      <button
                        key={meal.id}
                        type="button"
                        className="diet-meal"
                        onClick={() =>
                          navigate(`/diet/${planId}/meals/${meal.id}`, { state: { meal, planId } })
                        }
                      >
                        <img src={meal.image || Images.journeyDiet} alt="" />
                        <div>
                          <small>{meal.type}</small>
                          <strong>{meal.title}</strong>
                          <p>{meal.kcal ? `${meal.kcal} kcal` : meal.time}</p>
                        </div>
                        <span>View</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            <div className="detail-cta diet-cta">
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  navigate(`/diet/${planId}/weekly`, { state: { item: plan, planId } })
                }
              >
                Weekly planner
              </button>
              {isStarted ? (
                <>
                  <button
                    type="button"
                    className="ghost"
                    disabled={updatingStatus}
                    onClick={() =>
                      setConfirm({
                        title: 'Pause this active plan?',
                        subtitle: 'Progress is saved. You can resume anytime.',
                        confirmText: 'Pause plan',
                        action: 'pause',
                      })
                    }
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={updatingStatus}
                    onClick={() =>
                      setConfirm({
                        title: 'Stop this run?',
                        subtitle: 'Stopped plans use Start again instead of Repeat.',
                        confirmText: 'Stop plan',
                        action: 'stop',
                      })
                    }
                  >
                    Stop
                  </button>
                </>
              ) : (
                <button type="button" className="cta" disabled={starting || updatingStatus} onClick={onStart}>
                  {starting
                    ? 'Starting…'
                    : status === 'paused'
                      ? 'Resume plan'
                      : status === 'completed'
                        ? 'Repeat plan'
                        : 'Start plan'}
                </button>
              )}
              {canRateDiet ? (
                <button type="button" className="ghost" onClick={openDietReview}>
                  Rate this diet plan
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>

      {waterModal ? (
        <div className="web-modal" role="dialog">
          <div className="web-modal-card">
            <h3>Daily water goal</h3>
            <p>Choose how much water you want to drink each day.</p>
            <div className="diet-chips">
              {WATER_GOAL_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`chip ${waterGoal === item.value ? 'on' : ''}`}
                  onClick={() => setWaterGoal(item.value)}
                >
                  {item.label}
                  {item.recommended ? ' • recommended' : ''}
                </button>
              ))}
            </div>
            <div className="detail-cta">
              <button type="button" className="ghost" onClick={() => setWaterModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="cta"
                onClick={() => {
                  setWaterModal(false);
                  runStart({ daily_water_intake_goal: waterGoal });
                }}
              >
                Start
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div className="web-modal" role="dialog">
          <div className="web-modal-card">
            <h3>{confirm.title}</h3>
            <p>{confirm.subtitle}</p>
            <div className="detail-cta">
              <button type="button" className="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="cta"
                disabled={updatingStatus}
                onClick={async () => {
                  const action = confirm.action;
                  setConfirm(null);
                  if (action === 'pause') await pausePlan();
                  if (action === 'stop') await stopPlan();
                  if (action === 'repeat') await repeatPlan();
                }}
              >
                {confirm.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {conflict ? (
        <div className="web-modal" role="dialog">
          <div className="web-modal-card">
            <h3>Another plan is active</h3>
            <p>
              {conflict.activeName} is currently active. Pause it to start this plan.
            </p>
            <div className="detail-cta">
              <button type="button" className="ghost" onClick={() => setConflict(null)}>
                Keep current
              </button>
              <button
                type="button"
                className="cta"
                disabled={updatingStatus}
                onClick={async () => {
                  const target = conflict;
                  setConflict(null);
                  await pauseActiveAndStart(target.activeId, target.catalogId, {
                    daily_water_intake_goal: target.waterGoal,
                  });
                }}
              >
                Pause & start
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
