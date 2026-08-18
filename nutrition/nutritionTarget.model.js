const mongoose = require('mongoose');

const nutritionTargetSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        calorieTarget: {
            type: Number,
            required: true,
            min: 1000,
            max: 5000,
        },
        proteinTarget: {
            type: Number, // in grams
            required: true,
            min: 0,
        },
        carbTarget: {
            type: Number, // in grams
            required: true,
            min: 0,
        },
        fatTarget: {
            type: Number, // in grams
            required: true,
            min: 0,
        },
        proteinRatio: {
            type: Number,
            required: true,
            min: 0,
            max: 1,
        },
        carbRatio: {
            type: Number,
            required: true,
            min: 0,
            max: 1,
        },
        fatRatio: {
            type: Number,
            required: true,
            min: 0,
            max: 1,
        },
        lastUpdated: {
            type: Date,
            default: Date.now,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true, versionKey: false },
);

// Create indexes
// nutritionTargetSchema.index({ userId: 1 }); // Removed: unique: true already creates this index

const NutritionTarget = mongoose.model('NutritionTarget', nutritionTargetSchema);

module.exports = NutritionTarget;
