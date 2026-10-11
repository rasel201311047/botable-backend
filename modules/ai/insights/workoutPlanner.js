/**
 * "Generate Workout Plan" - personalised, instant and stable.
 *
 * Tailored from: goal, experience (real workout history), readiness (sleep + load + fuel),
 * sleep debt, body metrics (weight / BMI -> impact level & calorie burn), shift schedule.
 * No network / AI call in the request path, so it responds immediately. The plan is seeded
 * per user per week so it does not reshuffle on every refresh.
 */
const { getExercisePool } = require('./exerciseLibrary');
const { buildSleepCoaching } = require('./sleepInsights');
const { helpers } = require('../context/userContext.service');

const { toMinutes, toHHmm, round0 } = helpers;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SESSION_DAY_SETS = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
};

// kind: strength | hiit | cardio | core (used for prescriptions and calories)
const TEMPLATES = {
  fat_loss: [
    { name: 'HIIT Full Body', parts: ['cardio', 'waist', 'upper legs'], kind: 'hiit' },
    { name: 'Strength Circuit', parts: ['chest', 'back', 'upper arms'], kind: 'strength' },
    { name: 'Cardio + Core', parts: ['cardio', 'waist'], kind: 'cardio' },
    { name: 'HIIT Lower Body', parts: ['upper legs', 'lower legs', 'cardio'], kind: 'hiit' },
    { name: 'Upper Body + Cardio', parts: ['shoulders', 'upper arms', 'cardio'], kind: 'strength' },
  ],
  strength_building: [
    { name: 'Upper Body Strength', parts: ['chest', 'shoulders', 'upper arms'], kind: 'strength' },
    { name: 'Lower Body Strength', parts: ['upper legs', 'lower legs', 'waist'], kind: 'strength' },
    { name: 'Back & Biceps', parts: ['back', 'upper arms', 'waist'], kind: 'strength' },
    { name: 'Push Day', parts: ['chest', 'shoulders', 'upper arms'], kind: 'strength' },
    { name: 'Legs & Core', parts: ['upper legs', 'lower legs', 'waist'], kind: 'strength' },
  ],
  maintenance: [
    { name: 'Upper Body', parts: ['chest', 'back', 'shoulders'], kind: 'strength' },
    { name: 'Cardio + Core', parts: ['cardio', 'waist'], kind: 'cardio' },
    { name: 'Lower Body', parts: ['upper legs', 'lower legs'], kind: 'strength' },
    { name: 'Full Body Conditioning', parts: ['cardio', 'upper arms', 'upper legs'], kind: 'hiit' },
    { name: 'Mobility + Core', parts: ['waist', 'upper legs', 'back'], kind: 'core' },
  ],
};

const RECOVERY_SESSION = { name: 'Active Recovery', parts: ['cardio', 'waist'], kind: 'recovery' };
const GENTLE_SESSIONS = [
  { name: 'Gentle Movement', parts: ['waist', 'back'], kind: 'recovery' },
  { name: 'Mobility Flow', parts: ['upper legs', 'waist'], kind: 'recovery' },
  { name: 'Easy Walk + Stretch', parts: ['cardio', 'upper legs'], kind: 'recovery' },
];

const PHASES = {
  1: { name: 'Foundation building', intensity: 'Low', rpe: 6, setDelta: -1 },
  2: { name: 'Intensity increase', intensity: 'Medium', rpe: 7, setDelta: 0 },
  3: { name: 'Peak performance', intensity: 'High', rpe: 8, setDelta: 1 },
  4: { name: 'Deload + recovery', intensity: 'Low', rpe: 5, setDelta: -1 },
};

const MET = { strength: 5, hiit: 8, cardio: 7, core: 3.5, recovery: 3 };

const STRETCH = /stretch|pose|cat-cow|yoga|foam|mobility|roll/i;
const HIGH_IMPACT = /jump|burpee|plyo|sprint|hop|skater|box|high knee|bound|skip/i;
const CORE_PARTS = new Set(['waist']);

const EQUIPMENT_SETS = {
  bodyweight: ['body weight'],
  home: ['body weight', 'dumbbell', 'band', 'resistance band', 'kettlebell'],
  gym: null, // anything
};

// ------------------------------------------------------------ seeded rng
const hashString = str => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
};
const mulberry32 = seedFn => {
  let a = seedFn();
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const seededShuffle = (arr, rand) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const isoWeekKey = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
};

// ------------------------------------------------------------ prescription
const HOLD_MOVES = /plank|wall sit|hold|hollow|superman|bird dog|side plank|bridge|dead bug|pose/i;

