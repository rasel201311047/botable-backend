const crypto = require('crypto');

/**
 * Generate a 6-digit OTP
 * @returns {string} 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate OTP hash for verification
 * @param {string} otp - The OTP to hash
 * @param {string} email - User's email
 * @param {Date} expiresAt - Expiration time
 * @returns {string} Hashed OTP
 */
const generateOTPHash = (otp, email, expiresAt) => {
  const data = `${otp}.${email}.${expiresAt.getTime()}`;
  return crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(data)
    .digest('hex');
};

/**
 * Verify OTP
 * @param {string} otp - User provided OTP
 * @param {string} email - User's email
 * @param {Date} expiresAt - Expiration time
 * @param {string} hash - Stored hash
 * @returns {boolean} True if valid
 */
const verifyOTP = (otp, email, expiresAt, hash) => {
  // Check if OTP is expired
  if (new Date() > expiresAt) {
    return false;
  }

  const expectedHash = generateOTPHash(otp, email, expiresAt);
  return hash === expectedHash;
};

/**
 * Generate OTP expiration time
 * @returns {Date} Expiration time
 */
const getOTPExpiration = () => {
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + parseInt(process.env.OTP_EXPIRE_MINUTES) || 10);
  return expires;
};

module.exports = {
  generateOTP,
  generateOTPHash,
  verifyOTP,
  getOTPExpiration
};