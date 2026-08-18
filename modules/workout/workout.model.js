const mongoose = require('mongoose');

const workoutSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null, // null for system workouts
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: null,
        },
        durationMinutes: {
            type: Number,
            required: true,
            min: 1,
            max: 300,
        },
        category: {
            type: String,
            enum: ['strength', 'cardio', 'hiit', 'yoga', 'recovery', 'custom'],
            default: 'custom',
        },
        intensity: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },
        exercises: [
            {
                name: {
                    type: String,
                    required: true,
                },
                sets: {
                    type: Number,
                    min: 1,
                    max: 20,
                },
                reps: {
                    type: Number,
                    min: 1,
                    max: 100,
                },
                weight: {
                    type: Number, // in kg
                    min: 0,
                },
                duration: {
                    type: Number, // in seconds
                    min: 0,
                },
                rest: {
                    type: Number, // in seconds
                    min: 0,
                },
                notes: {
                    type: String,
                    default: null,
                },
            },
        ],
        equipment: [
            {
                type: String,
                enum: [
                    'dumbbells',
                    'barbell',
                    'kettlebell',
                    'resistance_bands',
                    'bodyweight',
                    'machine',
                    'pull-up bar',
                    'none',
                ],
            },
        ],
        imageUrl: {
            type: String,
            default: null,
        },
        videoUrl: {
            type: String,
            default: null,
        },
        tags: [
            {
                type: String,
            },
        ],
        isPublic: {
            type: Boolean,
            default: false,
        },
        isActive: {
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
    {
        timestamps: true,
    },
);

// Indexes for search and filtering
workoutSchema.index({ title: 'text', description: 'text', tags: 'text' });
workoutSchema.index({ userId: 1, isActive: 1 });
workoutSchema.index({ category: 1, intensity: 1 });
workoutSchema.index({ isPublic: 1, isActive: 1 });

const Workout = mongoose.model('Workout', workoutSchema);

module.exports = Workout;
