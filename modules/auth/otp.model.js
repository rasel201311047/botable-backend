const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
        },
        otp: {
            type: String,
        },
        hash: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['email_verification', 'password_reset', 'login_verification'],
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: '10m' }, // Auto delete after 10 minutes
        },
        attempts: {
            type: Number,
            default: 0,
            max: 3,
        },
        isUsed: {
            type: Boolean,
            default: false,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true, versionKey: false },
);

// Prevent multiple active OTPs for same email and type
otpSchema.index({ email: 1, type: 1, isUsed: 1 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
