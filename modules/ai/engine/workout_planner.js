const { getJsonCompletion } = require('./ai_client');
const axios = require('axios');

const DATASET_URL = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/refs/heads/main/data/exercises.json";

let _exercise_cache = [];

async function _loadExercises() {
  if (_exercise_cache.length > 0) {
    return _exercise_cache;
  }
  try {
    const response = await axios.get(DATASET_URL, { timeout: 15000 });
    _exercise_cache = response.data;
    console.log(`[workout_planner] Loaded ${_exercise_cache.length} exercises.`);
  } catch (error) {
    console.warn(`[workout_planner] WARNING: Could not load dataset: ${error.message}`);
    _exercise_cache = [];
  }
  return _exercise_cache;
}

const DAY_SESSIONS = {
  "muscle_gain": [
    ["Monday", "Upper Body Strength", ["chest", "upper arms", "shoulders"]],
    ["Tuesday", "Lower Body Strength", ["upper legs", "lower legs"]],
    ["Wednesday", "Back & Biceps", ["back", "upper arms"]],
    ["Thursday", "Active Recovery", ["waist"]],
    ["Friday", "Push Day", ["chest", "shoulders", "upper arms"]],
    ["Saturday", "Legs & Core", ["upper legs", "waist"]],
    ["Sunday", "Rest Day", []],
  ],
  "fat_loss": [
    ["Monday", "HIIT Full Body", ["cardio", "waist"]],
    ["Tuesday", "Cardio + Core", ["cardio", "waist", "upper legs"]],
    ["Wednesday", "Circuit Training", ["upper arms", "chest", "back"]],
    ["Thursday", "Active Recovery", ["waist"]],
    ["Friday", "HIIT Lower Body", ["upper legs", "waist", "cardio"]],
    ["Saturday", "Cardio + Upper", ["cardio", "upper arms", "shoulders"]],
    ["Sunday", "Rest Day", []],
  ],
  "endurance": [
    ["Monday", "Zone-2 Cardio", ["cardio", "upper legs"]],
    ["Tuesday", "Interval Training", ["cardio", "waist"]],
    ["Wednesday", "Strength + Core", ["back", "upper legs", "waist"]],
    ["Thursday", "Easy Cardio", ["cardio"]],
    ["Friday", "Long Session", ["cardio", "upper legs"]],
    ["Saturday", "Recovery Walk", ["upper legs"]],
    ["Sunday", "Rest Day", []],
  ],
  "general_fitness": [
    ["Monday", "Upper Body", ["chest", "upper arms", "shoulders"]],
    ["Tuesday", "Cardio + Core", ["cardio", "waist"]],
    ["Wednesday", "Lower Body", ["upper legs", "lower legs"]],
    ["Thursday", "Active Recovery", ["waist"]],
    ["Friday", "Full Body HIIT", ["cardio", "upper arms", "upper legs"]],
    ["Saturday", "Stretching + Core", ["upper legs", "waist"]],
    ["Sunday", "Rest Day", []],
  ],
  "recovery": [
    ["Monday", "Gentle Movement", ["waist"]],
    ["Tuesday", "Stretching", ["upper legs", "waist"]],
    ["Wednesday", "Mobility Flow", ["waist", "back"]],
    ["Thursday", "Rest Day", []],
    ["Friday", "Light Mobility", ["upper legs", "waist"]],
    ["Saturday", "Easy Walk", ["upper legs"]],
    ["Sunday", "Rest Day", []],
  ],
};

const PHASES = {
  1: "Foundation building",
  2: "Intensity increase",
  3: "Peak performance",
  4: "Deload + recovery",
};

const PHASE_DURATION = {
  "Foundation building": 30,
  "Intensity increase": 40,
  "Peak performance": 50,
  "Deload + recovery": 20,
};

function _filter(all_ex, body_parts, equipment) {
  const eq = equipment.toLowerCase().trim();
  const out = [];
  for (const bp of body_parts) {
    let pool = all_ex.filter(e =>
      (e.body_part || "").toLowerCase() === bp &&
      (eq === "any" || (e.equipment || "").toLowerCase() === eq)
    );
    if (pool.length === 0) {
      // fallback to body weight for this body part
      pool = all_ex.filter(e =>
        (e.body_part || "").toLowerCase() === bp &&
        (e.equipment || "").toLowerCase() === "body weight"
      );
    }
    out.push(...pool.slice(0, 20));
  }
  return out;
}

function _instructions(e) {
  const instr = e.instructions || {};
  if (typeof instr === 'object') {
    return instr.en || instr.tr || Object.values(instr)[0] || "";
  }
  return String(instr);
}

