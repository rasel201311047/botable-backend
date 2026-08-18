const WorkoutService = require('./workout.service');
const { uploadWorkoutFileToCloudinary } = require('../../config/upload');
const WellnessEngine = require('../engine/wellnessEngine.service');

class WorkoutController {
  /**
   * @desc    Get all workouts
   * @route   GET /api/workouts
   * @access  Private
   */
  static async getWorkouts(req, res, next) {
    try {
      const { search, category, intensity, durationMin, durationMax, page = 1, limit = 20 } = req.query;

      const result = await WorkoutService.getWorkouts(req.user.id, {
        search,
        category,
        intensity,
        durationMin,
        durationMax,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      res.status(200).json({
        status: 'success',
        data: result.workouts,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get workout by ID
   * @route   GET /api/workouts/:id
   * @access  Private
   */
  static async getWorkoutById(req, res, next) {
    try {
      const { id } = req.params;

      const workout = await WorkoutService.getWorkoutById(id, req.user.id);

      res.status(200).json({
        status: 'success',
        data: workout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Create custom workout
   * @route   POST /api/workouts
   * @access  Private
   */
  static async createWorkout(req, res, next) {
    try {
      const {
        title,
        description,
        durationMinutes,
        category,
        intensity,
        exercises,
        equipment,
        imageUrl,
        videoUrl,
        tags,
        isPublic,
      } = req.body;

      if (!title || !durationMinutes) {
        return res.status(400).json({
          status: 'error',
          message: 'Title and duration are required',
        });
      }

      // Handle uploaded files
      let finalImageUrl = imageUrl;
      let finalVideoUrl = videoUrl;

      // Check for uploaded image file (upload to Cloudinary)
      if (req.files && req.files.image && req.files.image[0]) {
        finalImageUrl = await uploadWorkoutFileToCloudinary(req.files.image[0]);
      }

      // Check for uploaded video file (upload to Cloudinary)
      if (req.files && req.files.video && req.files.video[0]) {
        finalVideoUrl = await uploadWorkoutFileToCloudinary(req.files.video[0]);
      }

      // Parse JSON strings from form-data
      let parsedExercises = exercises;
      if (typeof exercises === 'string') {
        try { parsedExercises = JSON.parse(exercises); } catch (e) {}
      }

      let parsedEquipment = equipment;
      if (typeof equipment === 'string') {
        try { parsedEquipment = JSON.parse(equipment); } catch (e) {}
      }

      let parsedTags = tags;
      if (typeof tags === 'string') {
        try { parsedTags = JSON.parse(tags); } catch (e) {}
      }

      const workout = await WorkoutService.createWorkout(req.user.id, {
        title,
        description,
        durationMinutes: parseInt(durationMinutes),
        category,
        intensity,
        exercises: parsedExercises,
        equipment: parsedEquipment,
        imageUrl: finalImageUrl,
        videoUrl: finalVideoUrl,
        tags: parsedTags,
        isPublic: isPublic === 'true' || isPublic === true,
      });

      res.status(201).json({
        status: 'success',
        message: 'Workout created successfully',
        data: workout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update workout
   * @route   PUT /api/workouts/:id
   * @access  Private
   */
  static async updateWorkout(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      // Handle uploaded files (upload to Cloudinary)
      if (req.files) {
        // Check for uploaded image file
        if (req.files.image && req.files.image[0]) {
          updateData.imageUrl = await uploadWorkoutFileToCloudinary(req.files.image[0]);
        }

        // Check for uploaded video file
        if (req.files.video && req.files.video[0]) {
          updateData.videoUrl = await uploadWorkoutFileToCloudinary(req.files.video[0]);
        }
      }

      const workout = await WorkoutService.updateWorkout(id, req.user.id, updateData);

      res.status(200).json({
        status: 'success',
        message: 'Workout updated successfully',
        data: workout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete workout
   * @route   DELETE /api/workouts/:id
   * @access  Private
   */
  static async deleteWorkout(req, res, next) {
    try {
      const { id } = req.params;

      await WorkoutService.deleteWorkout(id, req.user.id);

      res.status(200).json({
        status: 'success',
        message: 'Workout deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Upload workout photo
   * @route   PUT /api/workouts/:id/photo
   * @access  Private
   */
  static async uploadWorkoutPhoto(req, res, next) {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'Photo file is required',
        });
      }

      const imageUrl = await uploadWorkoutFileToCloudinary(req.file);

      const workout = await WorkoutService.updateWorkout(id, req.user.id, { imageUrl });

      res.status(200).json({
        status: 'success',
        message: 'Workout photo uploaded successfully',
        data: workout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Log workout completion
   * @route   POST /api/workouts/log
   * @access  Private
   */
  static async logWorkout(req, res, next) {
    try {
      const {
        workoutId,
        scheduledTime,
        actualStartTime,
        actualEndTime,
        durationMinutes,
        intensity,
        completionPercentage,
        notes,
        rating,
        perceivedExertion,
        exercises,
        caloriesBurned,
      } = req.body;

      if (!workoutId) {
        return res.status(400).json({
          status: 'error',
          message: 'Workout ID is required',
        });
      }

      const workoutLog = await WorkoutService.logWorkout(req.user.id, {
        workoutId,
        scheduledTime,
        actualStartTime,
        actualEndTime,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : undefined,
        intensity,
        completionPercentage: completionPercentage ? parseInt(completionPercentage) : undefined,
        notes,
        rating,
        perceivedExertion,
        exercises,
        caloriesBurned,
      });

      // Send workout completion notification if workout is fully completed
      if (workoutLog.completionPercentage >= 100) {
        try {
          await WellnessEngine.recordEvent({
            userId: req.user.id,
            type: 'WORKOUT',
            category: 'workout',
            title: 'Workout completed',
            message: `${workoutLog.workoutId?.title || 'Workout'} was completed.`,
            sourceModule: 'workout',
            sourceId: workoutLog._id.toString(),
            deepLink: '/workout',
            priority: 'HIGH',
            dedupeKey: `workout:${workoutLog.workoutId?._id?.toString() || workoutLog.workoutId?.title || 'general'}`,
            payload: {
              workoutName: workoutLog.workoutId?.title || 'Workout',
              duration: workoutLog.durationMinutes,
              caloriesBurned: workoutLog.caloriesBurned,
              completionDate: workoutLog.actualEndTime,
              rating: workoutLog.rating,
            },
          });
        } catch (notificationError) {
          // Log error but don't fail the workout logging
          console.error('Failed to send workout completion notification:', notificationError.message);
        }
      }

      res.status(201).json({
        status: 'success',
        message: 'Workout logged successfully',
        data: workoutLog,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get workout logs
   * @route   GET /api/workouts/logs
   * @access  Private
   */
  static async getWorkoutLogs(req, res, next) {
    try {
      const { date, workoutId, completed, startDate, endDate, page = 1, limit = 20 } = req.query;

      const result = await WorkoutService.getWorkoutLogs(req.user.id, {
        date,
        workoutId,
        completed,
        startDate,
        endDate,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      res.status(200).json({
        status: 'success',
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get workout log by ID
   * @route   GET /api/workouts/logs/:id
   * @access  Private
   */
  static async getWorkoutLogById(req, res, next) {
    try {
      const { id } = req.params;

      const log = await WorkoutService.getWorkoutLogById(id);

      // Check ownership
      if (log.userId._id.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to access this workout log',
        });
      }

      res.status(200).json({
        status: 'success',
        data: log,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Update workout log
   * @route   PUT /api/workouts/logs/:id
   * @access  Private
   */
  static async updateWorkoutLog(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedLog = await WorkoutService.updateWorkoutLog(id, req.user.id, updateData);

      try {
        await WellnessEngine.recordEvent({
          userId: req.user.id,
          type: 'WORKOUT',
          category: 'workout',
          title: 'Workout updated',
          message: `${updatedLog.workoutId?.title || 'Workout'} was updated in your log.`,
          sourceModule: 'workout',
          sourceId: updatedLog._id.toString(),
          deepLink: '/workout',
          priority: 'MEDIUM',
          dedupeKey: `workout:update:${updatedLog.workoutId?._id?.toString() || updatedLog._id.toString()}`,
          payload: {
            workoutName: updatedLog.workoutId?.title || 'Workout',
            duration: updatedLog.durationMinutes,
            caloriesBurned: updatedLog.caloriesBurned,
            completionDate: updatedLog.actualEndTime,
            rating: updatedLog.rating,
          },
        });
      } catch (notificationError) {
        console.error('Failed to send workout update notification:', notificationError.message);
      }

      res.status(200).json({
        status: 'success',
        message: 'Workout log updated successfully',
        data: updatedLog,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Delete workout log
   * @route   DELETE /api/workouts/logs/:id
   * @access  Private
   */
  static async deleteWorkoutLog(req, res, next) {
    try {
      const { id } = req.params;

      await WorkoutService.deleteWorkoutLog(id, req.user.id);

      try {
        await WellnessEngine.recordEvent({
          userId: req.user.id,
          type: 'WORKOUT',
          category: 'workout',
          title: 'Workout deleted',
          message: 'A workout log was removed from your history.',
          sourceModule: 'workout',
          sourceId: id,
          deepLink: '/workout',
          priority: 'LOW',
          dedupeKey: `workout:delete:${id}`,
        });
      } catch (notificationError) {
        console.error('Failed to send workout delete notification:', notificationError.message);
      }

      res.status(200).json({
        status: 'success',
        message: 'Workout log deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get workout statistics
   * @route   GET /api/workouts/stats
   * @access  Private
   */
  static async getWorkoutStats(req, res, next) {
    try {
      const { period = 'week' } = req.query;

      const stats = await WorkoutService.getWorkoutStats(req.user.id, period);

      res.status(200).json({
        status: 'success',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get scheduled workouts
   * @route   GET /api/workouts/scheduled
   * @access  Private
   */
  static async getScheduledWorkouts(req, res, next) {
    try {
      const { date } = req.query;

      const scheduled = await WorkoutService.getScheduledWorkouts(req.user.id, date);

      res.status(200).json({
        status: 'success',
        data: scheduled,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Schedule a workout
   * @route   POST /api/workouts/schedule
   * @access  Private
   */
  static async scheduleWorkout(req, res, next) {
    try {
      const { workoutId, date, scheduledTime } = req.body;

      if (!workoutId || !date || !scheduledTime) {
        return res.status(400).json({
          status: 'error',
          message: 'Workout ID, date, and scheduled time are required',
        });
      }

      const schedule = await WorkoutService.scheduleWorkout(req.user.id, workoutId, date, scheduledTime);

      res.status(201).json({
        status: 'success',
        message: 'Workout scheduled successfully',
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Seed default workouts (admin only)
   * @route   POST /api/workouts/seed
   * @access  Private/Admin
   */
  static async seedDefaultWorkouts(req, res, next) {
    try {
      await WorkoutService.seedDefaultWorkouts();

      res.status(200).json({
        status: 'success',
        message: 'Default workouts seeded successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = WorkoutController;
