const { getJsonCompletion } = require('./ai_client');

const ALL_MODULES = [
  {
    name: "Post-shift wind-down",
    description: "Gentle decompression routine to transition from work alertness to sleep-ready state.",
    duration_range: "5–15 min",
    timing: "After shift",
  },
  {
    name: "Daytime sleep",
    description: "Deep relaxation session designed for night-shift workers sleeping during daylight hours.",
    duration_range: "20–45 min",
    timing: "Before sleep",
  },
  {
    name: "Nervous system reset",
    description: "Guided breathing (box breath or 4-7-8) to lower cortisol and prepare for sleep.",
    duration_range: "10–20 min",
    timing: "Any time",
  },
  {
    name: "Pre-shift focus",
    description: "Light mental activation and preparation before starting a shift.",
    duration_range: "5–15 min",
    timing: "Before shift",
  }
];

async function generateSleepAdvice(u, scores) {
  const prompt = `
You are a sleep science and circadian rhythm expert AI.

USER:
- Goal: ${u.goal}
- Shift: ${u.shift_type} (start: ${u.shift_start_hour || 0}:00, end: ${u.shift_end_hour || 0}:00)
- Sleep last night: ${u.sleep_hours} hours
- Energy level: ${u.energy_level}/10
- Days since last rest: ${u.days_since_rest}

AI SCORES:
- Sleep score:    ${scores.sleep_score}/100
- Recovery score: ${scores.recovery_score}/100

Generate evidence-based, personalised sleep advice.

Available modules (use exact names):
- "Post-shift wind-down"
- "Daytime sleep"
- "Nervous system reset"
- "Pre-shift focus"

Respond ONLY with a JSON object (no markdown):
{
  "priority_focus": "<One sentence identifying the single most important sleep issue for this user>",
  "smart_tips": [
    "<actionable tip 1>",
    "<actionable tip 2>",
    "<actionable tip 3>",
    "<actionable tip 4>"
  ],
  "recommended_module_names": ["<module name 1>", "<module name 2>"]
}
`;

  const ai = await getJsonCompletion(prompt, 0.35);
  
  const module_map = {};
  ALL_MODULES.forEach(m => { module_map[m.name] = m; });
  
  let chosen = (ai.recommended_module_names || [])
    .filter(n => module_map[n])
    .map(n => module_map[n]);
    
  if (chosen.length === 0) {
    chosen = ALL_MODULES.slice(0, 2);
  }

  return {
    priority_focus: ai.priority_focus || "",
    smart_tips: ai.smart_tips || [],
    recommended_modules: chosen,
  };
}

module.exports = {
  generateSleepAdvice
};
