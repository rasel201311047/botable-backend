const mongoose = require('mongoose');

const aiChatSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        role: {
            type: String,
            enum: ['user', 'assistant'],
            required: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { timestamps: true, versionKey: false },
);

// Compound index for efficient querying of user's chat history
aiChatSchema.index({ userId: 1, createdAt: -1 });

// TTL index for automatic cleanup (keep 30 days of chat history)
aiChatSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days in seconds

const AIChat = mongoose.model('AIChat', aiChatSchema);

module.exports = AIChat;
