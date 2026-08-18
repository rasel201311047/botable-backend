const mongoose = require('mongoose');
const validator = require('validator');

const contactMessageSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null, // Allow non-logged in users to contact
        },
        ticketId: {
            type: String,
            unique: true,
            sparse: true,
            index: true,
            default: null,
        },
        category: {
            type: String,
            enum: ['general', 'billing', 'technical', 'account', 'feedback', 'security'],
            default: 'general',
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            validate: [validator.isEmail, 'Please provide a valid email'],
        },
        subject: {
            type: String,
            required: [true, 'Subject is required'],
            trim: true,
            maxlength: [200, 'Subject cannot exceed 200 characters'],
        },
        attachmentUrl: {
            type: String,
            default: null,
        },
        message: {
            type: String,
            required: [true, 'Message is required'],
            maxlength: [2000, 'Message cannot exceed 2000 characters'],
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'read', 'resolved', 'archived'],
            default: 'pending',
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },
        confirmationState: {
            type: String,
            enum: ['unconfirmed', 'confirmed'],
            default: 'unconfirmed',
        },
        adminNotes: {
            type: String,
            maxlength: [1000, 'Admin notes cannot exceed 1000 characters'],
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        resolvedAt: {
            type: Date,
        },
        confirmedAt: {
            type: Date,
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

// Indexes for admin queries
contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ email: 1 });
contactMessageSchema.index({ userId: 1 });

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

module.exports = ContactMessage;
