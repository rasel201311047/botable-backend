const { getJsonCompletion } = require('./ai_client');

async function generateWeeklySummary(u, scores) {
  const prompt = `
You are a fitness coach AI. Write a brief weekly summary for storage.

USER: ${u.name}, goal: ${u.goal}, shift: ${u.shift_type}
Sleep: ${u.sleep_hours}hrs | Energy: ${u.energy_level}/10 | Rest: ${u.days_since_rest}d
SCORES: Recovery ${scores.recovery_score} | Sleep ${scores.sleep_score} | Energy ${scores.energy_score} | Readiness ${scores.workout_readiness}

Respond ONLY with JSON (no markdown):
{
  "weekly_summary": "2-3 sentence summary",
  "strengths":  ["strength 1", "strength 2", "strength 3"],
  "next_steps": ["action 1",   "action 2",   "action 3"]
}
`;

  const ai = await getJsonCompletion(prompt, 0.4);
  return {
    weekly_summary: ai.weekly_summary || "",
    strengths: ai.strengths || [],
    next_steps: ai.next_steps || [],
  };
}

async function generateCheckinInsights(req, profileSnaps, pastCheckins) {
  let profile_ctx = "";
  if (profileSnaps && profileSnaps.length > 0) {
    const p = profileSnaps[profileSnaps.length - 1];
    profile_ctx = `User profile: goal=${p.goal}, shift=${p.shift_type}, age=${p.age}, height=${p.height_cm}cm, baseline weight=${p.weight_kg}kg`;
  }

  let past_ctx = "";
  if (pastCheckins && pastCheckins.length > 0) {
    const lines = pastCheckins.slice(-8).map(c => 
      `  Week ${c.week_label}: weight=${c.current_weight_kg}kg sleep=${c.current_sleep_hours}h energy=${c.current_energy_level}/10 stress=${c.current_stress_level}/10 workouts=${c.workouts_completed} missed=${c.workouts_missed}`
    );
    past_ctx = "PAST CHECK-INS (chronological):\\n" + lines.join("\\n");
  }

  const has_history = (pastCheckins && pastCheckins.length > 0);
  const analyse_str = has_history ? "and compare with history to detect trends" : "";

  const prompt = `
You are an expert AI fitness progress analyst.

${profile_ctx}

${past_ctx}

THIS WEEK (${req.week_label}):
- Weight:             ${req.current_weight_kg} kg
- Sleep:              ${req.current_sleep_hours} hours
- Energy:             ${req.current_energy_level}/10
- Stress:             ${req.current_stress_level}/10
- Workouts completed: ${req.workouts_completed}
- Workouts missed:    ${req.workouts_missed}
- Days since rest:    ${req.days_since_rest}

Analyse this week ${analyse_str}.

The output will be displayed in a mobile app with exactly these sections:
1. AI Summary   — one short sentence shown at the top (e.g. "Good consistency in workouts, could improve sleep quality")
2. Strengths    — 2-3 short items (e.g. "Workout frequency", "Nutrition tracking consistency")
3. Areas for Improvement — 2-3 short items (e.g. "Sleep duration", "Post-workout recovery")
4. Recommended Next Steps — 2-4 numbered action steps (e.g. "Aim for 7+ hours of sleep nightly")

Keep each item short — it appears as a single line in the UI.

Respond ONLY with JSON (no markdown):
{
  "ai_summary":            "<one sentence, max 12 words>",
  "strengths":             ["<short label>", "<short label>"],
  "areas_for_improvement": ["<short label>", "<short label>"],
  "recommended_next_steps": [
    {"step_number": 1, "description": "<action>"},
    {"step_number": 2, "description": "<action>"},
    {"step_number": 3, "description": "<action>"}
  ],
  "overall_trend":         "<improving | declining | mixed | insufficient_data>",
  "top_improvements":      ["<item>", "<item>"],
  "persistent_weaknesses": ["<item>", "<item>"]
}
`;

  const ai = await getJsonCompletion(prompt, 0.35);

  const steps = (ai.recommended_next_steps || []).map((s, i) => ({
    step_number: s.step_number || (i + 1),
    description: s.description || ""
  }));

  return {
    user_id: req.user_id,
    week_label: req.week_label,
    generated_at: new Date().toISOString(),
    ai_summary: ai.ai_summary || "",
    strengths: ai.strengths || [],
    areas_for_improvement: ai.areas_for_improvement || [],
    recommended_next_steps: steps,
    overall_trend: ai.overall_trend || "insufficient_data",
    top_improvements: ai.top_improvements || [],
    persistent_weaknesses: ai.persistent_weaknesses || []
  };
}

async function analyzeProgressHistory(snapshots) {
  if (!snapshots || snapshots.length === 0) {
    throw new Error("No snapshots available for analysis.");
  }

  const user_id = snapshots[0].user_id;
  const latest = snapshots[snapshots.length - 1];

  const score_trends = snapshots.map(s => ({
    week_label: s.week_label,
    recovery: s.recovery_score,
    sleep: s.sleep_score,
    energy: s.energy_score,
    readiness: s.workout_readiness,
    nutrition: s.nutrition_score,
  }));

  const metric_trends = snapshots.map(s => ({
    week_label: s.week_label,
    weight_kg: s.weight_kg,
    sleep_hours: s.sleep_hours,
    energy_level: s.energy_level,
    days_since_rest: s.days_since_rest,
  }));

  const history = snapshots.map(s => 
    `  Week ${s.week_label}: Rec=${s.recovery_score} Slp=${s.sleep_score} Nrg=${s.energy_score} Rdy=${s.workout_readiness} Nut=${s.nutrition_score} | sleep=${s.sleep_hours}h energy=${s.energy_level}/10 rest=${s.days_since_rest}d weight=${s.weight_kg}kg`
  ).join("\\n");

  const prompt = `
You are an expert AI fitness analyst.
Analyse ${snapshots.length} weeks of data for user ${user_id}.

WEEKLY HISTORY (chronological):
${history}

Respond ONLY with JSON (no markdown):
{
  "overall_trend":         "<improving | declining | mixed | insufficient_data>",
  "ai_analysis":           "<3-5 sentence comprehensive analysis of all weeks and patterns>",
  "top_improvements":      ["<item>", "<item>", "<item>"],
  "persistent_weaknesses": ["<item>", "<item>", "<item>"],
  "recommendations":       ["<action 1>", "<action 2>", "<action 3>", "<action 4>"]
}
`;

  const ai = await getJsonCompletion(prompt, 0.3);

  return {
    user_id: user_id,
    total_weeks: snapshots.length,
    weeks_tracked: snapshots.map(s => s.week_label),
    score_trends: score_trends,
    metric_trends: metric_trends,
    overall_trend: ai.overall_trend || "insufficient_data",
    ai_analysis: ai.ai_analysis || "",
    top_improvements: ai.top_improvements || [],
    persistent_weaknesses: ai.persistent_weaknesses || [],
    recommendations: ai.recommendations || [],
    latest_week: latest.week_label,
    latest_scores: {
      recovery_score: latest.recovery_score,
      sleep_score: latest.sleep_score,
      energy_score: latest.energy_score,
      workout_readiness: latest.workout_readiness,
      nutrition_score: latest.nutrition_score,
      reasoning: ""
    },
    latest_summary: latest.weekly_summary,
  };
}

module.exports = {
  generateWeeklySummary,
  generateCheckinInsights,
  analyzeProgressHistory
};
