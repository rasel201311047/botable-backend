const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const { normalizeUnits } = require('../../utils/healthValidation');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide your name'],
            trim: true,
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        email: {
            type: String,
            required: [true, 'Please provide your email'],
            unique: true,
            lowercase: true,
            validate: [validator.isEmail, 'Please provide a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Please provide a password'],
            minlength: [8, 'Password must be at least 8 characters'],
            select: false,
        },
        profilePhoto: {
            type: String,
            default: null,
        },
        shiftType: {
            type: String,
            enum: ['fixed_night', 'rotating', 'early_morning', 'off_shift', null],
            default: null,
        },
        goalType: {
            type: String,
            enum: ['fat_loss', 'strength_building', 'maintenance', null],
            default: null,
        },
        onboardingCompleted: {
            type: Boolean,
            default: false,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        accountStatus: {
            type: String,
            enum: ['unverified', 'onboarding_incomplete', 'active', 'locked', 'disabled'],
            default: 'unverified',
        },
        failedLoginAttempts: {
            type: Number,
            default: 0,
            min: 0,
        },
        lockedUntil: {
            type: Date,
            default: null,
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        passwordVersion: {
            type: Number,
            default: 1,
        },
        // Profile fields
        height: {
            type: Number, // in cm
            min: [50, 'Height must be at least 50 cm'],
            max: [300, 'Height cannot exceed 300 cm'],
        },
        weight: {
            type: Number, // in kg
            min: [20, 'Weight must be at least 20 kg'],
            max: [500, 'Weight cannot exceed 500 kg'],
        },
        age: {
            type: Number,
            min: [13, 'Age must be at least 13'],
            max: [120, 'Age cannot exceed 120'],
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other', 'prefer_not_to_say', null],
            default: null,
        },
        phoneNumber: {
            type: String,
            maxlength: [20, 'Phone number cannot exceed 20 characters'],
            default: null,
        },
        dateOfBirth: {
            type: Date,
            default: null,
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    return value <= new Date();
                },
                message: 'Date of birth cannot be in the future',
            },
        },
        emergencyContact: {
            name: {
                type: String,
                trim: true,
                maxlength: [100, 'Emergency contact name cannot exceed 100 characters'],
                default: null,
            },
            relationship: {
                type: String,
                trim: true,
                maxlength: [50, 'Relationship cannot exceed 50 characters'],
                default: null,
            },
            phoneNumber: {
                type: String,
                maxlength: [25, 'Emergency contact phone number cannot exceed 25 characters'],
                default: null,
            },
        },
        location: {
            city: { type: String, maxlength: [100, 'City cannot exceed 100 characters'], default: null },
            country: {
                type: String,
                maxlength: [100, 'Country cannot exceed 100 characters'],
                default: null,
            },
        },
        preferences: {
            measurementSystem: {
                type: String,
                enum: ['metric', 'imperial'],
                default: 'metric',
            },
            language: {
                type: String,
                default: 'en',
                maxlength: [10, 'Language code cannot exceed 10 characters'],
            },
            timezone: {
                type: String,
                default: 'UTC',
                maxlength: [50, 'Timezone cannot exceed 50 characters'],
                get: function (value) {
                    // Decode HTML entities if they exist
                    if (value && typeof value === 'string') {
                        return value
                            .replace(/&#x2F;/g, '/')
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#x27;/g, "'");
                    }
                    return value;
                },
            },
        },
        notifications: {
            workoutReminders: { type: Boolean, default: true },
            mealReminders: { type: Boolean, default: true },
            sleepReminders: { type: Boolean, default: true },
            shiftReminders: { type: Boolean, default: true },
            promotional: { type: Boolean, default: false },
        },
        subscription: {
            plan: {
                type: String,
                enum: ['free', 'monthly', 'yearly', null],
                default: 'free',
            },
            isActive: {
                type: Boolean,
                default: true,
            },
            status: {
                type: String,
                enum: ['active', 'pending', 'rejected', 'cancelled', null],
                default: 'active',
            },
            startDate: {
                type: Date,
                default: Date.now,
            },
            endDate: {
                type: Date,
            },
            stripeCustomerId: String,
            stripeSubscriptionId: String,
        },
        lastLogin: {
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
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true, getters: true },
        toObject: { virtuals: true, getters: true },
    },
);

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre('validate', function () {
    const normalized = normalizeUnits(this.toObject({ depopulate: true }));

    if (normalized.height !== undefined && normalized.height !== null) this.height = normalized.height;
    if (normalized.weight !== undefined && normalized.weight !== null) this.weight = normalized.weight;
    if (normalized.dateOfBirth) this.dateOfBirth = normalized.dateOfBirth;
    if (normalized.phoneNumber !== undefined) this.phoneNumber = normalized.phoneNumber;
    if (normalized.emergencyContact) this.emergencyContact = normalized.emergencyContact;
});

// Update updatedAt timestamp on save
// userSchema.pre('save', function(next) {
//   this.updatedAt = Date.now();
//   next();
// });

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
    return jwt.sign({ id: this._id, email: this.email, role: this.role, passwordVersion: this.passwordVersion || 1 }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
};

// Virtual for shift display name
userSchema.virtual('shiftDisplayName').get(function () {
    const shiftNames = {
        fixed_night: 'Fixed Night',
        rotating: 'Rotating',
        early_morning: 'Early Morning',
        off_shift: 'Off Shift',
    };
    return shiftNames[this.shiftType] || 'Not set';
});

// Virtual for goal display name
userSchema.virtual('goalDisplayName').get(function () {
    const goalNames = {
        fat_loss: 'Fat Loss',
        strength_building: 'Strength Building',
        maintenance: 'Maintenance',
    };
    return goalNames[this.goalType] || 'Not set';
});

const User = mongoose.model('User', userSchema);

module.exports = User;
