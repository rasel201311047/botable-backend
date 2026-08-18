const OnboardingService = require('./onboarding.service');

class OnboardingController {
  /**
   * @desc    Get available shifts
   * @route   GET /api/onboarding/shifts
   * @access  Private
   */
  static async getShifts(req, res, next) {
    try {
      const shifts = await OnboardingService.getShifts();

      res.status(200).json({
        status: 'success',
        data: { shifts }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get available goals
   * @route   GET /api/onboarding/goals
   * @access  Private
   */
  static async getGoals(req, res, next) {
    try {
      const goals = await OnboardingService.getGoals();

      res.status(200).json({
        status: 'success',
        data: { goals }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update user shift
   * @route   PUT /api/onboarding/shift
   * @access  Private
   */
  static async updateShift(req, res, next) {
    try {
      const { shiftType } = req.body;

      if (!shiftType) {
        return res.status(400).json({
          status: 'error',
          message: 'Please select a shift'
        });
      }

      const user = await OnboardingService.updateUserShift(req.user.id, shiftType);

      res.status(200).json({
        status: 'success',
        message: 'Shift updated successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update user goal
   * @route   PUT /api/onboarding/goal
   * @access  Private
   */
  static async updateGoal(req, res, next) {
    try {
      const { goalType } = req.body;

      if (!goalType) {
        return res.status(400).json({
          status: 'error',
          message: 'Please select a goal'
        });
      }

      const user = await OnboardingService.updateUserGoal(req.user.id, goalType);

      res.status(200).json({
        status: 'success',
        message: 'Goal updated successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Complete onboarding
   * @route   POST /api/onboarding/complete
   * @access  Private
   */
  static async completeOnboarding(req, res, next) {
    try {
      const user = await OnboardingService.completeOnboarding(req.user.id);

      res.status(200).json({
        status: 'success',
        message: 'Onboarding completed successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get onboarding status
   * @route   GET /api/onboarding/status
   * @access  Private
   */
  static async getStatus(req, res, next) {
    try {
      const user = req.user;

      res.status(200).json({
        status: 'success',
        data: {
          shiftType: user.shiftType,
          goalType: user.goalType,
          onboardingCompleted: user.onboardingCompleted
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Seed default data (admin only)
   * @route   POST /api/onboarding/seed
   * @access  Private/Admin
   */
  static async seedDefaultData(req, res, next) {
    try {
      await OnboardingService.seedDefaultData();

      res.status(200).json({
        status: 'success',
        message: 'Default data seeded successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = OnboardingController;