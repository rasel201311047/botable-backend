const mongoose = require('mongoose');

const workoutLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workout',
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: () => new Date().setHours(0, 0, 0, 0),
    },
    scheduledTime: {
      type: String, // Format: "HH:MM"
      default: null,
    },
    actualStartTime: {
      type: Date,
      default: null,
    },
    actualEndTime: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      min: 1,
    },
    intensity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'skipped', 'expired', 'rescheduled'],
      default: 'completed',
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completionPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    notes: {
      type: String,
      default: null,
    },
    rating: {
      type: Number, // 1-5 scale
      min: 1,
      max: 5,
    },
    perceivedExertion: {
      type: Number, // 1-10 scale (RPE)
      min: 1,
      max: 10,
    },
    exercises: [
      {
        name: String,
        sets: Number,
        reps: Number,
        weight: Number,
        completedSets: Number,
        completedReps: Number,
        notes: String,
      },
    ],
    caloriesBurned: {
      type: Number,
      min: 0,
    },
    isLogged: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, versionKey: false },
);

// Indexes for efficient queries
workoutLogSchema.index({ userId: 1, date: 1 });
workoutLogSchema.index({ userId: 1, workoutId: 1 });
workoutLogSchema.index({ userId: 1, completed: 1 });
workoutLogSchema.index({ userId: 1, createdAt: -1 });

// Calculate duration if start and end times are provided (async/await syntax for Mongoose 7+)
workoutLogSchema.pre('save', async function () {
  this.updatedAt = Date.now();

  if (this.actualStartTime && this.actualEndTime) {
    const durationMs = this.actualEndTime - this.actualStartTime;
    this.durationMinutes = Math.round(durationMs / (1000 * 60));
  }
});

const WorkoutLog = mongoose.model('WorkoutLog', workoutLogSchema);

module.exports = WorkoutLog;
