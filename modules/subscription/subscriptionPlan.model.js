const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide plan name'],
            enum: ['free', 'monthly', 'yearly'],
            unique: true,
        },
        displayName: {
            type: String,
            required: [true, 'Please provide display name'],
        },
        price: {
            type: Number,
            required: [true, 'Please provide price'],
            min: 0,
        },
        currency: {
            type: String,
            default: 'usd',
        },
        interval: {
            type: String,
            enum: ['month', 'year', null],
            default: null,
        },
        stripePriceId: {
            type: String,
            default: null,
            sparse: true,
        },
        features: [
            {
                type: String,
            },
        ],
        isActive: {
            type: Boolean,
            default: true,
        },
        description: {
            type: String,
            default: '',
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

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan;
