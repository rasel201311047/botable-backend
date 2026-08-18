const SHIFT_TYPES = ['fixed_night', 'rotating', 'early_morning', 'off_shift'];
const GOAL_TYPES = ['fat_loss', 'strength_building', 'maintenance'];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizePhone = (value) => {
  if (!value) return null;
  const cleaned = String(value).replace(/[^\d+]/g, '');
  return cleaned.length ? cleaned : null;
};

const normalizeUnits = (payload = {}) => {
  const normalized = { ...payload };

  if (normalized.height !== undefined && normalized.height !== null) {
    normalized.height = toNumber(normalized.height);
  }

  if (normalized.weight !== undefined && normalized.weight !== null) {
    normalized.weight = toNumber(normalized.weight);
  }

  if (normalized.dateOfBirth) {
    const dob = new Date(normalized.dateOfBirth);
    normalized.dateOfBirth = Number.isNaN(dob.getTime()) ? null : dob;
  }

  if (normalized.phoneNumber) {
    normalized.phoneNumber = normalizePhone(normalized.phoneNumber);
  }

  if (normalized.emergencyContact?.phoneNumber) {
    normalized.emergencyContact = {
      ...normalized.emergencyContact,
      phoneNumber: normalizePhone(normalized.emergencyContact.phoneNumber),
    };
  }

  if (normalized.preferences?.measurementSystem) {
    normalized.preferences = {
      ...normalized.preferences,
      measurementSystem: String(normalized.preferences.measurementSystem).toLowerCase(),
    };
  }

  return normalized;
};

const validateProfile = (payload = {}) => {
  const normalized = normalizeUnits(payload);
  const errors = [];

  if (normalized.height !== undefined && normalized.height !== null) {
    if (normalized.height < 50 || normalized.height > 260) {
      errors.push('Height must be between 50 cm and 260 cm');
    }
  }

  if (normalized.weight !== undefined && normalized.weight !== null) {
    if (normalized.weight < 20 || normalized.weight > 300) {
      errors.push('Weight must be between 20 kg and 300 kg');
    }
  }

  if (normalized.dateOfBirth) {
    const ageMs = Date.now() - normalized.dateOfBirth.getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    if (normalized.dateOfBirth > new Date()) {
      errors.push('Date of birth cannot be in the future');
    } else if (ageYears < 13 || ageYears > 120) {
      errors.push('Date of birth must produce an age between 13 and 120');
    }
  }

  if (normalized.gender && !['male', 'female', 'other', 'prefer_not_to_say'].includes(normalized.gender)) {
    errors.push('Gender must be male, female, other, or prefer_not_to_say');
  }

  if (normalized.email && !/^\S+@\S+\.\S+$/.test(String(normalized.email))) {
    errors.push('Email must be valid');
  }

  if (normalized.phoneNumber && String(normalized.phoneNumber).length < 7) {
    errors.push('Phone number is too short');
  }

  if (normalized.emergencyContact?.phoneNumber && String(normalized.emergencyContact.phoneNumber).length < 7) {
    errors.push('Emergency contact phone number is too short');
  }

  if (normalized.preferences?.measurementSystem && !['metric', 'imperial'].includes(normalized.preferences.measurementSystem)) {
    errors.push('Measurement system must be metric or imperial');
  }

  return {
    valid: errors.length === 0,
    errors,
    value: normalized,
  };
};

const validateMealTotals = ({ calories, protein, carbs, fat }) => {
  const cals = toNumber(calories);
  const p = toNumber(protein);
  const c = toNumber(carbs);
  const f = toNumber(fat);

  if ([cals, p, c, f].some((v) => v === null)) {
    return { valid: false, message: 'Calories and macros must be numbers' };
  }

  if (cals <= 0 && p <= 0 && c <= 0 && f <= 0) {
    return { valid: false, message: 'Meal must contain calories or macros' };
  }

  if (cals < 0 || p < 0 || c < 0 || f < 0) {
    return { valid: false, message: 'Macros and calories cannot be negative' };
  }

  const estimatedCalories = Math.round(p * 4 + c * 4 + f * 9);
  const calorieDelta = Math.abs(estimatedCalories - cals);
  if (calorieDelta > Math.max(80, Math.round(estimatedCalories * 0.25))) {
    return {
      valid: false,
      message: 'Calories are not consistent with macros',
      estimatedCalories,
    };
  }

  return { valid: true, estimatedCalories };
};

const validateTimeRange = (startTime, endTime) => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return { valid: false, message: 'Invalid time format. Use HH:MM (24-hour format)' };
  }

  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  if (end < start) {
    end.setDate(end.getDate() + 1);
  }

  const durationMinutes = Math.round((end - start) / (1000 * 60));
  if (durationMinutes <= 0) {
    return { valid: false, message: 'End time must be after start time' };
  }

  return { valid: true, durationMinutes };
};

module.exports = {
  SHIFT_TYPES,
  GOAL_TYPES,
  normalizeUnits,
  validateProfile,
  validateMealTotals,
  validateTimeRange,
};
