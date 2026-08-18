const mongoose = require('mongoose');

const AICheckinSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  user_id: { type: String, required: true },
  week_label: { type: String, required: true },
  recorded_at: { type: Date, default: Date.now },
  current_weight_kg: { type: Number, required: true },
  current_sleep_hours: { type: Number, required: true },
  current_energy_level: { type: Number, required: true },
  current_stress_level: { type: Number, required: true },
  workouts_completed: { type: Number, required: true },
  workouts_missed: { type: Number, required: true },
  days_since_rest: { type: Number, required: true },
  ai_summary: { type: String, default: "" },
  strengths: { type: [String], default: [] },
  areas_for_improvement: { type: [String], default: [] },
  recommended_next_steps: { type: [mongoose.Schema.Types.Mixed], default: [] },
  overall_trend: { type: String, default: "insufficient_data" },
  top_improvements: { type: [String], default: [] },
  persistent_weaknesses: { type: [String], default: [] },
}, {
  timestamps: true,
});

module.exports = mongoose.model('AICheckinSnapshot', AICheckinSnapshotSchema);
