const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
    {
        question: {
            type: String,
            required: [true, 'Question is required'],
            trim: true,
            maxlength: [500, 'Question cannot exceed 500 characters'],
        },
        answer: {
            type: String,
            required: [true, 'Answer is required'],
            maxlength: [5000, 'Answer cannot exceed 5000 characters'],
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            trim: true,
            maxlength: [100, 'Category cannot exceed 100 characters'],
            default: 'General',
        },
        order: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
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

// Index for quick lookups
faqSchema.index({ category: 1, order: 1 });
faqSchema.index({ isActive: 1, order: 1 });

const FAQ = mongoose.model('FAQ', faqSchema);

module.exports = FAQ;
