const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mealSessionId: {
      type: String,
      index: true,
      default: null,
    },
    foodId: {
      type: String, // Supports MongoDB ObjectIds and external IDs (e.g. usda_...)
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'],
      default: 'snack',
    },
    quantity: {
      type: Number, // in grams
      required: true,
      min: 1,
    },
    servingSize: {
      type: Number,
      default: null,
      min: 1,
    },
    loggedAt: {
      type: Date,
      default: Date.now,
    },
    shiftContext: {
      type: String,
      enum: ['fixed_night', 'rotating', 'early_morning', 'off_shift', null],
      default: null,
    },
    source: {
      type: String,
      enum: ['searched_food', 'recent_food', 'favourite_food', 'common_food', 'manual', 'usda', 'user'],
      default: 'manual',
    },
    status: {
      type: String,
      enum: ['suggested', 'scheduled', 'logged', 'skipped', 'expired', 'rescheduled'],
      default: 'logged',
    },
    items: [
      {
        foodId: {
          type: String, // Supports MongoDB ObjectIds and external IDs (e.g. usda_...)
          default: null,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: {
          type: Number,
          min: 0,
          required: true,
        },
        servingSize: {
          type: Number,
          min: 0,
          default: 100,
        },
        calories: {
          type: Number,
          min: 0,
          required: true,
        },
        protein: {
          type: Number,
          min: 0,
          required: true,
        },
        carbs: {
          type: Number,
          min: 0,
          required: true,
        },
        fat: {
          type: Number,
          min: 0,
          required: true,
        },
        source: {
          type: String,
          default: 'manual',
        },
      },
    ],
    calories: {
      type: Number,
      required: true,
      min: 0,
    },
    protein: {
      type: Number, // in grams
      required: true,
      min: 0,
    },
    carbs: {
      type: Number, // in grams
      required: true,
      min: 0,
    },
    fat: {
      type: Number, // in grams
      required: true,
      min: 0,
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
    notes: {
      type: String,
      default: null,
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
mealSchema.index({ userId: 1, date: 1 });
mealSchema.index({ userId: 1, mealType: 1 });
mealSchema.index({ userId: 1, createdAt: -1 });

// Calculate nutrition before saving (async/await syntax for Mongoose 7+)
mealSchema.pre('save', async function () {
  this.updatedAt = Date.now();

  if (!this.mealSessionId) {
    this.mealSessionId = `${this.userId}-${new Date(this.loggedAt || Date.now()).toISOString().slice(0, 10)}-${this.mealType}`;
  }

  if (!this.loggedAt) {
    this.loggedAt = Date.now();
  }

  if (!this.date) {
    const day = new Date(this.loggedAt);
    day.setHours(0, 0, 0, 0);
    this.date = day;
  }

  if (this.items && this.items.length > 0) {
    const totals = this.items.reduce(
      (sum, item) => {
        sum.calories += Number(item.calories || 0);
        sum.protein += Number(item.protein || 0);
        sum.carbs += Number(item.carbs || 0);
        sum.fat += Number(item.fat || 0);
        sum.quantity += Number(item.quantity || 0);
        return sum;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, quantity: 0 },
    );

    this.calories = Math.round(totals.calories);
    this.protein = Math.round(totals.protein * 10) / 10;
    this.carbs = Math.round(totals.carbs * 10) / 10;
    this.fat = Math.round(totals.fat * 10) / 10;
    if (!this.quantity || this.quantity < 1) {
      this.quantity = Math.max(1, Math.round(totals.quantity));
    }
    if (!this.servingSize) {
      this.servingSize = Math.max(1, Math.round(totals.quantity / Math.max(1, this.items.length)));
    }
  }
});

const Meal = mongoose.model('Meal', mealSchema);

module.exports = Meal;
