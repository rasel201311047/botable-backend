const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            enum: ['fat_loss', 'strength_building', 'maintenance'],
        },
        displayName: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        calorieAdjustment: {
            type: Number, // Percentage adjustment from maintenance
            required: true,
        },
        proteinRatio: {
            type: Number, // 0-1
            required: true,
        },
        carbRatio: {
            type: Number, // 0-1
            required: true,
        },
        fatRatio: {
            type: Number, // 0-1
            required: true,
        },
        tags: [
            {
                type: String,
                enum: ['weight', 'workout', 'recovery', 'sleep', 'calendar'],
            },
        ],
        isActive: {
            type: Boolean,
            default: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true, versionKey: false },
);

// Create indexes
goalSchema.index({ name: 1 }, { unique: true });

const Goal = mongoose.model('Goal', goalSchema);

module.exports = Goal;
