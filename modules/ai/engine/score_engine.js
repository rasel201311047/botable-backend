const { getJsonCompletion } = require('./ai_client');

async function calculateScores(u) {
  const prompt = `
You are an expert AI fitness coach and health analyst.
Calculate 5 health scores (each 0-100) based on this user's data.

USER:
- Age: ${u.age}, Weight: ${u.weight_kg}kg, Height: ${u.height_cm}cm
- Goal: ${u.goal}
- Shift: ${u.shift_type} (${u.shift_start_hour || 0}:00 – ${u.shift_end_hour || 0}:00)
- Sleep last night: ${u.sleep_hours} hours
- Energy level today: ${u.energy_level}/10
- Days since last rest day: ${u.days_since_rest}

SCORING GUIDE:
- recovery_score:    Body readiness based on sleep duration, energy, rest days, and shift type impact
- sleep_score:       Sleep quality inferred from duration, shift type, and energy level
- energy_score:      Available energy (self-reported level + sleep + shift impact)
- workout_readiness: Overall training readiness (recovery + energy + sleep combined)
- nutrition_score:   Estimated diet adherence baseline for this goal and shift type (50 = unknown, adjust with context)

Respond ONLY with a JSON object (no markdown, no extra text):
{
  "recovery_score": <integer 0-100>,
  "sleep_score": <integer 0-100>,
  "energy_score": <integer 0-100>,
  "workout_readiness": <integer 0-100>,
  "nutrition_score": <integer 0-100>,
  "reasoning": "<2 sentence explanation of the key factors driving these scores>"
}
`;

  const d = await getJsonCompletion(prompt, 0.2);
  
  return {
    recovery_score: parseInt(d.recovery_score || 50),
    sleep_score: parseInt(d.sleep_score || 50),
    energy_score: parseInt(d.energy_score || 50),
    workout_readiness: parseInt(d.workout_readiness || 50),
    nutrition_score: parseInt(d.nutrition_score || 50),
    reasoning: d.reasoning || ""
  };
}

async function calcNutritionTargets(u) {
  const prompt = `
You are a registered sports dietitian AI.
Calculate precise daily nutrition targets for this user.

USER:
- Age: ${u.age}, Weight: ${u.weight_kg}kg, Height: ${u.height_cm}cm
- Goal: ${u.goal}
- Shift type: ${u.shift_type}

Instructions:
1. Calculate BMR using Harris-Benedict formula
2. Apply activity multiplier appropriate for their goal and shift type
3. Adjust calories for goal (deficit for fat loss, surplus for muscle gain)
4. Split macros appropriately for the goal

Respond ONLY with a JSON object (no markdown, no extra text):
{
  "calories": <integer>,
  "protein_g": <integer>,
  "carbs_g": <integer>,
  "fat_g": <integer>,
  "water_ml": <integer>,
  "reasoning": "<1-2 sentence explanation of how targets were calculated>"
}
`;

  const d = await getJsonCompletion(prompt, 0.1);
  
  return {
    calories: parseInt(d.calories || 2500),
    protein_g: parseInt(d.protein_g || 150),
    carbs_g: parseInt(d.carbs_g || 300),
    fat_g: parseInt(d.fat_g || 70),
    water_ml: parseInt(d.water_ml || 2500),
    reasoning: d.reasoning || ""
  };
}

module.exports = {
  calculateScores,
  calcNutritionTargets
};
