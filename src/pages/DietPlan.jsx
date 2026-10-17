import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, Leaf, Lock, Star } from 'lucide-react';
import AppShell from '../components/AppShell';
import { SectionHeader, Skeleton } from '../components/ui';
import dietCoverImg from '/images/login/14.jpg';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';
import useDietPlans from '../diet/useDietPlans';
import WaterGoalStart from '../diet/WaterGoalStart';
import WaterLog from '../diet/WaterLog';
import {
  canShowDietPlanRateButton,
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
import '../design/pages/diet-plan.css';
import '../design/brand.css';
import '../design/pages/diet-brand.css';

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
  const cover = gallery[galleryIndex]?.image_url || gallery[0]?.image_url || dietCoverImg;
  const rating = getDietPlanRatingLabel(plan);
  const price =
    plan?.is_paid === false || Number(plan?.price) === 0 ? 'Free' : formatRupee(plan?.price);
  const status = getDietListStatus(plan);
  const waterGoalMl = getWaterGoalMl(plan);
  const dayLabel = planDays.find((day) => day.dayKey === currentDayKey)?.label || '';
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
      <section className="dt-page dt-page--detail">
        <div className="dt-topbar">
          <button type="button" className="dt-back" onClick={() => navigate('/diet')}>
            <ArrowLeft size={16} aria-hidden />
            Back
          </button>
        </div>

        {loadingDetail && !plan ? (
          <div className="dt-detail-skel" aria-busy="true" aria-label="Loading plan">
            <Skeleton className="dt-detail-skel__media" />
            <div className="dt-detail-skel__info">
              <Skeleton className="dt-detail-skel__line is-lg" />
              <Skeleton className="dt-detail-skel__line" />
              <Skeleton className="dt-detail-skel__line is-sm" />
            </div>
          </div>
        ) : (
          <>
            <div className="dt-overview">
              <div className="dt-gallery">
                <div className="dt-gallery__main">
                  <img src={cover} alt="" />
                  <span className="dt-gallery__shade" aria-hidden="true" />
                </div>
                {gallery.length > 1 ? (
                  <div className="dt-gallery__thumbs" role="group" aria-label="Plan photos">
                    {gallery.map((item, index) => (
                      <button
                        key={`${item.image_url}-${index}`}
                        type="button"
                        aria-pressed={index === galleryIndex}
                        aria-label={`Show photo ${index + 1}`}
                        className={index === galleryIndex ? 'is-on' : ''}
                        onClick={() => setGalleryIndex(index)}
                      >
                        <img src={item.image_url} alt="" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="dt-info">
                <div className="dt-info__top">
                  <p className="dt-eyebrow">Diet plan</p>
                  {status !== 'not_started' ? (
                    <span className={`dt-status is-${status}`}>{status}</span>
                  ) : null}
                </div>
                <h1 className="dt-info__title">{plan?.title || plan?.name || 'Diet Plan'}</h1>
                <div className="dt-info__chips">
                  {plan?.duration || plan?.duration_days ? (
                    <span>
                      <CalendarDays size={14} aria-hidden />
                      {plan.duration || `${plan.duration_days} days`}
                    </span>
                  ) : null}
                  {plan?.season ? <span>{plan.season}</span> : null}
                  {plan?.prakriti ? <span>{plan.prakriti}</span> : null}
                  {rating ? (
                    <span className="is-rating">
                      <Star size={13} aria-hidden fill="currentColor" />
                      {rating}
                    </span>
                  ) : null}
                </div>
                {price ? <p className="dt-info__price">{price}</p> : null}
                {plan?.short_description ? (
                  <p className="dt-info__desc">{plan.short_description}</p>
                ) : null}

                <div className="dt-actions">
                  {isStarted ? null : (
                    <button
                      type="button"
                      className="dt-btn dt-btn--primary"
                      disabled={starting || updatingStatus}
                      onClick={onStart}
                    >
                      {starting
                        ? 'Starting…'
                        : status === 'paused'
                          ? 'Resume plan'
                          : status === 'completed'
                            ? 'Repeat plan'
                            : 'Start plan'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="dt-btn dt-btn--secondary"
                    onClick={() =>
                      navigate(`/diet/${planId}/weekly`, { state: { item: plan, planId } })
                    }
                  >
                    <CalendarDays size={16} aria-hidden />
                    Weekly planner
                  </button>
                  {isStarted ? (
                    <>
                      <button
                        type="button"
                        className="dt-btn dt-btn--ghost"
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
                        className="dt-btn dt-btn--ghost"
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
                  ) : null}
                  {canRateDiet ? (
                    <button type="button" className="dt-btn dt-btn--ghost" onClick={openDietReview}>
                      <Star size={15} aria-hidden />
                      Rate this diet plan
                    </button>
                  ) : null}
                </div>
                {!isStarted ? (
                  <p className="dt-info__hint">Start this plan to unlock daily tracking and hydration.</p>
                ) : null}
              </div>
            </div>

            {isStarted ? (
              <section className="dt-panel dt-progress" aria-label="Today’s progress">
                <div className="dt-progress__ring" style={{ '--p': nutrition.mealsTotal ? nutrition.mealsDone / nutrition.mealsTotal : 0 }}>
                  <svg viewBox="0 0 44 44" aria-hidden="true">
                    <circle cx="22" cy="22" r="19" className="track" />
                    <circle cx="22" cy="22" r="19" className="bar" pathLength="1" />
                  </svg>
                  <span>
                    <strong>
                      {nutrition.mealsDone}/{nutrition.mealsTotal}
                    </strong>
                    <small>meals</small>
                  </span>
                </div>
                <div className="dt-progress__stats">
                  <div>
                    <strong>{Math.round(nutrition.eatenKcal)}</strong>
                    <small>kcal eaten</small>
                  </div>
                  <div>
                    <strong>{Math.round(nutrition.leftKcal)}</strong>
                    <small>kcal left</small>
                  </div>
                </div>
                <div className="dt-progress__macros">
                  {MACRO.map((item) => (
                    <div key={item.key} className="dt-macro">
                      <span className="dt-macro__label">{item.label}</span>
                      <b>{nutrition[item.key]}%</b>
                      <i aria-hidden="true">
                        <em style={{ width: `${nutrition[item.key]}%`, background: item.color }} />
                      </i>
                    </div>
                  ))}
                </div>
                <div className="dt-progress__water">
                  <WaterLog
                    waterMl={waterMl}
                    waterGoalMl={waterGoalMl}
                    dayLabel={dayLabel}
                    updating={updatingWater}
                    onSetIntake={updateWaterIntake}
                  />
                </div>
              </section>
            ) : null}

            <section className="dt-panel" aria-labelledby="dt-meals-title">
              {isStarted && planDays.length ? (
                <div className="dt-days" role="group" aria-label="Select plan day">
                  {planDays.map((day) => {
                    const pct = day.mealsTotal ? day.mealsDone / day.mealsTotal : 0;
                    return (
                      <button
                        key={day.dayKey}
                        type="button"
                        aria-pressed={day.dayKey === currentDayKey}
                        className={[
                          'dt-day',
                          day.dayKey === currentDayKey && 'is-on',
                          day.isLocked && 'is-locked',
                          pct === 1 && 'is-done',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={day.isLocked}
                        onClick={() => selectDay(day.dayKey)}
                      >
                        <span className="dt-day__label">{day.label}</span>
                        <span className="dt-day__bar" aria-hidden="true">
                          <i style={{ width: `${Math.round(pct * 100)}%` }} />
                        </span>
                        <small>
                          {day.isLocked ? <Lock size={11} aria-hidden /> : null}
                          {day.mealsDone}/{day.mealsTotal}
                        </small>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <SectionHeader
                id="dt-meals-title"
                title={
                  isStarted ? (dayLabel ? `${dayLabel} meals` : 'Today’s meals') : 'Meal preview'
                }
                description={`${previewMeals.length} ${previewMeals.length === 1 ? 'meal' : 'meals'}`}
              />

              {previewMeals.length ? (
                <ul className="dt-meals">
                  {previewMeals.map((meal, index) => {
                    const done = isStarted && meal.status === 'done';
                    return (
                      <li key={meal.id} style={{ '--i': index }}>
                        <button
                          type="button"
                          className={`dt-meal${done ? ' is-done' : ''}`}
                          onClick={() =>
                            navigate(`/diet/${planId}/meals/${meal.id}`, { state: { meal, planId } })
                          }
                        >
                          <span className="dt-meal__img">
                            <img src={meal.image || dietCoverImg} alt="" loading="lazy" />
                          </span>
                          <span className="dt-meal__body">
                            <small className="dt-meal__type">
                              {meal.type}
                              {meal.time ? <em> · {meal.time}</em> : null}
                            </small>
                            <strong>{meal.title}</strong>
                            {meal.kcal ? <span className="dt-meal__kcal">{meal.kcal} kcal</span> : null}
                          </span>
                          <span className={`dt-meal__state${done ? ' is-done' : ''}`}>
                            {done ? <Check size={14} aria-hidden strokeWidth={2.6} /> : null}
                            {isStarted ? (done ? 'Done' : 'Open') : 'View'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="dt-empty">
                  <span className="dt-empty__icon" aria-hidden="true">
                    <Leaf size={22} />
                  </span>
                  <strong>No meals yet</strong>
                  <p>Meals for this plan will appear here when available.</p>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      {waterModal ? (
        <WaterGoalStart
          planName={plan?.name || plan?.title}
          loading={starting}
          onClose={() => {
            if (starting) return;
            setWaterModal(false);
          }}
          onConfirm={(goalMl) => {
            setWaterModal(false);
            runStart({ daily_water_intake_goal: goalMl });
          }}
        />
      ) : null}

      {confirm ? (
        <div className="web-modal dt-modal" role="dialog" aria-modal="true">
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
        <div className="web-modal dt-modal" role="dialog" aria-modal="true">
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