function _detail(e) {
  return {
    id: e.id || "",
    name: e.name || "",
    body_part: e.body_part || "",
    target: e.target || "",
    equipment: e.equipment || "",
    secondary_muscles: e.secondary_muscles || [],
    instructions: _instructions(e),
    gif_url: e.gif_url || null,
    image: e.image || null,
  };
}

function _intensity(phase, readiness, session) {
  const rest_sessions = new Set(["Active Recovery", "Recovery Walk", "Gentle Movement", "Stretching", "Easy Walk", "Mobility Flow", "Light Mobility"]);
  if (rest_sessions.has(session)) return "Recovery";
  if (readiness < 50) return "Low";
  if (phase === "Peak performance") return "High";
  if (phase === "Foundation building") return "Low";
  return "Medium";
}

// shuffle helper
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

async function generateWeeklyPlan(u, scores, week_number = 1, equipment = "body weight") {
  week_number = Math.max(1, Math.min(4, week_number));
  let phase = PHASES[week_number];
  const all_ex = await _loadExercises();
  const goal_key = u.goal;

  let sessions;
  if (week_number === 4 || scores.workout_readiness < 40) {
    sessions = DAY_SESSIONS["recovery"];
    phase = "Deload + recovery";
  } else {
    sessions = DAY_SESSIONS[goal_key] || DAY_SESSIONS["general_fitness"];
  }

  const days = [];

  for (const [day_name, session_name, body_parts] of sessions) {
    if (!body_parts || body_parts.length === 0 || session_name.includes("Rest")) {
      days.push({
        day: day_name,
        workout: "Rest Day",
        duration_min: null,
        intensity: "Rest",
        notes: "Full rest — prioritise sleep and nutrition.",
        exercises: [],
      });
      continue;
    }

    const candidates = _filter(all_ex, body_parts, equipment);
    const sample = candidates.length ? shuffle([...candidates]).slice(0, Math.min(28, candidates.length)) : [];

    const base_dur = PHASE_DURATION[phase] || 35;
    const intens = _intensity(phase, scores.workout_readiness, session_name);

    if (sample.length === 0) {
      days.push({
        day: day_name,
        workout: session_name,
        duration_min: base_dur,
        intensity: intens,
        notes: `No '${equipment}' exercises found — use bodyweight alternatives.`,
        exercises: [],
      });
      continue;
    }

    const candidate_txt = sample.map(e => `id=${e.id} | ${e.name} | target=${e.target || ''} | body_part=${e.body_part || ''}`).join('\\n');

    const prompt = `
You are an expert fitness coach.
Build a ${session_name} session for ${day_name}.

USER:
- Goal: ${u.goal} | Phase: ${phase} (Week ${week_number}/4)
- Shift: ${u.shift_type} (${u.shift_start_hour || 0}:00–${u.shift_end_hour || 0}:00)
- Sleep: ${u.sleep_hours}h | Energy: ${u.energy_level}/10 | Readiness: ${scores.workout_readiness}/100
- Equipment available: ${equipment}

TARGET BODY PARTS THIS SESSION: ${body_parts.join(", ")}

EXERCISE CANDIDATES (from dataset — pick from these only):
${candidate_txt}

Rules:
- Select 4–6 exercises that best match the goal, phase, and body parts
- Lower readiness → prefer easier, lower-volume exercises
- Night shift workers → prefer exercises doable at home
- Cover all listed body parts across the selected exercises
- Return ONLY the ids from the list above

Respond ONLY with JSON (no markdown):
{
  "session_notes": "<one short coaching tip for this session>",
  "selected_ids":  ["<id>", "<id>", "<id>", "<id>", "<id>"]
}
`;

    let ai = {};
    try {
      ai = await getJsonCompletion(prompt, 0.3);
    } catch (e) {
      // Local Fallback if OpenAI fails or has no key
      ai = {
        session_notes: `Focus on form and controlled movements. Readiness is ${scores.workout_readiness}/100.`,
        selected_ids: sample.slice(0, 5).map(x => x.id)
      };
    }

    const ex_map = {};
    for (const e of sample) {
      ex_map[e.id] = e;
    }

    let selected = (ai.selected_ids || []).filter(eid => ex_map[eid]).map(eid => _detail(ex_map[eid]));

    if (selected.length === 0) {
      selected = candidates.slice(0, 5).map(e => _detail(e));
    }

    days.push({
      day: day_name,
      workout: session_name,
      duration_min: base_dur,
      intensity: intens,
      notes: ai.session_notes || "",
      exercises: selected,
    });
  }

  return { week_number, phase, days };
}

module.exports = {
  generateWeeklyPlan
};