const prescribe = ({ session, goal, phase, experience, readiness, index, part, equipment, name = '' }) => {
  const isCardio = part === 'cardio';
  const isCore = CORE_PARTS.has(part);
  const recovery = session.kind === 'recovery';
  const lowReady = readiness < 50;

  let sets;
  let reps = null;
  let rest = 60;
  let work = null;
  let rpe = phase.rpe;

  if (recovery) {
    sets = 2;
    reps = isCardio ? null : '10 slow reps';
    work = isCardio ? 120 : null;
    rest = 30;
    rpe = 4;
  } else if (isCardio) {
    sets = goal === 'fat_loss' ? 4 : 3;
    work = goal === 'fat_loss' ? 40 : 60;
    rest = goal === 'fat_loss' ? 20 : 30;
  } else if (isCore) {
    sets = 3;
    reps = HOLD_MOVES.test(name) ? '30-45 sec hold' : '12-15 reps';
    rest = 30;
  } else if (goal === 'strength_building' && index < 2 && session.kind === 'strength') {
    sets = 4;
    reps = equipment === 'bodyweight' ? '10-15' : '6-8';
    rest = 90;
  } else if (goal === 'strength_building') {
    sets = 3;
    reps = '10-12';
    rest = 60;
  } else if (goal === 'fat_loss') {
    sets = 3;
    reps = '12-15';
    rest = 40;
  } else {
    sets = 3;
    reps = '10-12';
    rest = 60;
  }

  if (!recovery) {
    sets += phase.setDelta;
    if (experience === 'beginner') sets = Math.min(sets, 3);
    if (lowReady) {
      sets -= 1;
      rpe = Math.max(4, rpe - 1);
    }
    sets = Math.max(2, sets);
  }

  return { sets, reps, rest_sec: rest, work_sec: work, rpe };
};

const secondsFor = rx => {
  const setTime = rx.work_sec ? rx.work_sec : 40; // ~40s for a set of reps
  return rx.sets * (setTime + rx.rest_sec);
};

// ------------------------------------------------------------ selection
const pickExercises = ({ session, pool, equipmentSet, count, rand, avoidImpact, usedIds }) => {
  const recovery = session.kind === 'recovery';
  const stretchOk = recovery || session.kind === 'core';
  const notStretch = e => stretchOk || !STRETCH.test(e.name);
  const lowImpact = e => !(avoidImpact || recovery) || !HIGH_IMPACT.test(e.name);
  const isGentle = e => STRETCH.test(e.name) || /walk|march|easy/i.test(e.name);
  const eligible = e => (!equipmentSet || equipmentSet.includes(e.equipment)) && lowImpact(e) && notStretch(e);

  const perPart = session.parts.map(part => {
    let list = pool.filter(e => e.body_part === part && eligible(e));
    if (!list.length) list = pool.filter(e => e.body_part === part && e.equipment === 'body weight' && lowImpact(e) && notStretch(e));
    if (!list.length) list = pool.filter(e => e.body_part === part && notStretch(e));
    if (!list.length) list = pool.filter(e => e.body_part === part);
    // prefer exercises not used earlier in the week for variety
    const fresh = list.filter(e => !usedIds.has(e.id));
    const base = fresh.length >= 3 ? fresh : list;
    // recovery sessions: stretches / walking / mobility first, then anything low-impact
    const ordered = recovery
      ? [...seededShuffle(base.filter(isGentle), rand), ...seededShuffle(base.filter(e => !isGentle(e)), rand)]
      : seededShuffle(base, rand);
    return { part, list: ordered };
  });

  const chosen = [];
  let guard = 0;
  while (chosen.length < count && guard < count * 6) {
    for (const entry of perPart) {
      if (chosen.length >= count) break;
      const next = entry.list.find(e => !chosen.some(c => c.id === e.id));
      if (next) chosen.push({ ...next, _part: entry.part });
    }
    guard += 1;
    if (perPart.every(entry => entry.list.every(e => chosen.some(c => c.id === e.id)))) break;
  }
  return chosen;
};

