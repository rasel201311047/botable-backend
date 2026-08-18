const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
    {
        fdcId: {
            type: String, // USDA FoodData Central ID
            unique: true,
            sparse: true, // Allow null for custom foods
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        brand: {
            type: String,
            default: null,
        },
        description: {
            type: String,
            default: null,
        },
        servingSize: {
            type: Number, // in grams
            default: 100,
        },
        servingUnit: {
            type: String,
            default: 'g',
        },
        calories: {
            type: Number, // per servingSize
            required: true,
            min: 0,
        },
        protein: {
            type: Number, // in grams per servingSize
            required: true,
            min: 0,
        },
        carbs: {
            type: Number, // in grams per servingSize
            required: true,
            min: 0,
        },
        fat: {
            type: Number, // in grams per servingSize
            required: true,
            min: 0,
        },
        fiber: {
            type: Number, // in grams per servingSize
            default: 0,
            min: 0,
        },
        sugar: {
            type: Number, // in grams per servingSize
            default: 0,
            min: 0,
        },
        source: {
            type: String,
            enum: ['usda', 'manual', 'user'],
            default: 'manual',
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
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

// Indexes for search
foodSchema.index({ name: 'text', description: 'text' });
foodSchema.index({ source: 1, isActive: 1 });

const Food = mongoose.model('Food', foodSchema);

module.exports = Food;
