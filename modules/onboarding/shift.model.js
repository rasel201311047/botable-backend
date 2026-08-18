const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            enum: ['fixed_night', 'rotating', 'early_morning', 'off_shift'],
        },
        displayName: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        defaultWakeTime: {
            type: String, // Format: "HH:MM"
            required: true,
        },
        defaultSleepTime: {
            type: String, // Format: "HH:MM"
            required: true,
        },
        tags: [
            {
                type: String,
                enum: ['sleep', 'workout', 'recovery', 'calendar'],
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
shiftSchema.index({ name: 1 }, { unique: true });

const Shift = mongoose.model('Shift', shiftSchema);

module.exports = Shift;
