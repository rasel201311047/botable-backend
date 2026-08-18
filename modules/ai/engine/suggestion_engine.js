const { getJsonCompletion } = require('./ai_client');

async function generateSuggestions(u, scores) {
  const prompt = `
You are an expert AI fitness coach.
Generate personalised fitness suggestions based on this user's profile and AI scores.

USER PROFILE:
- Name: ${u.name}, Age: ${u.age}, Weight: ${u.weight_kg}kg, Height: ${u.height_cm}cm
- Goal: ${u.goal}
- Shift: ${u.shift_type} (${u.shift_start_hour || 0}:00 – ${u.shift_end_hour || 0}:00)
- Sleep: ${u.sleep_hours} hours
- Energy: ${u.energy_level}/10
- Days since last rest: ${u.days_since_rest}

AI SCORES (0-100):
- Recovery: ${scores.recovery_score}
- Sleep: ${scores.sleep_score}
- Energy: ${scores.energy_score}
- Workout readiness: ${scores.workout_readiness}
- Nutrition: ${scores.nutrition_score}

Generate 3-4 prioritised suggestions covering:
recovery status, workout readiness, sleep quality, and shift-specific advice.

Respond ONLY with a JSON object (no markdown):
{
  "suggestions": [
    {
      "category": "<category name>",
      "title": "<short title>",
      "reason": "<1-2 sentence reason based on their data>",
      "actions": ["<action 1>", "<action 2>", "<action 3>", "<action 4>"],
      "priority": <integer 1-4, 1=highest>
    }
  ]
}
`;

  const data = await getJsonCompletion(prompt, 0.4);
  let items = data.suggestions;
  if (!items) {
    items = Object.values(data)[0];
  }
  
  if (!Array.isArray(items)) {
    items = [];
  }

  return items.map((item, idx) => ({
    category: item.category,
    title: item.title,
    reason: item.reason,
    actions: item.actions || [],
    priority: item.priority || (idx + 1),
  }));
}

module.exports = {
  generateSuggestions
};
