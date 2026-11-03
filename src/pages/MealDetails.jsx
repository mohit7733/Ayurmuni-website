import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import dietCoverImg from "/images/login/14.jpg";
import { requireAuth } from "../services/guestAuth";
import { updateDietPlanProgress } from "../services/dietService";
import { nowIso } from "../diet/utils";
import { showSuccessToast } from "../config/key";
import "../design/pages/meal-details.css";

export default function MealDetails() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const item = useLocation().state?.meal;
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(item?.status === "done");

  if (!item) {
    return (
      <AppShell tab="home">
        <section className="catalog-page meal-page meal-unavailable">
          <header className="catalog-head">
            <div>
              <button
                type="button"
                className="text-back"
                onClick={() => navigate(`/diet`)}
              >
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

  const ingredients = (
    Array.isArray(item.dietItemDetails) && item.dietItemDetails.length
      ? item.dietItemDetails
      : (item.dietItems || []).map((entry) => ({
          name: entry,
          quantity: "",
          notes: "",
        }))
  ).filter((food) => {
    if (typeof food === "string") return food.trim().length > 0;

    return Boolean(
      food &&
      (food.name?.trim() ||
        food.label?.trim() ||
        food.quantity?.trim() ||
        food.notes?.trim()),
    );
  });

  const steps = (
    Array.isArray(item.preparationSteps) ? item.preparationSteps : []
  ).filter((step) => typeof step === "string" && step.trim());

  const videos = (
    Array.isArray(item.preparationVideos) ? item.preparationVideos : []
  ).filter((url) => typeof url === "string" && url.trim());

  const onLogMeal = async () => {
    if (!item.dayKey || !item.mealKey) {
      showSuccessToast("Meal details unavailable", "error");
      return;
    }
    if (!(await requireAuth("Please login to log meals"))) return;
    try {
      setLogging(true);
      const markingDone = !logged;
      const res = await updateDietPlanProgress({
        day: item.dayKey,
        meal: item.mealKey,
        status: markingDone ? "completed" : "pending",
        completed_at: markingDone ? nowIso() : null,
      });
      if (res?.success === false) {
        showSuccessToast(res?.message || "Unable to update meal", "error");
        return;
      }
      setLogged(markingDone);
      showSuccessToast(
        markingDone ? "Meal completed" : "Meal unmarked",
        "success",
      );
    } catch (e) {
      showSuccessToast(e?.message || "Unable to update meal", "error");
    } finally {
      setLogging(false);
    }
  };

  return (
    <AppShell tab="home">
      <section className="catalog-page meal-page">
        <header className="catalog-head">
          <div>
            <button
              type="button"
              className="text-back"
              onClick={() => navigate(`/diet/${planId}`)}
            >
              ← Back
            </button>

            <h1>{item.title || "Meal"}</h1>
            <p>{item.type}</p>
          </div>
        </header>

        {/* Two-column meal details layout */}
        <div className="meal-content-grid">
          {/* Left: Meal image */}
          <div className="meal-media-column">
            <div className="diet-hero">
              <img
                src={item.image || dietCoverImg}
                alt={item.title || "Meal"}
              />
            </div>
          </div>

          {/* Right: Meal information */}
          <div className="meal-info-column">
            {/* Nutrition information */}
            {[item.kcal, item.carbs, item.protein, item.fat].some(
              (value) => value !== null && value !== undefined && value !== "",
            ) && (
              <div className="diet-nutrition">
                <div>
                  <strong>{item.kcal ?? "—"}</strong>
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
            )}

            {/* Ingredients */}
            {ingredients.length ? (
              <section
                className="meal-detail-section"
                aria-labelledby="meal-ingredients-title"
              >
                <h3 className="yoga-section" id="meal-ingredients-title">
                  Ingredients
                </h3>

                <ul className="meal-list">
                  {ingredients.map((food, index) => (
                    <li key={index}>
                      <strong>{food.name || food.label}</strong>

                      {food.quantity ? <small>{food.quantity}</small> : null}

                      {food.notes ? <p>{food.notes}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Preparation */}
            {steps.length ? (
              <section
                className="meal-detail-section"
                aria-labelledby="meal-preparation-title"
              >
                <h3 className="yoga-section" id="meal-preparation-title">
                  Preparation
                </h3>

                <ol className="meal-steps">
                  {steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            {/* Preparation videos */}
            {videos.length ? (
              <section
                className="meal-detail-section"
                aria-labelledby="meal-videos-title"
              >
                <h3 className="yoga-section" id="meal-videos-title">
                  Prep videos
                </h3>

                <div className="diet-chips">
                  {videos.map((url) => (
                    <a
                      key={url}
                      className="chip"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Watch video
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Meal completion */}
            <div className="detail-cta">
              <button
                type="button"
                className={`cta ${logged ? "meal-done" : ""}`}
                disabled={logging}
                aria-pressed={logged}
                onClick={onLogMeal}
              >
                {logging
                  ? "Saving…"
                  : logged
                    ? "Mark as pending"
                    : "Mark as done"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
