const mongoose = require('mongoose');

const sleepLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activityKey: {
      type: String,
      required: true,
      enum: [
        'post_shift_wind_down',
        'daytime_sleep',
        'nervous_system_reset',
        'pre_shift_focus',
        'night_sleep',
        'nap',
        'active_recovery',
      ],
    },
    shiftContext: {
      type: String,
      enum: ['fixed_night', 'rotating', 'early_morning', 'off_shift', null],
      default: null,
    },
    title: {
      type: String,
      default: null,
    },
    date: {
      type: Date,
      required: true,
      default: () => new Date().setHours(0, 0, 0, 0),
    },
    startTime: {
      type: String, // Format: "HH:MM"
      required: true,
    },
    endTime: {
      type: String, // Format: "HH:MM"
      required: true,
    },
    startAt: {
      type: Date,
      default: null,
    },
    endAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    splitSleep: {
      type: Boolean,
      default: false,
    },
    interruptedSleep: {
      type: Boolean,
      default: false,
    },
    naps: {
      type: Number,
      default: 0,
      min: 0,
    },
    quality: {
      type: String,
      enum: ['poor', 'average', 'good'],
      default: 'average',
    },
    status: {
      type: String,
      enum: ['logged', 'scheduled', 'completed', 'skipped', 'expired', 'rescheduled'],
      default: 'logged',
    },
    notes: {
      type: String,
      default: null,
    },
    energyBefore: {
      type: Number, // 1-10 scale
      min: 1,
      max: 10,
    },
    energyAfter: {
      type: Number, // 1-10 scale
      min: 1,
      max: 10,
    },
    isLogged: {
      type: Boolean,
      default: true,
    },
    readinessEffect: {
      type: Number,
      default: 0,
      min: -100,
      max: 100,
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
  {
    timestamps: true,
  },
);

// Indexes for efficient queries
sleepLogSchema.index({ userId: 1, date: 1 });
sleepLogSchema.index({ userId: 1, activityKey: 1 });
sleepLogSchema.index({ userId: 1, createdAt: -1 });

// Calculate duration before saving
sleepLogSchema.pre('save', async function () {
  this.updatedAt = Date.now();

  if (!this.startAt) {
    this.startAt = new Date(`2000-01-01T${this.startTime}`);
  }

  if (!this.endAt) {
    this.endAt = new Date(`2000-01-01T${this.endTime}`);
    if (this.endAt < this.startAt) {
      this.endAt.setDate(this.endAt.getDate() + 1);
    }
  }

  if (this.endAt < this.startAt) {
    throw new Error('Invalid sleep time range');
  }

  // Auto-generate title if not provided
  if (!this.title) {
    const activityTitles = {
      post_shift_wind_down: 'Post-Shift Wind Down',
      daytime_sleep: 'Daytime Sleep',
      nervous_system_reset: 'Nervous System Reset',
      pre_shift_focus: 'Pre-Shift Focus',
      night_sleep: 'Night Sleep',
      nap: 'Nap',
    };
    this.title = activityTitles[this.activityKey] || this.activityKey;
  }
});

// Calculate duration from start and end times
sleepLogSchema.methods.calculateDuration = function () {
  const durationMs =
    (this.endAt || new Date(`2000-01-01T${this.endTime}`)) -
    (this.startAt || new Date(`2000-01-01T${this.startTime}`));
  return Math.round(durationMs / (1000 * 60)); // Convert to minutes
};

const SleepLog = mongoose.model('SleepLog', sleepLogSchema);

module.exports = SleepLog;
