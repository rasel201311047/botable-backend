/**
 * Calculate recovery score based on sleep, workouts, and recovery activities
 * @param {Object} params - Recovery parameters
 * @returns {number} Recovery score (0-100)
 */
const calculateRecoveryScore = (params) => {
  let score = 50; // Base score
  
  const {
    sleepScore = 0,
    workoutsToday = 0,
    workoutIntensity = 'low',
    recoveryActivities = 0,
    consecutiveWorkoutDays = 0,
    stressLevel = 'medium'
  } = params;
  
  // Sleep impact (40% of score)
  score += (sleepScore - 50) * 0.4;
  
  // Workout impact
  if (workoutsToday > 0) {
    if (workoutIntensity === 'high') {
      score -= 20;
    } else if (workoutIntensity === 'medium') {
      score -= 10;
    } else {
      score -= 5;
    }
    
    // Penalty for consecutive workout days
    if (consecutiveWorkoutDays > 3) {
      score -= (consecutiveWorkoutDays - 3) * 5;
    }
  }
  
  // Recovery activities boost
  if (recoveryActivities > 0) {
    score += recoveryActivities * 10;
  }
  
  // Stress impact
  switch (stressLevel) {
    case 'high':
      score -= 15;
      break;
    case 'medium':
      score -= 8;
      break;
    case 'low':
      score += 5;
      break;
  }
  
  // Ensure score stays within bounds
  return Math.max(0, Math.min(100, Math.round(score)));
};

module.exports = {
  calculateRecoveryScore
};