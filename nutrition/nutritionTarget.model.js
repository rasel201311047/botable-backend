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
        // Maintenance calories (TDEE) and BMR the targets were derived from
        maintenanceCalories: { type: Number, default: null },
        bmr: { type: Number, default: null },

        // How the targets were produced: 'ai' (OpenAI, validated), 'formula' (deterministic
        // fallback) or 'custom' (typed in by the user, never regenerated automatically)
        source: {
            type: String,
            enum: ['ai', 'formula', 'custom'],
            default: 'formula',
        },
        model: { type: String, default: null }, // AI model that generated the targets
        rationale: { type: String, maxlength: 600, default: null }, // short plain-language explanation
        isCustom: {
            type: Boolean,
            default: false,
        },
        // macros.js NUTRITION_FORMULA_VERSION used to compute auto-generated targets
        formulaVersion: {
            type: Number,
            default: 1,
        },

        // Snapshot of the profile the targets were generated from. When the user's profile no
        // longer matches this snapshot the app offers "Regenerate".
        inputs: {
            age: { type: Number, default: null },
            gender: { type: String, default: null },
            heightCm: { type: Number, default: null },
            weightKg: { type: Number, default: null },
            goal: { type: String, default: null },
            // profile fields that were missing and replaced by defaults (automatic generation only)
            assumed: { type: [String], default: [] },
        },
        generatedAt: { type: Date, default: null },
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
