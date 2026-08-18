const mongoose = require('mongoose');

const AIProgressSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  user_id: { type: String, required: true }, // Keeping for backwards compatibility if needed
  week_label: { type: String, required: true },
  recorded_at: { type: Date, default: Date.now },
  age: { type: Number, required: true },
  weight_kg: { type: Number, required: true },
  height_cm: { type: Number, required: true },
  sleep_hours: { type: Number, required: true },
  energy_level: { type: Number, required: true },
  days_since_rest: { type: Number, required: true },
  goal: { type: String, required: true },
  shift_type: { type: String, required: true },
  recovery_score: { type: Number, required: true },
  sleep_score: { type: Number, required: true },
  energy_score: { type: Number, required: true },
  workout_readiness: { type: Number, required: true },
  nutrition_score: { type: Number, required: true },
  weekly_summary: { type: String, default: "" },
  strengths: { type: [String], default: [] },
  next_steps: { type: [String], default: [] },
}, {
  timestamps: true,
});

module.exports = mongoose.model('AIProgressSnapshot', AIProgressSnapshotSchema);
