const User = require('../../modules/user/user.model');
const logger = require('../../utils/logger');

class AdminUsersController {
  /**
   * @desc    Get all users with comprehensive filters and aggregate stats
   * @route   GET /api/admin/users
   * @access  Private/Admin
   */
  static async getUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, search, status = 'all', subscription, location } = req.query;

      // Build query
      const query = {};

      // Search by name, email, or location
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'location.city': { $regex: search, $options: 'i' } },
          { 'location.country': { $regex: search, $options: 'i' } },
        ];
      }

      // Filter by location
      if (location) {
        query.$or = [
          { 'location.city': { $regex: location, $options: 'i' } },
          { 'location.country': { $regex: location, $options: 'i' } },
        ];
      }

      // Filter by status
      if (status && status !== 'all') {
        if (status === 'active') {
          query.isActive = true;
        } else if (status === 'blocked') {
          query.isActive = false;
        }
      }

      // Filter by subscription
      if (subscription && subscription !== 'all') {
        query['subscription.plan'] = subscription;
      }

      // Get aggregate statistics
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const blockedUsers = await User.countDocuments({ isActive: false });
      const premiumUsers = await User.countDocuments({
        'subscription.plan': { $in: ['monthly', 'yearly'] },
        'subscription.isActive': true,
      });

      const skip = (page - 1) * limit;

      const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count for filtered results
      const filteredTotal = await User.countDocuments(query);

      // Format response with comprehensive user information
      const formattedUsers = users.map(user => ({
        id: user._id,

        // Basic Info
        username: user.name,
        email: user.email,
        profilePhoto: user.profilePhoto || null,

        // Contact Info
        phoneNumber: user.phoneNumber || 'N/A',

        // Physical Info
        height: user.height || 'N/A',
        weight: user.weight || 'N/A',
        age: user.age || 'N/A',
        gender: user.gender || 'N/A',

        // Location
        location: user.location || { city: 'N/A', country: 'N/A' },

        // Subscription Info
        subscriptionPlan: user.subscription?.plan || 'free',
        subscriptionStatus: user.subscription?.isActive ? 'Active' : 'Inactive',
        subscriptionStartDate: user.subscription?.startDate || null,
        subscriptionEndDate: user.subscription?.endDate || null,

        // Account Info
        joinDate: user.createdAt,
        lastLogin: user.lastLogin || null,
        status: user.isActive ? 'Active' : 'Blocked',
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        onboardingCompleted: user.onboardingCompleted,

        // Goal Info
        shiftType: user.shiftType || 'N/A',
        goalType: user.goalType || 'N/A',
      }));

      res.status(200).json({
        status: 'success',
        data: {
          aggregateData: {
            totalUsers,
            activeUsers,
            blockedUsers,
            premiumUsers,
            freeUsers: totalUsers - premiumUsers,
            conversionRate: totalUsers > 0 ? ((premiumUsers / totalUsers) * 100).toFixed(2) + '%' : '0%',
          },
          users: formattedUsers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: filteredTotal,
            pages: Math.ceil(filteredTotal / limit),
          },
          filters: {
            status: status,
            subscription: subscription || 'all',
            location: location || 'all',
            search: search || '',
          },
        },
      });
    } catch (error) {
      logger.error(`Admin get users error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get user by ID
   * @route   GET /api/admin/users/:id
   * @access  Private/Admin
   */
  static async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findById(id).select('-password').lean();

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
        });
      }

      // Get user statistics
      const stats = await AdminUsersController.getUserStats(id);

      res.status(200).json({
        status: 'success',
        data: {
          ...user,
          stats,
        },
      });
    } catch (error) {
      logger.error(`Admin get user by ID error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Update user
   * @route   PUT /api/admin/users/:id
   * @access  Private/Admin
   */
  static async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove sensitive fields
      delete updateData.password;
      delete updateData.email; // Email should be changed via separate process

      const user = await User.findByIdAndUpdate(id, updateData, {
        returnDocument: 'after',
        runValidators: true,
      }).select('-password');

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'User updated successfully',
        data: user,
      });
    } catch (error) {
      logger.error(`Admin update user error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Delete user
   * @route   DELETE /api/admin/users/:id
   * @access  Private/Admin
   */
  static async deleteUser(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
        });
      }

      // Soft delete
      user.isActive = false;
      await user.save();

      res.status(200).json({
        status: 'success',
        message: 'User deactivated successfully',
      });
    } catch (error) {
      logger.error(`Admin delete user error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Update user status
   * @route   PUT /api/admin/users/:id/status
   * @access  Private/Admin
   */
  static async updateUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          status: 'error',
          message: 'isActive must be a boolean',
        });
      }

      const user = await User.findByIdAndUpdate(id, { isActive }, { returnDocument: 'after' }).select(
        '-password',
      );

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
        });
      }

      res.status(200).json({
        status: 'success',
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: user,
      });
    } catch (error) {
      logger.error(`Admin update user status error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Block user
   * @route   PUT /api/admin/users/:id/block
   * @access  Private/Admin
   */
  static async blockUser(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
        });
      }

      // Prevent blocking admin users
      if (user.role === 'admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Cannot block admin users',
        });
      }

      user.isActive = false;
      await user.save();

      res.status(200).json({
        status: 'success',
        message: 'User blocked successfully',
        data: {
          userId: user._id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
        },
      });
    } catch (error) {
      logger.error(`Admin block user error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Unblock user
   * @route   PUT /api/admin/users/:id/unblock
   * @access  Private/Admin
   */
  static async unblockUser(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
        });
      }

      user.isActive = true;
      await user.save();

      res.status(200).json({
        status: 'success',
        message: 'User unblocked successfully',
        data: {
          userId: user._id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
        },
      });
    } catch (error) {
      logger.error(`Admin unblock user error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(userId) {
    try {
      const [workoutCount, mealCount, sleepLogCount, nutritionTarget] = await Promise.all([
        // Get workout count
        require('../../modules/workout/workoutLog.model').countDocuments({ userId }),
        // Get meal count
        require('../../modules/nutrition/meal.model').countDocuments({ userId }),
        // Get sleep log count
        require('../../modules/sleep-recovery/sleepLog.model').countDocuments({ userId }),
        // Get nutrition target
        require('../../modules/nutrition/nutritionTarget.model').findOne({ userId }),
      ]);

      return {
        workoutCount,
        mealCount,
        sleepLogCount,
        hasNutritionTarget: !!nutritionTarget,
        last30Days: {
          // You would implement actual 30-day stats here
          workouts: 0,
          meals: 0,
          sleepLogs: 0,
        },
      };
    } catch (error) {
      logger.error(`Get user stats error: ${error.message}`);
      return null;
    }
  }
}

module.exports = AdminUsersController;
