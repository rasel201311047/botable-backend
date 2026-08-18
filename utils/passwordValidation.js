/**
 * Validate password strength policy
 * @param {string} password - The plain text password to validate
 * @returns {object} { valid: boolean, message?: string }
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  // Matches any non-alphanumeric character
  if (!/[^A-Za-z\d]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }

  return { valid: true };
}

module.exports = {
  validatePasswordStrength,
};
