const mongoose = require('mongoose');

const dailyNutritionSummarySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        date: {
            type: Date,
            required: true,
            default: () => new Date().setHours(0, 0, 0, 0),
        },
        calories: {
            type: Number,
            default: 0,
            min: 0,
        },
        protein: {
            type: Number, // in grams
            default: 0,
            min: 0,
        },
        carbs: {
            type: Number, // in grams
            default: 0,
            min: 0,
        },
        fat: {
            type: Number, // in grams
            default: 0,
            min: 0,
        },
        mealCount: {
            type: Number,
            default: 0,
        },
        lastMealAt: {
            type: Date,
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

// Compound unique index for userId and date
dailyNutritionSummarySchema.index({ userId: 1, date: 1 }, { unique: true });

// Create TTL index for automatic cleanup (keep 90 days)
dailyNutritionSummarySchema.index({ date: 1 }, { expireAfterSeconds: 7776000 }); // 90 days in seconds

const DailyNutritionSummary = mongoose.model('DailyNutritionSummary', dailyNutritionSummarySchema);

module.exports = DailyNutritionSummary;

