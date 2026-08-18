const AuthService = require('./auth.service');

class AuthController {
  /**
   * @desc    Register user
   * @route   POST /api/auth/register
   * @access  Public
   */
  static async register(req, res, next) {
    try {
      const { name, fullName, email, password, confirmPassword, phoneNumber, location } = req.body;
      const resolvedName = name || fullName;

      // Validate input
      if (!resolvedName || !email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide name, email, and password',
        });
      }

      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Passwords do not match',
        });
      }

      const result = await AuthService.register({
        name: resolvedName,
        email,
        password,
        phoneNumber,
        location,
      });

      res.status(201).json({
        status: 'success',
        message: 'Registration successful. Please verify your email.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Login user
   * @route   POST /api/auth/login
   * @access  Public
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide email and password',
        });
      }

      const result = await AuthService.login(email, password);

      res.status(200).json({
        status: 'success',
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Verify login OTP (Currently not used - verified users login directly)
   * @route   POST /api/auth/verify-login-otp
   * @access  Public
   */
  static async verifyLoginOTP(req, res, next) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide email and OTP',
        });
      }

      const result = await AuthService.verifyLoginOTP(email, otp);

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Send email verification OTP
   * @route   POST /api/auth/send-verification-otp
   * @access  Public
   */
  static async sendVerificationOTP(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide email',
        });
      }

      await AuthService.sendEmailVerificationOTP(email);

      res.status(200).json({
        status: 'success',
        message: 'Verification OTP sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Verify email with OTP
   * @route   POST /api/auth/verify-email
   * @access  Public
   */
  static async verifyEmail(req, res, next) {
    try {
      const { email, otp, purpose } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide email and OTP',
        });
      }

      if (purpose === 'password_reset') {
        await AuthService.verifyEmailOTP(email, otp);
      } else {
        await AuthService.verifyEmailOTP(email, otp);
      }

      res.status(200).json({
        status: 'success',
        message: 'Email verified successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Resend email verification OTP
   * @route   POST /api/auth/resend-otp
   * @access  Public
   */
  static async resendOTP(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide email',
        });
      }

      // Check if user exists and is not verified
      const user = await require('../user/user.model').findOne({ email });
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          status: 'error',
          message: 'Email is already verified',
        });
      }

      await AuthService.sendEmailVerificationOTP(email);

      res.status(200).json({
        status: 'success',
        message: 'Verification OTP resent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Resend forgot password OTP
   * @route   POST /api/auth/resend-forgot-password-otp
   * @access  Public
   */
  static async resendForgotPasswordOTP(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide email',
        });
      }

      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await AuthService.sendPasswordResetOTP(email, ip);

      res.status(200).json({
        status: 'success',
        message: 'Password reset OTP resent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide email',
        });
      }

      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await AuthService.sendPasswordResetOTP(email, ip);

      res.status(200).json({
        status: 'success',
        message: 'Password reset OTP sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Reset password (requires prior OTP verification via /auth/verify-email)
   * @route   POST /api/auth/reset-password
   * @access  Public
   */
  static async resetPassword(req, res, next) {
    try {
      const { email, newPassword, confirmPassword } = req.body;

      if (!email || !newPassword || !confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide all required fields',
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Passwords do not match',
        });
      }

      await AuthService.resetPassword(email, newPassword);

      res.status(200).json({
        status: 'success',
        message: 'Password reset successful',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Backward-compatible alias for auth clients
   * @route   POST /api/auth/signin
   */
  static async signinAlias(req, res, next) {
    return AuthController.login(req, res, next);
  }

  /**
   * @desc    Backward-compatible alias for auth clients
   * @route   POST /api/auth/signup
   */
  static async signupAlias(req, res, next) {
    return AuthController.register(req, res, next);
  }

  /**
   * @desc    Backward-compatible alias for OTP clients
   * @route   POST /api/auth/verify-otp
   */
  static async verifyOtpAlias(req, res, next) {
    return AuthController.verifyEmail(req, res, next);
  }

  /**
   * @desc    Get current user profile
   * @route   GET /api/auth/me
   * @access  Private
   */
  static async getMe(req, res, next) {
    try {
      const user = await AuthService.getProfile(req.user.id);

      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update user profile
   * @route   PUT /api/auth/update-profile
   * @access  Private
   */
  static async updateProfile(req, res, next) {
    try {
      const user = await AuthService.updateProfile(req.user.id, req.body);

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Change password
   * @route   PUT /api/auth/change-password
   * @access  Private
   */
  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide all password fields',
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          status: 'error',
          message: 'New passwords do not match',
        });
      }

      await AuthService.changePassword(req.user.id, currentPassword, newPassword);

      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update profile photo
   * @route   PUT /api/auth/profile-photo
   * @access  Private
   */
  static async updateProfilePhoto(req, res, next) {
    try {
      // In a real application, you would upload the file to cloud storage
      // and get the URL. For now, we'll expect the URL in the request body
      const { photoUrl } = req.body;

      if (!photoUrl) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide photo URL',
        });
      }

      const user = await AuthService.updateProfilePhoto(req.user.id, photoUrl);

      res.status(200).json({
        status: 'success',
        message: 'Profile photo updated successfully',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  static async changeEmail(req, res, next) {
    try {
      const { newEmail } = req.body;

      if (!newEmail) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide new email address',
        });
      }

      const { user, token } = await AuthService.changeEmail(req.user.id, newEmail);

      res.status(200).json({
        status: 'success',
        message: 'Email updated successfully. Please verify your new email address.',
        data: { user, token },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
