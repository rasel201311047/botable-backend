/**
 * Calculate sleep score based on duration and quality
 * @param {number} durationHours - Sleep duration in hours
 * @param {string} quality - Sleep quality (poor, average, good)
 * @returns {number} Sleep score (0-100)
 */
const calculateSleepScore = (durationHours, quality) => {
  let score = 0;
  
  // Duration component (70% of score)
  if (durationHours >= 7) {
    score += 70; // Excellent
  } else if (durationHours >= 5) {
    score += 50; // Good
  } else if (durationHours >= 3) {
    score += 30; // Fair
  } else {
    score += 10; // Poor
  }
  
  // Quality component (30% of score)
  switch (quality) {
    case 'good':
      score += 30;
      break;
    case 'average':
      score += 20;
      break;
    case 'poor':
      score += 10;
      break;
    default:
      score += 15;
  }
  
  return Math.min(score, 100);
};

/**
 * Calculate sleep duration from start and end times
 * @param {Date} startTime - Sleep start time
 * @param {Date} endTime - Sleep end time
 * @returns {number} Duration in hours
 */
const calculateSleepDuration = (startTime, endTime) => {
  const durationMs = endTime - startTime;
  const durationHours = durationMs / (1000 * 60 * 60);
  return Math.round(durationHours * 10) / 10; // Round to 1 decimal
};

module.exports = {
  calculateSleepScore,
  calculateSleepDuration
};