const mongoose = require('mongoose');

/**
 * One cached AI "coach note" per user and tool. `hash` is a fingerprint of the user's data
 * at generation time, so the note is reused until the data actually changes.
 */
const aiInsightCacheSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tool: { type: String, required: true, enum: ['nutrition', 'sleep', 'workout', 'progress', 'suggestions'] },
    hash: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    source: { type: String, enum: ['ai', 'rules'], default: 'ai' },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

aiInsightCacheSchema.index({ userId: 1, tool: 1 }, { unique: true });
// Drop entries after 2 days
aiInsightCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model('AIInsightCache', aiInsightCacheSchema);