// ------------------------------------------------------------ main
const buildWorkoutPlan = (ctx, { duration = 'week', equipment = 'home' } = {}) => {
  const { profile: p, workouts: w, readiness: r, sleep: s, nutrition: n, targets: t } = ctx;
  const equipKey = EQUIPMENT_SETS[equipment] !== undefined ? equipment : 'home';
  const equipmentSet = EQUIPMENT_SETS[equipKey];
  const goal = TEMPLATES[p.goal] ? p.goal : 'maintenance';
  const weeks = duration === 'month' ? 4 : 1;
  const weight = p.weightKg || 70;
  const pool = getExercisePool();
  const sleepPlan = buildSleepCoaching(ctx);

  const adjustments = [];

  // ---- sessions per week from experience, then reduced by recovery signals
  let sessions = { beginner: 3, intermediate: 4, advanced: 5 }[w.experience] || 3;
  let readinessMode = 'normal';
  const readinessKnown = r.confidence !== 'low';
  if (!readinessKnown) {
    adjustments.push('Log your sleep and meals so I can adapt this plan to your daily readiness.');
  } else if (r.score < 40) {
    readinessMode = 'recovery';
    adjustments.push(`Readiness is ${r.score}/100, so this plan starts with gentle recovery sessions instead of hard training.`);
  } else if (r.score < 55) {
    sessions = Math.max(2, sessions - 1);
    readinessMode = 'light';
    adjustments.push(`Readiness is ${r.score}/100: one fewer session and lower volume until you recover.`);
  }
  if (s.debtHours7 >= 5 && readinessMode === 'normal') {
    sessions = Math.max(2, sessions - 1);
    adjustments.push(`${s.debtHours7}h sleep debt this week: reduced to ${sessions} sessions to protect recovery.`);
  }
  if (w.experience === 'beginner') adjustments.push('Beginner volume: 3 sets maximum per exercise, with a rest day between hard sessions.');

  const avoidImpact = p.bmiCategory === 'obese' || (p.bmiCategory === 'overweight' && p.goal === 'fat_loss' && w.experience === 'beginner');
  if (avoidImpact) adjustments.push(`Low-impact exercises chosen (no jumping) to protect your joints at ${p.weightKg} kg / BMI ${p.bmi}.`);
  if (p.bmiCategory === 'underweight') adjustments.push(`Cardio volume kept low and strength emphasised: at BMI ${p.bmi} your priority is building muscle and eating enough.`);
  if (equipKey === 'bodyweight') adjustments.push('Bodyweight-only plan (no equipment needed).');
  if (p.shiftType === 'fixed_night') adjustments.push('Sessions kept short and home-friendly for night-shift life; train 1-2h after waking, not right before sleep.');

  // ---- training window from the user's sleep plan
  const wake = toMinutes(sleepPlan.stats.plan.wake);
  const trainStart = wake !== null ? toHHmm(wake + 120) : null;
  const trainingWindow = trainStart
    ? `${trainStart} (about 2h after you wake at ${sleepPlan.stats.plan.wake}) and at least 3h before bed at ${sleepPlan.stats.plan.bedtime}`
    : null;

  const schedule = [];
  const usedIds = new Set();
  const userSeed = ctx.profile.id;
  const weekKey = isoWeekKey();

  for (let week = 1; week <= weeks; week++) {
    const phaseKey = weeks === 1 ? (w.experience === 'beginner' ? 1 : w.experience === 'intermediate' ? 2 : 3) : week;
    let phase = { ...PHASES[phaseKey] };
    let weekSessions = sessions;
    let mode = readinessMode;
    if (weeks > 1 && week === 4) {
      weekSessions = Math.max(2, sessions - 1);
    }
    if (readinessMode === 'recovery' && week >= 2) mode = 'normal'; // recovery only gates the first week

    if (mode === 'recovery') phase = { ...PHASES[4] };
    const dayIndexes = SESSION_DAY_SETS[Math.min(5, Math.max(2, weekSessions))];
    const templates = TEMPLATES[goal];
    let mainCounter = 0;
    let restAlternate = 0;

    for (let d = 0; d < 7; d++) {
      const rand = mulberry32(hashString(`${userSeed}|${weekKey}|${week}|${d}`));
      const dayName = DAYS[d];
      const label = weeks > 1 ? `Week ${week} ${dayName}` : dayName;
      const isMain = dayIndexes.includes(d);

      let session;
      if (isMain) {
        session = mode === 'recovery' ? GENTLE_SESSIONS[mainCounter % GENTLE_SESSIONS.length] : templates[mainCounter % templates.length];
        mainCounter += 1;
      } else if (d === 6 || restAlternate % 2 === 1) {
        schedule.push({
          day: label,
          workout: 'Rest Day',
          duration: null,
          intensity: 'Rest',
          notes: `Full rest. ${s.debtHours7 >= 2 ? `Use it to catch up on sleep (you are ${s.debtHours7}h behind your ${s.targetHours}h target).` : 'Prioritise sleep, protein and hydration.'}`,
          exercises: [],
          estCalories: 0,
        });
        restAlternate += d === 6 ? 0 : 1;
        continue;
      } else {
        session = RECOVERY_SESSION;
        restAlternate += 1;
      }

      const recovery = session.kind === 'recovery';
      const count = recovery ? 4 : w.experience === 'beginner' || mode === 'light' ? 4 : session.kind === 'hiit' ? 5 : 6;
      const picked = pickExercises({ session, pool, equipmentSet, count, rand, avoidImpact, usedIds });
      picked.forEach(e => usedIds.add(e.id));

      // heavier compound lifts first: legs/back/chest before arms/core
      const order = { 'upper legs': 0, back: 1, chest: 2, shoulders: 3, 'upper arms': 4, 'lower legs': 5, cardio: 6, waist: 7 };
      const ordered = session.kind === 'strength' ? picked.slice().sort((a, b) => (order[a._part] ?? 9) - (order[b._part] ?? 9)) : picked;

      let seconds = 5 * 60 + 5 * 60; // warm-up + cool-down
      const exercises = ordered.map((e, i) => {
        const rx = prescribe({ session, goal, phase, experience: w.experience, readiness: mode === 'light' ? Math.min(r.score, 49) : r.score, index: i, part: e._part, equipment: equipKey, name: e.name });
        seconds += secondsFor(rx);
        const { _part, _builtin, ...rest } = e;
        return { ...rest, ...rx };
      });

      const minutes = Math.max(15, Math.min(75, Math.round(seconds / 60 / 5) * 5));
      const intensity = recovery ? 'Recovery' : mode === 'light' || r.score < 50 ? 'Low' : phase.intensity;
      const met = MET[session.kind] || 5;
      const estCalories = round0(met * weight * (minutes / 60));

      // coach notes with the user's numbers
      const noteBits = [];
      if (recovery) noteBits.push('Keep it easy - you should be able to hold a conversation.');
      else noteBits.push(`Work at RPE ${exercises[0]?.rpe ?? phase.rpe}/10 (${phase.name.toLowerCase()}).`);
      if (!recovery && session.kind === 'strength' && goal === 'strength_building') noteBits.push('Add weight or a rep when every set feels easy.');
      if (!recovery && session.kind === 'hiit') noteBits.push('Go hard in the work interval, fully recover in the rest.');
      if (s.debtHours7 >= 3 && !recovery) noteBits.push(`You are ${s.debtHours7}h short on sleep - stop a set early if form slips.`);
      if (!recovery) noteBits.push(`Eat 25-40g protein within 2h after (your daily target is ${t.protein}g) and drink ~${Math.round(t.waterMl / 1000 * 10) / 10} L today.`);
      if (trainStart && d === 0 && week === 1) noteBits.push(`Best time to train: ${trainStart}.`);

      schedule.push({
        day: label,
        workout: session.name,
        duration: minutes,
        intensity,
        notes: noteBits.join(' '),
        focus: session.parts.filter(x => x !== 'cardio').concat(session.parts.includes('cardio') ? ['cardio'] : []),
        phase: phase.name,
        estCalories,
        exercises,
      });
    }
  }

  const trainingDays = schedule.filter(x => x.duration);
  const totalMinutes = trainingDays.reduce((a, x) => a + x.duration, 0);
  const totalCalories = trainingDays.reduce((a, x) => a + (x.estCalories || 0), 0);

  const chips = [
    { label: 'Goal', value: p.goalLabel },
    { label: 'Level', value: w.experience[0].toUpperCase() + w.experience.slice(1) },
    { label: 'Readiness', value: readinessKnown ? `${r.score}/100` : 'Log sleep to unlock' },
  ];
  if (p.weightKg) chips.push({ label: 'Body', value: `${p.weightKg} kg${p.bmi ? ` - BMI ${p.bmi}` : ''}` });
  if (s.loggedNights7) chips.push({ label: 'Sleep', value: `${s.avgHours7}h avg` });
  chips.push({ label: 'Shift', value: p.shiftLabel });

  return {
    title: duration === 'month' ? 'Monthly Adaptive Program' : 'Weekly Adaptive Program',
    description: `Built for your ${p.goalLabel.toLowerCase()} goal at ${w.experience} level${readinessKnown ? ` - readiness ${r.score}/100` : ''}${s.loggedNights7 ? `, ${s.avgHours7}h average sleep` : ''}${p.weightKg ? `, ${p.weightKg} kg` : ''}.`,
    period: duration === 'month' ? 'month' : 'week',
    equipment: equipKey,
    personalization: {
      chips,
      adjustments,
      trainingWindow,
      readiness: r,
      profileGaps: p.missing.filter(f => ['height', 'weight', 'age', 'goal'].includes(f)),
    },
    summary: {
      workouts: trainingDays.length,
      totalMinutes,
      estCalories: totalCalories,
      sessionsPerWeek: sessions,
      restDays: schedule.length - trainingDays.length,
    },
    schedule,
    generatedAt: ctx.generatedAt,
  };
};

module.exports = { buildWorkoutPlan };
