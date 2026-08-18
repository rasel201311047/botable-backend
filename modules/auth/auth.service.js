const User = require('../user/user.model');
const OTP = require('./otp.model');
const { generateOTP, generateOTPHash, verifyOTP, getOTPExpiration } = require('../../utils/otp');
const { sendOTPEmail } = require('../../config/email');
const { validateProfile } = require('../../utils/healthValidation');
const { validatePasswordStrength } = require('../../utils/passwordValidation');

const logger = require('../../utils/logger');
const validator = require('validator');

class AuthService {
  /**
   * Register new user
   */
  static async register(userData) {
    try {
      // Validate password strength
      const pwdValidation = validatePasswordStrength(userData.password);
      if (!pwdValidation.valid) {
        throw new Error(pwdValidation.message);
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Create new user
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        accountStatus: 'unverified',
        onboardingCompleted: false,
        phoneNumber: userData.phoneNumber || null,
        location:
          typeof userData.location === 'string'
            ? { city: userData.location }
            : userData.location || undefined,
      });

      // Generate email verification OTP
      await this.sendEmailVerificationOTP(user.email);

      // Remove password from response
      user.password = undefined;

      return {
        user,
        token: user.generateAuthToken(),
        accountStatus: user.accountStatus,
        nextRoute: '/verification',
      };
    } catch (error) {
      logger.error(`Register error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Login user - Direct login for verified users
   */
  static async login(email, password) {
    try {
      // Find user with password
      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        throw new Error('Invalid credentials');
      }

      const now = new Date();

      // Check if user is locked/disabled
      if (user.accountStatus === 'disabled' || !user.isActive) {
        throw new Error('Account is deactivated');
      }

      if (user.lockedUntil && user.lockedUntil > now) {
        throw new Error('Account is locked. Please try again later.');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          user.accountStatus = 'locked';
        }
        await user.save();
        throw new Error('Invalid credentials');
      }

      user.failedLoginAttempts = 0;
      user.lockedUntil = null;

      // Check if email is verified
      if (!user.isEmailVerified) {
        user.accountStatus = 'unverified';
        await user.save();
        throw new Error('Please verify your email first');
      }

      user.accountStatus = user.onboardingCompleted ? 'active' : 'onboarding_incomplete';

      // For verified users, return token directly (no OTP required)
      user.lastLogin = Date.now();
      await user.save();
      user.password = undefined;
      return {
        message: 'Login successful',
        user,
        token: user.generateAuthToken(),
        requiresOTP: false,
        accountStatus: user.accountStatus,
        nextRoute: user.onboardingCompleted ? '/' : '/onboarding',
      };
    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify login OTP - Step 2: Complete login after OTP verification
   * Note: Currently not used as verified users login directly
   */
  static async verifyLoginOTP(email, otp) {
    try {
      // Find the most recent unused login verification OTP for this email
      const otpRecord = await OTP.findOne({
        email,
        type: 'login_verification',
        isUsed: false,
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        throw new Error('No valid OTP found. Please login again.');
      }

      // Check attempts
      if (otpRecord.attempts >= 3) {
        throw new Error('Too many failed attempts. Please login again.');
      }

      // Verify OTP
      const isValid = verifyOTP(otp, email, otpRecord.expiresAt, otpRecord.hash);
      if (!isValid) {
        // Increment attempts
        otpRecord.attempts += 1;
        await otpRecord.save();
        throw new Error('Invalid OTP');
      }

      // Mark OTP as used
      otpRecord.isUsed = true;
      await otpRecord.save();

      // Find user and complete login
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('User not found');
      }

      // Update last login
      user.lastLogin = Date.now();
      await user.save();

      // Remove password from response
      user.password = undefined;

      return {
        user,
        token: user.generateAuthToken(),
      };
    } catch (error) {
      logger.error(`Verify login OTP error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send email verification OTP
   */
  static async sendEmailVerificationOTP(email) {
    try {
      const recent = await OTP.findOne({
        email,
        type: 'email_verification',
        isUsed: false,
        createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
      }).sort({ createdAt: -1 });

      if (recent) {
        throw new Error('Please wait before requesting another verification code');
      }

      await OTP.deleteMany({ email, type: 'email_verification', isUsed: false });

      const otp = generateOTP();
      const expiresAt = getOTPExpiration();
      const hash = generateOTPHash(otp, email, expiresAt);

      // Save OTP to database
      await OTP.create({
        email,
        otp,
        hash,
        type: 'email_verification',
        expiresAt,
        attempts: 0,
      });

      // Send OTP via email
      await sendOTPEmail(email, otp, 'email_verification');

      logger.info(`Email verification OTP sent to ${email}`);

      return { otp, expiresAt };
    } catch (error) {
      logger.error(`Send email verification OTP error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify email OTP - Handles all OTP types (email_verification, password_reset, login_verification)
   */
  static async verifyEmailOTP(email, otp) {
    try {
      // Find valid OTP for any type
      const otpRecord = await OTP.findOne({
        email,
        isUsed: false,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        throw new Error('Invalid or expired verification code');
      }

      // Check attempts
      if (otpRecord.attempts >= 3) {
        throw new Error('Too many attempts. Please request new OTP');
      }

      // Verify OTP
      const isValid = verifyOTP(otp, email, otpRecord.expiresAt, otpRecord.hash);

      if (!isValid) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        throw new Error('Wrong code. Please try again.');
      }

      // Mark OTP as used
      otpRecord.isUsed = true;
      await otpRecord.save();

      // Update user email verification status only for email_verification type
      if (otpRecord.type === 'email_verification') {
        await User.findOneAndUpdate(
          { email },
          { isEmailVerified: true, accountStatus: 'onboarding_incomplete' },
          { returnDocument: 'after' },
        );
      }

      return { success: true, type: otpRecord.type };
    } catch (error) {
      logger.error(`Verify email OTP error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send password reset OTP
   */
  static async sendPasswordResetOTP(email, ip = 'unknown') {
    try {
      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        // Return a successful neutral response to avoid user enumeration
        logger.info(`[AUDIT] Password reset requested for non-existent email: ${email} (IP: ${ip})`);
        return { success: true, neutral: true };
      }

      // Check rate limit (throttling): 1 request per 60 seconds
      const recent = await OTP.findOne({
        email,
        type: 'password_reset',
        isUsed: false,
        createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
      }).sort({ createdAt: -1 });

      if (recent) {
        logger.warn(`[AUDIT] Password reset request throttled for email: ${email} (IP: ${ip})`);
        throw new Error('Please wait before requesting another reset code');
      }

      // Invalidate older unused recovery attempts
      await OTP.deleteMany({ email, type: 'password_reset', isUsed: false });

      const otp = generateOTP();
      const expiresAt = getOTPExpiration();
      const hash = generateOTPHash(otp, email, expiresAt);

      // Save OTP to database
      await OTP.create({
        email,
        otp,
        hash,
        type: 'password_reset',
        expiresAt,
        attempts: 0,
      });

      // Send OTP via email
      await sendOTPEmail(email, otp, 'password_reset');

      logger.info(`[AUDIT] Password reset OTP sent to ${email} (User ID: ${user._id}) (IP: ${ip})`);

      return { otp, expiresAt };
    } catch (error) {
      logger.error(`Send password reset OTP error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset password - Requires prior OTP verification via /auth/verify-email
   */
  static async resetPassword(email, newPassword) {
    try {
      // Validate password strength
      const pwdValidation = validatePasswordStrength(newPassword);
      if (!pwdValidation.valid) {
        throw new Error(pwdValidation.message);
      }

      // Check if user exists
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        throw new Error('User not found');
      }

      // Prevent password reuse
      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        throw new Error('New password cannot be the same as your current password');
      }

      // Check if there's a recently verified password_reset OTP (within last 5 minutes)
      const verifiedOTP = await OTP.findOne({
        email,
        type: 'password_reset',
        isUsed: true,
        createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
      }).sort({ createdAt: -1 });

      if (!verifiedOTP) {
        throw new Error('Please verify your email with OTP first');
      }

      // Update user password and increment passwordVersion to invalidate active sessions
      user.password = newPassword;
      user.passwordVersion = (user.passwordVersion || 1) + 1;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();

      // Delete all password reset OTPs for this email
      await OTP.deleteMany({
        email,
        type: 'password_reset',
      });

      return true;
    } catch (error) {
      logger.error(`Reset password error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      logger.error(`Get profile error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId, updateData) {
    try {
      // Remove sensitive fields
      delete updateData.password;
      delete updateData.email;
      delete updateData.role;

      const validation = validateProfile(updateData);
      if (!validation.valid) {
        throw new Error(validation.errors.join('. '));
      }

      const user = await User.findByIdAndUpdate(userId, updateData, {
        returnDocument: 'after',
        runValidators: true,
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error(`Update profile error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update profile photo
   */
  static async updateProfilePhoto(userId, photoUrl) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { profilePhoto: photoUrl },
        { returnDocument: 'after' },
      );

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error(`Update profile photo error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Change password
   */
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      // Validate password strength
      const pwdValidation = validatePasswordStrength(newPassword);
      if (!pwdValidation.valid) {
        throw new Error(pwdValidation.message);
      }

      const user = await User.findById(userId).select('+password');

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Prevent password reuse
      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        throw new Error('New password cannot be the same as your current password');
      }

      // Update password and increment passwordVersion to invalidate active sessions
      user.password = newPassword;
      user.passwordVersion = (user.passwordVersion || 1) + 1;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();

      return true;
    } catch (error) {
      logger.error(`Change password error: ${error.message}`);
      throw error;
    }
  }

  static async changeEmail(userId, newEmail) {
    try {
      const email = newEmail.trim().toLowerCase();
      if (!validator.isEmail(email)) {
        throw new Error('Please provide a valid email address');
      }

      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== userId) {
        throw new Error('Email is already in use by another account');
      }

      // Update user details
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Safe update: invalidate current email verification status
      user.email = email;
      user.isEmailVerified = false;
      user.accountStatus = 'unverified';
      await user.save();

      // Clean old OTPs and send new OTP
      await OTP.deleteMany({ email, type: 'email_verification', isUsed: false });
      
      const otp = generateOTP();
      const expiresAt = getOTPExpiration();
      const hash = generateOTPHash(otp, email, expiresAt);

      await OTP.create({
        email,
        otp,
        hash,
        type: 'email_verification',
        expiresAt,
        attempts: 0,
      });

      await sendOTPEmail(email, otp, 'email_verification');
      logger.info(`[AUDIT] Email updated and verification OTP sent to ${email} (User ID: ${user._id})`);

      // Generate new token with updated email
      const token = user.generateAuthToken();

      return { user, token };
    } catch (error) {
      logger.error(`Change email error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AuthService;
