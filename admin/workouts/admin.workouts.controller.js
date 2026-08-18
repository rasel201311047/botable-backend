const Workout = require('../../modules/workout/workout.model');
const logger = require('../../utils/logger');
const { uploadWorkoutFileToCloudinary } = require('../../config/upload');

class AdminWorkoutsController {
  /**
   * @desc    Get all workouts (including system workouts)
   * @route   GET /api/admin/workouts
   * @access  Private/Admin
   */
  static async getWorkouts(req, res, next) {
    try {
      const { page = 1, limit = 20, search, category, intensity, isActive } = req.query;

      // Build query
      const query = {};

      if (search) {
        query.$text = { $search: search };
      }

      if (category) {
        query.category = category;
      }

      if (intensity) {
        query.intensity = intensity;
      }

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const skip = (page - 1) * limit;

      const workouts = await Workout.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await Workout.countDocuments(query);

      res.status(200).json({
        status: 'success',
        data: workouts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error(`Admin get workouts error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Create system workout
   * @route   POST /api/admin/workouts
   * @access  Private/Admin
   */
  static async createWorkout(req, res, next) {
    try {
      let workoutData = req.body;

      // Handle form-data (when req.body is empty object but data comes as strings)
      if (workoutData && Object.keys(workoutData).length === 0) {
        // Check if data is sent as form fields
        if (req.body.title || req.body.durationMinutes) {
          workoutData = req.body;
        } else {
          return res.status(400).json({
            status: 'error',
            message: 'Request body is required',
          });
        }
      }

      // Parse JSON strings from form-data
      let parsedData = {};
      try {
        // If data comes as JSON string (from form-data)
        if (typeof workoutData === 'string') {
          parsedData = JSON.parse(workoutData);
        } else {
          parsedData = { ...workoutData };
        }

        // Parse exercises if it's a string
        if (typeof parsedData.exercises === 'string') {
          parsedData.exercises = JSON.parse(parsedData.exercises);
        }

        // Parse equipment if it's a string
        if (typeof parsedData.equipment === 'string') {
          parsedData.equipment = JSON.parse(parsedData.equipment);
        }

        // Parse tags if it's a string
        if (typeof parsedData.tags === 'string') {
          parsedData.tags = JSON.parse(parsedData.tags);
        }

        // Convert string numbers to numbers
        if (typeof parsedData.durationMinutes === 'string') {
          parsedData.durationMinutes = parseInt(parsedData.durationMinutes);
        }

        // Handle file upload (upload to Cloudinary)
        if (req.files && req.files.length > 0) {
          parsedData.imageUrl = await uploadWorkoutFileToCloudinary(req.files[0]);
        }
      } catch (parseError) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid JSON format in form data',
        });
      }

      // Validate required fields
      if (!parsedData.title || !parsedData.title.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Title is required',
        });
      }

      if (!parsedData.durationMinutes || parsedData.durationMinutes < 1) {
        return res.status(400).json({
          status: 'error',
          message: 'Duration in minutes is required and must be at least 1',
        });
      }

      // Validate exercises if provided
      if (parsedData.exercises && Array.isArray(parsedData.exercises)) {
        for (let i = 0; i < parsedData.exercises.length; i++) {
          const exercise = parsedData.exercises[i];
          if (!exercise.name || !exercise.name.trim()) {
            return res.status(400).json({
              status: 'error',
              message: `Exercise ${i + 1}: Name is required`,
            });
          }
        }
      }

      // System workouts have null userId and are always public
      const workout = await Workout.create({
        ...parsedData,
        userId: null,
        isPublic: true, // Override to ensure system workouts are always public
        isActive: true, // Ensure system workouts are active by default
      });

      res.status(201).json({
        status: 'success',
        message: 'Workout created successfully',
        data: workout,
      });
    } catch (error) {
      logger.error(`Admin create workout error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Update workout
   * @route   PUT /api/admin/workouts/:id
   * @access  Private/Admin
   */
  static async updateWorkout(req, res, next) {
    try {
      const { id } = req.params;
      let updateData = req.body;

      // Handle form-data parsing similar to createWorkout
      if (updateData && Object.keys(updateData).length === 0) {
        if (req.body.title || req.body.durationMinutes) {
          updateData = req.body;
        }
      }

      let parsedData = {};
      try {
        if (typeof updateData === 'string') {
          parsedData = JSON.parse(updateData);
        } else {
          parsedData = { ...updateData };
        }

        // Parse JSON strings
        if (typeof parsedData.exercises === 'string') {
          parsedData.exercises = JSON.parse(parsedData.exercises);
        }
        if (typeof parsedData.equipment === 'string') {
          parsedData.equipment = JSON.parse(parsedData.equipment);
        }
        if (typeof parsedData.tags === 'string') {
          parsedData.tags = JSON.parse(parsedData.tags);
        }
        if (typeof parsedData.durationMinutes === 'string') {
          parsedData.durationMinutes = parseInt(parsedData.durationMinutes);
        }

        // Handle file upload (upload to Cloudinary)
        if (req.files && req.files.length > 0) {
          parsedData.imageUrl = await uploadWorkoutFileToCloudinary(req.files[0]);
        }
      } catch (parseError) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid JSON format in form data',
        });
      }

      const workout = await Workout.findByIdAndUpdate(id, parsedData, {
        returnDocument: 'after',
        runValidators: true,
      });

      if (!workout) {
        return res.status(404).json({
          status: 'error',
          message: 'Workout not found',
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Workout updated successfully',
        data: workout,
      });
    } catch (error) {
      logger.error(`Admin update workout error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Delete workout
   * @route   DELETE /api/admin/workouts/:id
   * @access  Private/Admin
   */
  static async deleteWorkout(req, res, next) {
    try {
      const { id } = req.params;

      const workout = await Workout.findById(id);
      if (!workout) {
        return res.status(404).json({
          status: 'error',
          message: 'Workout not found',
        });
      }

      // For system workouts, mark as inactive
      // For user workouts, admin can delete them
      if (workout.userId === null) {
        workout.isActive = false;
        await workout.save();
      } else {
        await Workout.findByIdAndDelete(id);
      }

      res.status(200).json({
        status: 'success',
        message: 'Workout deleted successfully',
      });
    } catch (error) {
      logger.error(`Admin delete workout error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = AdminWorkoutsController;
