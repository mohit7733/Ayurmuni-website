import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  CircleCheck,
  Flame,
  Leaf,
  Lock,
  Pause,
  RotateCcw,
  Salad,
  Square,
  Star,
  Stethoscope,
  Sun,
  Trophy,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { Button, Modal } from '../components/ui';
import {
  DetailCard,
  DetailEmpty,
  DetailHero,
  DetailLayout,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  InfoGrid,
  MetaChip,
  StatusPill,
} from '../components/detail/Detail';
import dietCoverImg from '/images/login/14.webp';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';
import useDietPlans from '../diet/useDietPlans';
import WaterGoalStart from '../diet/WaterGoalStart';
import WaterLog from '../diet/WaterLog';
import {
  buildCompletionEntries,
  buildDietReviewState,
  canShowDietPlanRateButton,
  getDietHealthFocus,
  getDietListStatus,
  getDietNextRepeatNumber,
  getDietPlanGallery,
  getDietPlanRatingLabel,
  getDietRepeatCount,
  getDietRepeatSummary,
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
  const [congrats, setCongrats] = useState(false);

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
    selectAllDays,
    showAllDays,
    todayDayKey,
    mealsByDay,
    isStarted,
    isPlanFullyComplete,
    completionJson,
    activePlan,
    loadingDetail,
    starting,
    startPlan,
    updateWaterIntake,
    pausePlan,
    stopPlan,
    repeatPlan,
    completePlan,
    resetPlan,
    switchPlan,
    prepareRepeat,
    pauseActiveAndRepeat,
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
      state: buildDietReviewState({ plan, assignmentId, catalogPlanId: planId }),
    });
  };

  const healthFocus = getDietHealthFocus(selectedSummary, planDetail, plan);
  const completionRows = useMemo(() => buildCompletionEntries(completionJson, 12), [completionJson]);
  const isViewingToday =
    String(currentDayKey || '').toLowerCase() === String(todayDayKey || '').toLowerCase();
  const nextRepeatNumber = getDietNextRepeatNumber(plan);
  const allDaysDone = mealsByDay.reduce(
    (n, d) => n + d.meals.filter((m) => m.status === 'done').length,
    0,
  );
  const allDaysTotal = mealsByDay.reduce((n, d) => n + d.meals.length, 0);

  /** App onCompletePlan: complete, then hand off to ShareExperience when the plan can be rated. */
  const onCompletePlan = async () => {
    const assignmentId = patientDietPlanId || plan?.patient_diet_plan_id;
    const ok = await completePlan();
    if (ok !== true) return;
    if (assignmentId && canShowDietPlanRateButton(plan)) {
      navigate('/share-experience', {
        state: buildDietReviewState({ plan, assignmentId, catalogPlanId: planId }),
      });
      return;
    }
    setCongrats(true);
  };

  /** App onRepeatPress: guards, pause-first conflict, then the confirm sheet. */
  const onRepeatPress = () => {
    const prep = prepareRepeat();
    if (!prep.canRepeat) return;
    if (prep.needsConfirm && prep.activePlan) {
      setConflict({
        mode: 'repeat',
        activeName: prep.activePlan.name || 'another plan',
        activeId: prep.activePlan.patient_diet_plan_id,
        catalogId: planId,
        completedId: prep.completedAssignmentId,
      });
      return;
    }
    setConfirm({
      title: 'Repeat this diet plan?',
      subtitle: `${getDietRepeatSummary(plan)}. Repeat starts a fresh tracked run from Day 1.`,
      confirmText: `Repeat plan (#${nextRepeatNumber})`,
      action: 'repeat',
    });
  };

  const renderMeal = (meal, index) => {
    const done = isStarted && meal.status === 'done';
    return (
      <li key={meal.id} style={{ '--i': index }}>
        <button
          type="button"
          className={`dt-meal${done ? ' is-done' : ''}`}
          onClick={() => navigate(`/diet/${planId}/meals/${meal.id}`, { state: { meal, planId } })}
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
  };

  const runStart = async (options) => {
    const result = await startPlan(planId, options);
    if (result?.conflict) {
      if (!result.activePlan?.patient_diet_plan_id) {
        // App DietScreen: no resolvable active id -> guidance toast instead of switch modal.
        const label = status === 'paused' ? 'Resume' : 'Start';
        showSuccessToast(
          `${result.activePlan?.name || 'another diet plan'} is already active. Open that plan, tap Pause, then ${label} this one.`,
          'error',
        );
        return;
      }
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
      onRepeatPress();
      return;
    }
    setWaterModal(true);
  };

  const title = plan?.title || plan?.name || 'Diet Plan';
  const durationLabel = plan?.duration || (plan?.duration_days ? `${plan.duration_days} days` : '');
  const statusText = status && status !== 'not_started' ? status.replace(/_/g, ' ') : '';
  const season = plan?.season ? String(plan.season).replace(/^\w/, (c) => c.toUpperCase()) : '';

  return (
    <AppShell tab="home">
      <DetailPage>
        <DetailTop backTo="/diet" backLabel="Diet plans" />

        {loadingDetail && !plan ? (
          <DetailSkeleton label="Loading plan" />
        ) : (
          <>
            <DetailHero
              titleId="dt-plan-title"
              media={
                <>
                  <img src={cover} alt="" />
                  {gallery.length > 1 ? (
                    <div className="dx-thumbs" role="group" aria-label="Plan photos">
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
                </>
              }
              eyebrow="Ayurvedic diet plan"
              title={title}
              lede={plan?.short_description}
              chips={
                <>
                  {statusText ? <StatusPill status={status}>{statusText}</StatusPill> : null}
                  {rating ? (
                    <MetaChip icon={Star} tone="gold">
                      {rating}
                    </MetaChip>
                  ) : null}
                  {durationLabel ? <MetaChip icon={CalendarDays}>{durationLabel}</MetaChip> : null}
                  {season ? <MetaChip icon={Sun}>{season}</MetaChip> : null}
                  {plan?.prakriti ? <MetaChip icon={Leaf}>{plan.prakriti}</MetaChip> : null}
                </>
              }
            >
              {price ? <p className="dx-price">{price}</p> : null}
              <div className="dx-actions dx-actions--row">
                {isStarted ? null : (
                  <Button loading={starting} disabled={updatingStatus} onClick={onStart}>
                    {status === 'paused'
                      ? 'Resume plan'
                      : status === 'completed'
                        ? `Repeat plan (#${nextRepeatNumber})`
                        : status === 'stopped'
                          ? 'Start again'
                          : 'Start plan'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  leadingIcon={<CalendarDays size={16} aria-hidden />}
                  onClick={() => navigate(`/diet/${planId}/weekly`, { state: { item: plan, planId } })}
                >
                  Weekly planner
                </Button>
                {isStarted ? (
                  <>
                    <Button
                      variant="ghost"
                      leadingIcon={<Pause size={16} aria-hidden />}
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
                    </Button>
                    <Button
                      variant="ghost"
                      leadingIcon={<Square size={14} aria-hidden />}
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
                    </Button>
                    <Button
                      variant="ghost"
                      leadingIcon={<RotateCcw size={15} aria-hidden />}
                      disabled={updatingStatus}
                      onClick={() =>
                        setConfirm({
                          title: 'Reset progress?',
                          subtitle:
                            'Ends this run and starts a fresh active assignment from Day 1. Repeat count stays the same (only Complete → Repeat increases it).',
                          confirmText: 'Reset',
                          action: 'reset',
                        })
                      }
                    >
                      Reset
                    </Button>
                    <Button
                      variant="ghost"
                      leadingIcon={<ArrowLeftRight size={15} aria-hidden />}
                      disabled={updatingStatus}
                      onClick={() =>
                        setConfirm({
                          title: 'Switch diet plan?',
                          subtitle:
                            'Pause this active plan so you can start or resume another. Only one diet can be active at a time.',
                          confirmText: 'Pause & switch',
                          action: 'switch-pause',
                        })
                      }
                    >
                      Switch plan
                    </Button>
                    {isPlanFullyComplete ? (
                      <Button
                        leadingIcon={<CircleCheck size={16} aria-hidden />}
                        loading={updatingStatus}
                        onClick={onCompletePlan}
                      >
                        Mark plan complete
                      </Button>
                    ) : null}
                  </>
                ) : null}
                {canRateDiet ? (
                  <Button variant="ghost" leadingIcon={<Star size={15} aria-hidden />} onClick={openDietReview}>
                    Rate this diet plan
                  </Button>
                ) : null}
              </div>
              {status === 'stopped' ? (
                <p className="dx-note">
                  Stopped plans can’t use Repeat. Start again to begin a new run, or complete a full
                  plan first to unlock Repeat.
                </p>
              ) : status === 'completed' ? (
                activePlan && String(activePlan.patient_diet_plan_id || '') !== String(patientDietPlanId || '') ? (
                  <p className="dx-note">
                    “{activePlan.name}” is currently active. Repeat will ask to pause it first, then
                    start this plan again.
                  </p>
                ) : null
              ) : !isStarted ? (
                <p className="dx-note">Start this plan to unlock daily tracking and hydration.</p>
              ) : null}
            </DetailHero>

            <DetailLayout
              aside={
                <>
                  <DetailCard id="dt-glance" title="At a glance" icon={Salad}>
                    <InfoGrid
                      items={[
                        { label: 'Duration', value: durationLabel },
                        { label: 'Season', value: season },
                        { label: 'Prakriti', value: plan?.prakriti },
                        { label: 'Health focus', value: healthFocus },
                        { label: 'Price', value: price },
                        {
                          label: 'Meals per day',
                          value: plan?.meals_per_day ?? (previewMeals.length || ''),
                        },
                        {
                          label: 'Water goal',
                          value: waterGoalMl ? `${(waterGoalMl / 1000).toFixed(1).replace(/\.0$/, '')} L / day` : '',
                        },
                      ]}
                    />
                  </DetailCard>
                  <DetailCard id="dt-guide" title="Need personal guidance?" icon={Stethoscope} tone="accent">
                    <p className="dx-prose">
                      An Ayurveda doctor can tailor this plan to your prakriti, routine and health goals.
                    </p>
                    <Button variant="secondary" onClick={() => navigate('/consult')}>
                      Consult a doctor
                    </Button>
                  </DetailCard>
                </>
              }
            >
              {status === 'completed' ? (
                <DetailCard id="dt-complete" title="Plan completed" icon={Trophy} tone="accent">
                  <div className="dt-complete">
                    <p className="dx-prose">
                      You finished “{title}”. {getDietRepeatSummary(plan)}. Tap Repeat to start a fresh
                      cycle from Day 1.
                    </p>
                    <div className="dt-complete__meta">
                      <span>Repeat count: {getDietRepeatCount(plan)}</span>
                      <span>Next run: Repeat #{nextRepeatNumber}</span>
                    </div>
                    {completionRows.length ? (
                      <div className="dt-complete__summary">
                        <h3>Your tracking summary</h3>
                        <dl>
                          {completionRows.map((row) => (
                            <div key={row.key}>
                              <dt>{row.label}</dt>
                              <dd>{row.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : (
                      <p className="dx-note">
                        Your completed run is saved. Use Repeat when you’re ready for another cycle.
                      </p>
                    )}
                    <div className="dx-actions dx-actions--row">
                      <Button onClick={onRepeatPress} loading={updatingStatus}>
                        {`Repeat plan (#${nextRepeatNumber})`}
                      </Button>
                      <Button variant="secondary" onClick={() => navigate('/diet?view=all')}>
                        Browse other plans
                      </Button>
                    </div>
                  </div>
                </DetailCard>
              ) : null}

              {status === 'stopped' ? (
                <DetailCard id="dt-stopped" title="Plan stopped" icon={Square}>
                  <div className="dx-actions dx-actions--row">
                    <Button variant="secondary" onClick={() => navigate('/diet?view=all')}>
                      Browse other plans
                    </Button>
                  </div>
                </DetailCard>
              ) : null}

              {isStarted && !showAllDays ? (
                <DetailCard
                  id="dt-progress"
                  title="Daily Vitality"
                  icon={Flame}
                  meta={isViewingToday ? undefined : dayLabel}
                >
                  <div className="dt-progress">
                    <div
                      className="dt-progress__ring"
                      style={{ '--p': nutrition.mealsTotal ? nutrition.mealsDone / nutrition.mealsTotal : 0 }}
                    >
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
                      <div>
                        <strong>{Math.round(nutrition.burnedKcal || 0)}</strong>
                        <small>kcal burned</small>
                      </div>
                      <div>
                        <strong>{Math.round(nutrition.goalKcal || 0)}</strong>
                        <small>kcal goal</small>
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
                  </div>
                </DetailCard>
              ) : null}

              <DetailCard
                id="dt-meals-title"
                title={
                  isStarted
                    ? showAllDays
                      ? 'All plan days'
                      : dayLabel
                        ? `${dayLabel} meals`
                        : 'Today’s meals'
                    : 'Meal preview'
                }
                icon={Leaf}
                meta={
                  isStarted && showAllDays
                    ? `${allDaysDone}/${allDaysTotal} logged`
                    : `${previewMeals.length} ${previewMeals.length === 1 ? 'meal' : 'meals'}`
                }
              >
                {isStarted && planDays.length ? (
                  <div className="dt-days" role="group" aria-label="Select plan day">
                    <button
                      type="button"
                      aria-pressed={showAllDays}
                      className={`dt-day dt-day--all${showAllDays ? ' is-on' : ''}`}
                      onClick={selectAllDays}
                    >
                      <span className="dt-day__label">All</span>
                      <small>{allDaysDone}/{allDaysTotal}</small>
                    </button>
                    {planDays.map((day) => {
                      const pct = day.mealsTotal ? day.mealsDone / day.mealsTotal : 0;
                      return (
                        <button
                          key={day.dayKey}
                          type="button"
                          aria-pressed={!showAllDays && day.dayKey === currentDayKey}
                          className={[
                            'dt-day',
                            !showAllDays && day.dayKey === currentDayKey && 'is-on',
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

                {isStarted && showAllDays && allDaysTotal ? (
                  <div className="dt-alldays">
                    {mealsByDay
                      .filter((day) => day.meals.length)
                      .map((day) => (
                        <section key={day.dayKey} aria-label={day.label}>
                          <h3 className="dt-alldays__head">
                            {day.label}
                            <small>
                              {day.meals.filter((m) => m.status === 'done').length}/{day.meals.length} logged
                            </small>
                          </h3>
                          <ul className="dt-meals">{day.meals.map(renderMeal)}</ul>
                        </section>
                      ))}
                  </div>
                ) : previewMeals.length ? (
                  <ul className="dt-meals">{previewMeals.map(renderMeal)}</ul>
                ) : (
                  <DetailEmpty
                    icon={Leaf}
                    title="No meals yet"
                    text="Meals for this plan will appear here when available."
                  />
                )}
              </DetailCard>

              {isStarted && isPlanFullyComplete ? (
                <div className="dt-banner" role="status">
                  <CircleCheck size={20} aria-hidden />
                  <p>
                    <strong>All meals tracked — amazing!</strong>
                    <span>Finish this plan to save your summary and unlock Repeat.</span>
                  </p>
                  <Button loading={updatingStatus} onClick={onCompletePlan}>
                    Complete diet plan
                  </Button>
                </div>
              ) : null}
            </DetailLayout>
          </>
        )}
      </DetailPage>

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

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        description={confirm?.subtitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              loading={updatingStatus}
              onClick={async () => {
                const action = confirm?.action;
                setConfirm(null);
                if (action === 'pause') await pausePlan();
                if (action === 'stop') await stopPlan();
                if (action === 'repeat') await repeatPlan();
                if (action === 'reset') await resetPlan();
                if (action === 'switch-pause') {
                  const ok = await switchPlan('pause');
                  if (ok === true) navigate('/diet?view=all', { replace: true });
                }
              }}
            >
              {confirm?.confirmText}
            </Button>
          </>
        }
      />

      <Modal
        open={Boolean(conflict)}
        onClose={() => setConflict(null)}
        title="Another plan is active"
        description={
          conflict
            ? `${conflict.activeName} is currently active. Pause it to ${conflict.mode === 'repeat' ? 'repeat' : 'start'} this plan.`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConflict(null)}>
              Keep current
            </Button>
            <Button
              loading={updatingStatus}
              onClick={async () => {
                const target = conflict;
                setConflict(null);
                if (target.mode === 'repeat') {
                  await pauseActiveAndRepeat(target.activeId, target.completedId);
                  return;
                }
                await pauseActiveAndStart(target.activeId, target.catalogId, {
                  daily_water_intake_goal: target.waterGoal,
                });
              }}
            >
              {conflict?.mode === 'repeat' ? 'Pause & repeat' : 'Pause & start'}
            </Button>
          </>
        }
      />

      <Modal
        open={congrats}
        onClose={() => setCongrats(false)}
        title="Congratulations!"
        description={`You completed “${title}”. Your tracking summary is saved with this plan.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCongrats(false);
                navigate('/diet?view=all');
              }}
            >
              Browse other plans
            </Button>
            <Button onClick={() => setCongrats(false)}>View summary</Button>
          </>
        }
      />
    </AppShell>
  );
}
