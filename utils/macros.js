/**
 * Calculate nutrition targets based on user information
 * @param {Object} user - User object with shiftType, goalType, height, weight, age, gender
 * @returns {Object} Nutrition targets
 */
const calculateNutritionTargets = (user) => {
  const { goalType, shiftType, height, weight, age, gender } = user;
  
  // Step 1: Calculate Basal Metabolic Rate (BMR)
  let bmr;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  
  // Step 2: Apply activity factor based on shift type
  let activityFactor;
  switch (shiftType) {
    case 'fixed_night':
      activityFactor = 1.375; // Lightly active
      break;
    case 'rotating':
      activityFactor = 1.55; // Moderately active
      break;
    case 'early_morning':
      activityFactor = 1.725; // Very active
      break;
    default:
      activityFactor = 1.2; // Sedentary
  }
  
  const maintenanceCalories = Math.round(bmr * activityFactor);
  
  // Step 3: Apply goal adjustment
  let calorieTarget;
  let proteinRatio, carbRatio, fatRatio;
  
  switch (goalType) {
    case 'fat_loss':
      calorieTarget = Math.round(maintenanceCalories * 0.85); // 15% deficit
      proteinRatio = 0.40; // 40%
      carbRatio = 0.35;    // 35%
      fatRatio = 0.25;     // 25%
      break;
      
    case 'strength_building':
      calorieTarget = Math.round(maintenanceCalories * 1.10); // 10% surplus
      proteinRatio = 0.35; // 35%
      carbRatio = 0.45;    // 45%
      fatRatio = 0.20;     // 20%
      break;
      
    case 'maintenance':
      calorieTarget = maintenanceCalories;
      proteinRatio = 0.30; // 30%
      carbRatio = 0.40;    // 40%
      fatRatio = 0.30;     // 30%
      break;
      
    default:
      calorieTarget = maintenanceCalories;
      proteinRatio = 0.30;
      carbRatio = 0.40;
      fatRatio = 0.30;
  }
  
  // Step 4: Calculate macronutrient targets in grams
  const proteinTarget = Math.round((calorieTarget * proteinRatio) / 4); // 4 calories per gram
  const carbTarget = Math.round((calorieTarget * carbRatio) / 4); // 4 calories per gram
  const fatTarget = Math.round((calorieTarget * fatRatio) / 9); // 9 calories per gram
  
  return {
    calorieTarget,
    proteinTarget,
    carbTarget,
    fatTarget,
    proteinRatio,
    carbRatio,
    fatRatio,
    maintenanceCalories
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

module.exports = {
  calculateNutritionTargets,
  calculateProgress,
  calculateRemaining
};