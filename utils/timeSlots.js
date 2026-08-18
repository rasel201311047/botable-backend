/**
 * Generate time slots for scheduling
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @param {number} interval - Interval in minutes
 * @returns {Array} Array of time slots
 */
const generateTimeSlots = (startTime = '06:00', endTime = '22:00', interval = 30) => {
  const slots = [];
  
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMinute = startMinute;
  
  while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
    const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    slots.push(timeStr);
    
    // Add interval
    currentMinute += interval;
    if (currentMinute >= 60) {
      currentHour += Math.floor(currentMinute / 60);
      currentMinute = currentMinute % 60;
    }
  }
  
  return slots;
};

/**
 * Get recommended time slots based on shift type
 * @param {string} shiftType - User's shift type
 * @param {string} activityType - Type of activity
 * @returns {Object} Recommended time slots
 */
const getRecommendedSlots = (shiftType, activityType) => {
  const recommendations = {
    fixed_night: {
      workout: ['18:00', '19:00', '20:00'], // Evening before shift
      meal: ['17:00', '23:00', '04:00'], // Pre-shift, during shift, post-shift
      recovery: ['06:00', '07:00', '12:00'] // Post-shift, before sleep
    },
    rotating: {
      workout: ['07:00', '12:00', '18:00'], // Flexible throughout day
      meal: ['08:00', '13:00', '19:00'], // Standard meal times
      recovery: ['20:00', '21:00', '22:00'] // Evening wind down
    },
    early_morning: {
      workout: ['05:00', '06:00', '17:00'], // Early morning or after work
      meal: ['06:00', '12:00', '18:00'], // Breakfast, lunch, dinner
      recovery: ['19:00', '20:00', '21:00'] // Evening relaxation
    }
  };

  return recommendations[shiftType]?.[activityType] || ['09:00', '12:00', '15:00', '18:00'];
};

/**
 * Calculate optimal time based on shift
 * @param {string} shiftType - User's shift type
 * @param {string} activity - Activity type
 * @param {Date} date - Date for calculation
 * @returns {string} Recommended time (HH:MM)
 */
const calculateOptimalTime = (shiftType, activity, date = new Date()) => {
  const hour = date.getHours();
  
  switch (shiftType) {
    case 'fixed_night':
      switch (activity) {
        case 'workout':
          // Evening workout before shift
          return hour < 12 ? '18:00' : '19:00';
        case 'meal':
          // Pre-shift meal
          return hour < 12 ? '17:00' : '23:00';
        case 'recovery':
          // Post-shift recovery
          return hour < 6 ? '06:00' : '12:00';
        default:
          return '18:00';
      }
      
    case 'early_morning':
      switch (activity) {
        case 'workout':
          // Early morning or after work
          return hour < 12 ? '05:00' : '17:00';
        case 'meal':
          // Standard meal times
          if (hour < 10) return '06:00';
          if (hour < 15) return '12:00';
          return '18:00';
        case 'recovery':
          // Evening wind down
          return '20:00';
        default:
          return '08:00';
      }
      
    case 'rotating':
      // More flexible schedule
      switch (activity) {
        case 'workout':
          return hour < 12 ? '07:00' : '18:00';
        case 'meal':
          if (hour < 10) return '08:00';
          if (hour < 15) return '13:00';
          return '19:00';
        case 'recovery':
          return '21:00';
        default:
          return '12:00';
      }
      
    default:
      return '12:00';
  }
};

/**
 * Format time for display
 * @param {string} timeStr - Time string (HH:MM)
 * @returns {string} Formatted time (e.g., "9:00 AM")
 */
const formatTimeForDisplay = (timeStr) => {
  const [hour, minute] = timeStr.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
};

/**
 * Calculate time difference in minutes
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {number} Difference in minutes
 */
const calculateTimeDifference = (startTime, endTime) => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  let totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  
  // Handle overnight
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }
  
  return totalMinutes;
};

module.exports = {
  generateTimeSlots,
  getRecommendedSlots,
  calculateOptimalTime,
  formatTimeForDisplay,
  calculateTimeDifference
};