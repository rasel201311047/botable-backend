const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['terms', 'privacy', 'faqs'],
            required: [true, 'Content type is required'],
            unique: true,
        },
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters'],
        },
        content: {
            type: String,
            required: [true, 'Content is required'],
        },
        version: {
            type: Number,
            default: 1,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
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
contentSchema.index({ type: 1, isActive: 1 });

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;
