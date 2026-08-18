/**
 * Calculate readiness score based on recovery, nutrition, and sleep
 * @param {Object} params - Readiness parameters
 * @returns {number} Readiness score (0-100)
 */
const calculateReadinessScore = (params) => {
  const {
    recoveryScore = 50,
    nutritionAdherence = 0, // Percentage (0-100)
    sleepConsistency = 0, // Percentage (0-100)
    hrvScore = 0 // Heart Rate Variability (0-100), optional
  } = params;
  
  // Weighted average
  let score = 0;
  
  // Recovery score weight: 40%
  score += recoveryScore * 0.4;
  
  // Nutrition adherence weight: 30%
  score += nutritionAdherence * 0.3;
  
  // Sleep consistency weight: 20%
  score += sleepConsistency * 0.2;
  
  // HRV score weight: 10% (if available)
  if (hrvScore > 0) {
    score += hrvScore * 0.1;
  } else {
    // Distribute weight to other factors
    score += (recoveryScore * 0.05) + (nutritionAdherence * 0.05);
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
};

module.exports = {
  calculateReadinessScore
};