/**
 * Single source of truth for "how much did the user eat on a day".
 *
 * The `DailyNutritionSummary` rows are incrementally maintained counters and can drift
 * (duplicate rows for the same day when the server timezone differs, deleted / back-dated meals,
 * etc.). The Meal documents are the real log, so every screen (home dashboard, AI tools, chat)
 * derives its numbers from the meals using the helpers below and therefore always agrees.
 */
const Meal = require('../modules/nutrition/meal.model');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Meals that count as "eaten" (excludes scheduled / suggested / skipped entries). */
const EATEN_FILTER = {
  isLogged: { $ne: false },
  status: { $nin: ['skipped', 'expired', 'suggested', 'scheduled', 'rescheduled'] },
};

const startOfLocalDay = (value = new Date()) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** The moment a meal was eaten (falls back for legacy rows). */
const mealMoment = meal => new Date(meal.loggedAt || meal.createdAt || meal.date);

/** Local-day key (YYYY-MM-DD) of a meal, in the server's local timezone like the rest of the app. */
const localDayKey = value => {
  const d = new Date(value);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Totals for a list of meals. */
const sumMeals = meals => {
  const totals = meals.reduce(
    (acc, m) => {
      acc.calories += num(m.calories);
      acc.protein += num(m.protein);
      acc.carbs += num(m.carbs);
      acc.fat += num(m.fat);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    mealCount: meals.length,
  };
};

/** Eaten meals within [start, end) by when they were eaten. */
const findEatenMeals = (userId, start, end = null, select = null) => {
  const query = Meal.find({
    userId,
    ...EATEN_FILTER,
    loggedAt: end ? { $gte: start, $lt: end } : { $gte: start },
  }).sort({ loggedAt: 1 });
  if (select) query.select(select);
  return query.lean();
};

/**
 * Mongo filter for every meal that belongs on a calendar day [start, end):
 *  - eaten meals are placed by when they were eaten (`loggedAt`), so meals saved with a
 *    differently-normalised `date` (UTC vs local midnight) still land on the right day;
 *  - planned / suggested / skipped entries are placed by their planned `date`.
 */
const dayMealsFilter = (userId, start, end) => ({
  userId,
  $or: [
    { ...EATEN_FILTER, loggedAt: { $gte: start, $lt: end } },
    { $nor: [EATEN_FILTER], date: { $gte: start, $lt: end } },
  ],
});

/** Totals for one local day (default: today). */
const getDayTotals = async (userId, day = new Date()) => {
  const start = startOfLocalDay(day);
  const end = new Date(start.getTime() + DAY_MS);
  const meals = await findEatenMeals(userId, start, end, 'calories protein carbs fat loggedAt createdAt date');
  const lastMealAt = meals.length ? mealMoment(meals[meals.length - 1]) : null;
  return { ...sumMeals(meals), lastMealAt };
};

module.exports = {
  DAY_MS,
  EATEN_FILTER,
  startOfLocalDay,
  mealMoment,
  localDayKey,
  sumMeals,
  findEatenMeals,
  dayMealsFilter,
  getDayTotals,
};
