const { getJsonCompletion } = require('./ai_client');
const { calcNutritionTargets } = require('./score_engine');

async function generateNutritionAdvice(u, scores) {
  const targets = await calcNutritionTargets(u);

  const prompt = `
You are an expert AI sports dietitian.
Generate personalised nutrition advice and macro distribution based on the user's profile, scores, and calculated targets.

USER PROFILE:
- Name: ${u.name}, Age: ${u.age}, Weight: ${u.weight_kg}kg, Height: ${u.height_cm}cm
- Goal: ${u.goal}
- Shift: ${u.shift_type} (${u.shift_start_hour || 0}:00 – ${u.shift_end_hour || 0}:00)
- Current Nutrition Score: ${scores.nutrition_score}/100

CALCULATED TARGETS:
- Calories: ${targets.calories} kcal
- Protein: ${targets.protein_g}g
- Carbs: ${targets.carbs_g}g
- Fat: ${targets.fat_g}g
- Water: ${targets.water_ml} ml

Provide:
1. Macro distribution percentages
2. 3-4 key recommendations specific to their goal
3. 2-3 shift-specific nutrition tips

Respond ONLY with a JSON object (no markdown):
{
  "macro_distribution": {
    "protein": {"amount_g": <integer>, "pct": <integer>},
    "carbs": {"amount_g": <integer>, "pct": <integer>},
    "fat": {"amount_g": <integer>, "pct": <integer>}
  },
  "key_recommendations": [
    "<recommendation 1>",
    "<recommendation 2>",
    "<recommendation 3>"
  ],
  "shift_specific": [
    "<tip 1>",
    "<tip 2>"
  ],
  "meal_timing_windows": {
    "breakfast": "HH:MM-HH:MM",
    "lunch": "HH:MM-HH:MM",
    "dinner": "HH:MM-HH:MM",
    "snacks": ["HH:MM-HH:MM"]
  },
  "recommended_foods": {
    "breakfast": ["<food1>", "<food2>"],
    "lunch": ["<food1>", "<food2>"],
    "dinner": ["<food1>", "<food2>"],
    "snack": ["<food1>", "<food2>"]
  }
}
`;

  const ai = await getJsonCompletion(prompt, 0.3);

  // Safely fallback if AI messes up the exact targets we gave it
  const macros = ai.macro_distribution || {
    protein: { amount_g: targets.protein_g, pct: 30 },
    carbs: { amount_g: targets.carbs_g, pct: 40 },
    fat: { amount_g: targets.fat_g, pct: 30 }
  };

  return {
    daily_targets: {
      calories: targets.calories,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
      water_liters: parseFloat((targets.water_ml / 1000).toFixed(1)),
      reasoning: targets.reasoning
    },
    macro_distribution: macros,
    key_recommendations: ai.key_recommendations || [],
    shift_specific: ai.shift_specific || [],
    meal_timing_windows: ai.meal_timing_windows || {
      breakfast: "08:00-10:00",
      lunch: "13:00-15:00",
      dinner: "19:00-21:00",
      snacks: ["11:00-12:00"]
    },
    recommended_foods: ai.recommended_foods || {
      breakfast: ["Oatmeal", "Eggs", "Greek Yogurt"],
      lunch: ["Chicken Breast", "Brown Rice", "Mixed Salad"],
      dinner: ["Salmon", "Sweet Potato", "Broccoli"],
      snack: ["Almonds", "Protein Shake", "Apple"]
    }
  };
}

module.exports = {
  generateNutritionAdvice
};
