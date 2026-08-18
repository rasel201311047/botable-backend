const UserService = require('./user.service');
const { deleteFile, uploadProfilePhotoToCloudinary } = require('../../config/upload');
const path = require('path');
const logger = require('../../utils/logger');

class UserController {
  /**
   * @desc    Get user profile
   * @route   GET /api/users/profile
   * @access  Private
   */
  static async getProfile(req, res, next) {
    try {
      const user = await UserService.getProfile(req.user.id);

      res.status(200).json({
        status: 'success',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update user profile
   * @route   PUT /api/users/profile
   * @access  Private
   */
  static async updateProfile(req, res, next) {
    try {
      const user = await UserService.updateProfile(req.user.id, req.body);

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update user preferences
   * @route   PUT /api/users/preferences
   * @access  Private
   */
  static async updatePreferences(req, res, next) {
    try {
      const { preferences } = req.body;

      if (!preferences) {
        return res.status(400).json({
          status: 'error',
          message: 'Preferences data is required'
        });
      }

      const user = await UserService.updatePreferences(req.user.id, preferences);

      res.status(200).json({
        status: 'success',
        message: 'Preferences updated successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update notification settings
   * @route   PUT /api/users/notifications
   * @access  Private
   */
  static async updateNotifications(req, res, next) {
    try {
      const { notifications } = req.body;

      if (!notifications) {
        return res.status(400).json({
          status: 'error',
          message: 'Notifications data is required'
        });
      }

      const user = await UserService.updateNotifications(req.user.id, notifications);

      res.status(200).json({
        status: 'success',
        message: 'Notification settings updated successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get user statistics
   * @route   GET /api/users/stats
   * @access  Private
   */
  static async getUserStats(req, res, next) {
    try {
      const stats = await UserService.getUserStats(req.user.id);

      res.status(200).json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete user account
   * @route   DELETE /api/users/account
   * @access  Private
   */
  static async deleteAccount(req, res, next) {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          status: 'error',
          message: 'Password is required for account deletion'
        });
      }

      await UserService.deleteAccount(req.user.id, password);

      res.status(200).json({
        status: 'success',
        message: 'Account deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Upload profile photo
   * @route   POST /api/users/profile-photo
   * @access  Private
   */
  static async uploadProfilePhoto(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'Please upload a profile photo'
        });
      }

      // Upload to Cloudinary
      const photoUrl = await uploadProfilePhotoToCloudinary(req.file, req.user.id);

      // Get user to check existing photo
      const user = await UserService.getProfile(req.user.id);

      // Delete old photo from Cloudinary if exists
      if (user.profilePhoto && user.profilePhoto.includes('cloudinary.com')) {
        try {
          await deleteFile(user.profilePhoto);
        } catch (deleteError) {
          logger.warn(`Failed to delete old profile photo: ${deleteError.message}`);
        }
      }

      // Update user with new photo URL
      const updatedUser = await UserService.updateProfilePhoto(req.user.id, photoUrl);

      res.status(200).json({
        status: 'success',
        message: 'Profile photo uploaded successfully',
        data: { user: updatedUser }
      });
    } catch (error) {
      // Clean up uploaded file if service failed
      if (req.file) {
        try {
          await deleteFile(req.file.path);
        } catch (cleanupError) {
          logger.error(`Failed to cleanup uploaded file: ${cleanupError.message}`);
        }
      }

      next(error);
    }
  }

  /**
   * @desc    Get user activity feed
   * @route   GET /api/users/activity
   * @access  Private
   */
  static async getActivityFeed(req, res, next) {
    try {
      const { limit = 20, page = 1 } = req.query;

      const activities = await UserService.getActivityFeed(
        req.user.id,
        parseInt(limit),
        parseInt(page)
      );

      res.status(200).json({
        status: 'success',
        data: activities
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
