const express = require('express');
const router = express.Router();
const WorkoutController = require('./workout.controller');
const { protect, admin } = require('../../middlewares/auth.middleware');
const { uploadWorkoutImage } = require('../../config/upload');

// Workout logging - MUST come before /:id to avoid route conflicts
router.post('/log', protect, WorkoutController.logWorkout);
router.get('/logs', protect, WorkoutController.getWorkoutLogs);
router.get('/logs/:id', protect, WorkoutController.getWorkoutLogById);
router.put('/logs/:id', protect, WorkoutController.updateWorkoutLog);
router.delete('/logs/:id', protect, WorkoutController.deleteWorkoutLog);

// Statistics and scheduling - MUST come before /:id to avoid route conflicts
router.get('/stats', protect, WorkoutController.getWorkoutStats);
router.get('/scheduled', protect, WorkoutController.getScheduledWorkouts);
router.post('/schedule', protect, WorkoutController.scheduleWorkout);

// Workout management - /:id routes come AFTER specific routes
router.get('/', protect, WorkoutController.getWorkouts);
router.get('/:id', protect, WorkoutController.getWorkoutById);
router.post('/', protect, uploadWorkoutImage().fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), WorkoutController.createWorkout);
router.put('/:id', protect, uploadWorkoutImage().fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), WorkoutController.updateWorkout);
router.put('/:id/photo', protect, uploadWorkoutImage().single('image'), WorkoutController.uploadWorkoutPhoto);
router.delete('/:id', protect, WorkoutController.deleteWorkout);

// Admin routes
router.post('/seed', protect, admin, WorkoutController.seedDefaultWorkouts);

module.exports = router;