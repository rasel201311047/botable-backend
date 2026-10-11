// The app does not ask for an activity level, so every user gets the same light-to-moderate
// factor. Targets therefore depend ONLY on age, gender, height, weight and goal.
const ACTIVITY_FACTOR = 1.4;
const MIN_CALORIES = 1200;
const MAX_CALORIES = 4500;

/**
 * Deterministic nutrition targets (Mifflin-St Jeor + goal adjustment). This is both the baseline
 * the AI generator is validated against and the fallback when the AI is unavailable.
 * @param {Object} user - { goalType, height (cm), weight (kg), age, gender }
 * @returns {Object} Nutrition targets
 */
const calculateNutritionTargets = (user) => {
  const { goalType, height, weight, age, gender } = user;

  // Step 1: Basal Metabolic Rate. Gender constant: +5 male, -161 female, midpoint otherwise.
  const genderConstant = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + genderConstant;

  // Step 2: Maintenance calories (TDEE)
  const maintenanceCalories = Math.round(bmr * ACTIVITY_FACTOR);
  
  // Step 3: Apply goal adjustment
  let calorieTarget;
  // protein g per kg body weight, fat share of calories
  let proteinPerKg, fatShare;

  switch (goalType) {
    case 'fat_loss':
      calorieTarget = Math.round(maintenanceCalories * 0.85); // 15% deficit
      proteinPerKg = 2.0; // high protein protects muscle in a deficit
      fatShare = 0.25;
      break;

    case 'strength_building':
      calorieTarget = Math.round(maintenanceCalories * 1.10); // 10% surplus
      proteinPerKg = 1.8;
      fatShare = 0.25;
      break;

    case 'maintenance':
    default:
      calorieTarget = maintenanceCalories;
      proteinPerKg = 1.6;
      fatShare = 0.28;
  }

  // Safety rails (also keep the value inside what the NutritionTarget schema accepts)
  calorieTarget = Math.min(MAX_CALORIES, Math.max(MIN_CALORIES, calorieTarget));

  // Step 4: Macros. Protein and fat are anchored to body weight (percent-of-calories splits gave
  // unrealistic values, e.g. 230 g protein for a 65 kg person); carbs fill the remaining calories.
  const bodyWeight = Number(weight) > 0 ? Number(weight) : 70;

  // protein: g/kg, never more than 35% of the calories
  const proteinTarget = Math.round(
    Math.min(bodyWeight * proteinPerKg, (calorieTarget * 0.35) / 4),
  );
  // fat: share of calories, never below 0.8 g/kg (hormones / vitamin absorption)
  const fatTarget = Math.round(
    Math.max((calorieTarget * fatShare) / 9, bodyWeight * 0.8),
  );
  // carbs: whatever calories are left (4 kcal per gram)
  const carbTarget = Math.max(
    0,
    Math.round((calorieTarget - proteinTarget * 4 - fatTarget * 9) / 4),
  );

  const ratioOf = (grams, kcalPerGram) =>
    Math.round(((grams * kcalPerGram) / calorieTarget) * 100) / 100;
  const proteinRatio = ratioOf(proteinTarget, 4);
  const carbRatio = ratioOf(carbTarget, 4);
  const fatRatio = ratioOf(fatTarget, 9);

  return {
    calorieTarget,
    proteinTarget,
    carbTarget,
    fatTarget,
    proteinRatio,
    carbRatio,
    fatRatio,
    maintenanceCalories,
    bmr: Math.round(bmr),
  };
};

/**
 * Calculate progress percentage
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @returns {number} Progress percentage (0-100)
 */
const calculateProgress = (current, target) => {
  if (target === 0) return 0;
  const percentage = (current / target) * 100;
  return Math.min(Math.round(percentage), 100);
};

/**
 * Calculate remaining values
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @returns {number} Remaining value
 */
const calculateRemaining = (current, target) => {
  const remaining = target - current;
  return Math.max(remaining, 0);
};

/**
 * Bump when the target formula changes: auto-generated saved targets from an older version are
 * recalculated on next read (targets the user edited by hand are never touched).
 */
const NUTRITION_FORMULA_VERSION = 3;

module.exports = {
  NUTRITION_FORMULA_VERSION,
  MIN_CALORIES,
  MAX_CALORIES,
  calculateNutritionTargets,
  calculateProgress,
  calculateRemaining
};