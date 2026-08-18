const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
            alias: 'user',
        },
        type: {
            type: String,
            enum: [
                'SUBSCRIPTION',
                'WORKOUT',
                'MEAL',
                'REMINDER',
                'ACHIEVEMENT',
                'SYSTEM',
                'SLEEP_RECOVERY',
                'AI_INSIGHT',
                'CALENDAR',
                'ADMIN',
            ],
            required: true,
        },
        category: {
            type: String,
            enum: ['workout', 'meal', 'sleep', 'recovery', 'calendar', 'subscription', 'ai', 'support', 'system', 'security'],
            default: 'system',
            index: true,
        },
        title: {
            type: String,
            required: true,
            maxlength: 200,
        },
        message: {
            type: String,
            required: true,
            maxlength: 500,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        sourceModule: {
            type: String,
            required: true,
            index: true,
        },
        sourceId: {
            type: String,
            default: null,
            index: true,
        },
        deepLink: {
            type: String,
            default: null,
            maxlength: 500,
        },
        priority: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            default: 'MEDIUM',
        },
        read: {
            type: Boolean,
            default: false,
            index: true,
        },
        lifecycleState: {
            type: String,
            enum: ['active', 'read', 'dismissed', 'archived'],
            default: 'active',
            index: true,
        },
        readAt: {
            type: Date,
        },
        dismissedAt: {
            type: Date,
        },
        actionUrl: {
            type: String,
            maxlength: 500,
        },
        icon: {
            type: String,
            maxlength: 100,
        },
        dedupeKey: {
            type: String,
            default: null,
            index: true,
        },
        payload: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        expiresAt: {
            type: Date,
        },
    },
    { timestamps: true, versionKey: false, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

// Compound indexes for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, dedupeKey: 1, lifecycleState: 1 });

// TTL index for automatic expiration
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for notification age
notificationSchema.virtual('age').get(function () {
    return Date.now() - this.createdAt.getTime();
});

// Method to mark as read
notificationSchema.methods.markAsRead = async function () {
    if (!this.read) {
        this.read = true;
        this.readAt = new Date();
        this.lifecycleState = 'read';
        await this.save();
    }
    return this;
};

notificationSchema.methods.dismiss = async function () {
    this.lifecycleState = 'dismissed';
    this.read = true;
    this.readAt = this.readAt || new Date();
    this.dismissedAt = new Date();
    await this.save();
    return this;
};

// Static method to mark multiple as read
notificationSchema.statics.markManyAsRead = async function (userId, notificationIds) {
    return this.updateMany(
        {
            userId,
            _id: { $in: notificationIds },
            read: false,
        },
        {
            $set: {
                read: true,
                readAt: new Date(),
                lifecycleState: 'read',
            },
        },
    );
};

notificationSchema.statics.dismissMany = async function (userId, notificationIds = []) {
    const filter = {
        userId,
    };

    if (notificationIds.length) {
        filter._id = { $in: notificationIds };
    }

    return this.updateMany(filter, {
        $set: {
            read: true,
            readAt: new Date(),
            lifecycleState: 'dismissed',
            dismissedAt: new Date(),
        },
    });
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({ userId, read: false, lifecycleState: { $ne: 'dismissed' } });
};

notificationSchema.statics.getCategoryCounts = async function (userId) {
    return this.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$category',
                total: { $sum: 1 },
                unread: {
                    $sum: {
                        $cond: [{ $and: [{ $eq: ['$read', false] }, { $ne: ['$lifecycleState', 'dismissed'] }] }, 1, 0],
                    },
                },
            },
        },
    ]);
};

// Static method to delete old read notifications
notificationSchema.statics.cleanupOld = async function (daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.deleteMany({
        lifecycleState: { $in: ['read', 'dismissed'] },
        updatedAt: { $lt: cutoffDate },
    });
};

notificationSchema.virtual('isRead').get(function () {
    return this.read || this.lifecycleState === 'read' || this.lifecycleState === 'dismissed';
});

module.exports = mongoose.model('Notification', notificationSchema);
