const mongoose = require('mongoose');

const recoveryActivitySchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            enum: ['post_shift_wind_down', 'daytime_sleep', 'nervous_system_reset', 'pre_shift_focus', 'night_sleep', 'nap'],
        },
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        minDuration: {
            type: Number, // in minutes
            required: true,
            min: 1,
        },
        maxDuration: {
            type: Number, // in minutes
            required: true,
            min: 1,
        },
        timingTag: {
            type: String,
            required: true,
            enum: ['before_shift', 'after_shift', 'any_time', 'sleep'],
        },
        applicableShifts: [
            {
                type: String,
                enum: ['fixed_night', 'rotating', 'early_morning', 'off_shift'],
            },
        ],
        icon: {
            type: String,
            default: null,
        },
        color: {
            type: String,
            default: '#4F46E5',
        },
        instructions: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        order: {
            type: Number,
            default: 0,
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

// Indexes
recoveryActivitySchema.index({ key: 1, isActive: 1 });
recoveryActivitySchema.index({ timingTag: 1, isActive: 1 });

const RecoveryActivity = mongoose.model('RecoveryActivity', recoveryActivitySchema);

module.exports = RecoveryActivity;
