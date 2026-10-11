/**
 * User context for the AI Assistant.
 *
 * Every AI tool (workout plan, macros, sleep, suggestions, progress, chat) reads the SAME
 * snapshot of the user so the answers are consistent and always tailored:
 *   profile (age, weight, height, BMI / body type, goal, shift)
 *   + nutrition targets and the user's real consumption logs
 *   + sleep logs vs. a personal sleep target
 *   + workout history.
 *
 * Read-only: nothing here writes to the database.
 */
const User = require('../../user/user.model');
const Shift = require('../../onboarding/shift.model');
const { getUserTargets } = require('../../../utils/nutritionTargets');
const { findEatenMeals, mealMoment } = require('../../../utils/dailyNutrition');
const SleepLog = require('../../sleep-recovery/sleepLog.model');
const WorkoutLog = require('../../workout/workoutLog.model');
const { calculateNutritionTargets } = require('../../../utils/macros');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAIN_SLEEP_KEYS = ['night_sleep', 'daytime_sleep'];
const NAP_KEYS = ['nap'];

const GOAL_LABELS = {
  fat_loss: 'Fat Loss',
  strength_building: 'Strength Building',
  maintenance: 'Maintenance',
};

const SHIFT_LABELS = {
  fixed_night: 'Fixed Night',
  rotating: 'Rotating',
  early_morning: 'Early Morning',
  off_shift: 'Off Shift',
};

// ---------------------------------------------------------------- helpers
const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dayKey = date => {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const round1 = n => Math.round(n * 10) / 10;
const round0 = n => Math.round(n);
const sum = arr => arr.reduce((a, b) => a + b, 0);
const avg = arr => (arr.length ? sum(arr) / arr.length : 0);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

const toMinutes = hhmm => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const toHHmm = minutes => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Circular mean / spread of clock times (minutes since midnight). Works across midnight. */
const circularStats = minutesList => {
  const list = minutesList.filter(v => v !== null && v !== undefined);
  if (!list.length) return null;
  const angles = list.map(v => (v / 1440) * 2 * Math.PI);
  const x = avg(angles.map(Math.cos));
  const y = avg(angles.map(Math.sin));
  let meanAngle = Math.atan2(y, x);
  if (meanAngle < 0) meanAngle += 2 * Math.PI;
  const meanMinutes = (meanAngle / (2 * Math.PI)) * 1440;
  const r = Math.min(1, Math.sqrt(x * x + y * y));
  const spreadMinutes = r <= 0.0001 ? 720 : (Math.sqrt(-2 * Math.log(r)) * 1440) / (2 * Math.PI);
  return { mean: meanMinutes, spread: Math.min(720, spreadMinutes), n: list.length };
};

const QUALITY_SCORE = { poor: 1, average: 2, good: 3 };

/**
 * 0-100 "how well did intake fit the calorie target" - goal aware:
 * a fat-loss user is penalised more for overshooting, a strength-building user for undershooting.
 */
const calorieFitScore = (calories, target, goal) => {
  if (!target) return 0;
  const ratio = calories / target;
  const under = Math.max(0, 1 - ratio);
  const over = Math.max(0, ratio - 1);
  let penalty;
  if (goal === 'fat_loss') penalty = under * 90 + over * 180;
  else if (goal === 'strength_building') penalty = under * 180 + over * 90;
  else penalty = (under + over) * 130;
  return Math.max(20, Math.round(100 - penalty));
};
const qualityLabel = score => (score >= 2.5 ? 'good' : score >= 1.75 ? 'average' : 'poor');

// ---------------------------------------------------------------- profile
const buildProfile = (user, shift) => {
  const heightCm = user.height || null;
  const weightKg = user.weight || null;
  const age = user.age || null;

  let bmi = null;
  let bmiCategory = null;
  let idealWeightRange = null;
  if (heightCm && weightKg) {
    const h = heightCm / 100;
    bmi = round1(weightKg / (h * h));
    bmiCategory =
      bmi < 18.5 ? 'underweight' : bmi < 25 ? 'healthy' : bmi < 30 ? 'overweight' : 'obese';
    idealWeightRange = [round1(18.5 * h * h), round1(24.9 * h * h)];
  }

  const goal = user.goalType || null;
  const bodyTypeLabel = bmiCategory
    ? {
        underweight: 'Lean / underweight build',
        healthy: 'Balanced / healthy-weight build',
        overweight: 'Solid / above-average weight build',
        obese: 'High body-mass build',
      }[bmiCategory]
    : null;

  // Plain-language note about where the weight sits relative to the goal
  let weightNote = null;
  if (idealWeightRange && weightKg) {
    if (goal === 'fat_loss' && weightKg > idealWeightRange[1]) {
      weightNote = `${round1(weightKg - idealWeightRange[1])} kg above the top of your healthy range (${idealWeightRange[1]} kg).`;
    } else if (goal === 'strength_building' && weightKg < idealWeightRange[0]) {
      weightNote = `${round1(idealWeightRange[0] - weightKg)} kg below the healthy range - a calorie surplus will help.`;
    } else if (weightKg >= idealWeightRange[0] && weightKg <= idealWeightRange[1]) {
      weightNote = `Weight is inside your healthy range (${idealWeightRange[0]}-${idealWeightRange[1]} kg).`;
    }
  }

  const missing = [];
  if (!heightCm) missing.push('height');
  if (!weightKg) missing.push('weight');
  if (!age) missing.push('age');
  if (!user.gender || user.gender === 'prefer_not_to_say') missing.push('gender');
  if (!goal) missing.push('goal');
  if (!user.shiftType) missing.push('shift');

  return {
    id: String(user._id),
    name: (user.name || '').split(' ')[0] || 'there',
    fullName: user.name || '',
    age,
    gender: user.gender || null,
    heightCm,
    weightKg,
    bmi,
    bmiCategory,
    bodyType: bodyTypeLabel,
    idealWeightRange,
    weightNote,
    goal,
    goalLabel: GOAL_LABELS[goal] || 'General Fitness',
    shiftType: user.shiftType || null,
    shiftLabel: SHIFT_LABELS[user.shiftType] || 'Standard schedule',
    shiftDefaults: shift
      ? { wake: shift.defaultWakeTime || null, sleep: shift.defaultSleepTime || null }
      : null,
    missing,
    isComplete: missing.filter(f => ['height', 'weight', 'age', 'goal'].includes(f)).length === 0,
  };
};

// ---------------------------------------------------------------- targets
const buildTargets = (profile, saved, user, workoutsToday) => {
  let base;
  let source;
  let maintenanceCalories = null;

  if (saved) {
    base = {
      calories: saved.calorieTarget,
      protein: saved.proteinTarget,
      carbs: saved.carbTarget,
      fat: saved.fatTarget,
    };
    source = 'saved';
  } else if (profile.heightCm && profile.weightKg && profile.age) {
    const t = calculateNutritionTargets({
      goalType: user.goalType,
      shiftType: user.shiftType,
      height: profile.heightCm,
      weight: profile.weightKg,
      age: profile.age,
      gender: user.gender || 'male',
    });
    base = {
      calories: t.calorieTarget,
      protein: t.proteinTarget,
      carbs: t.carbTarget,
      fat: t.fatTarget,
    };
    maintenanceCalories = t.maintenanceCalories;
    source = 'calculated';
  } else {
    base = { calories: 2000, protein: 120, carbs: 220, fat: 65 };
    source = 'default';
  }

  // Hydration: ~35 ml per kg, plus a little extra on training days
  const waterMl = profile.weightKg
    ? Math.round((profile.weightKg * 35 + (workoutsToday ? 500 : 0)) / 50) * 50
    : 2500;

  return { ...base, waterMl, source, maintenanceCalories };
};

// ---------------------------------------------------------------- nutrition
const buildNutrition = ({ targets, meals, today, days }) => {
  const todayKey = dayKey(today);
  const byDay = new Map();

  // The logged meals are the single source of truth (same as the home dashboard):
  // every day's totals are summed from the meals eaten on that local day.
  const mealsByDay = new Map();
  meals.forEach(m => {
    const k = dayKey(mealMoment(m));
    if (!mealsByDay.has(k)) mealsByDay.set(k, []);
    mealsByDay.get(k).push(m);
  });
  mealsByDay.forEach((list, k) => {
    byDay.set(k, {
      date: k,
      calories: round0(sum(list.map(m => num(m.calories)))),
      protein: round1(sum(list.map(m => num(m.protein)))),
      carbs: round1(sum(list.map(m => num(m.carbs)))),
      fat: round1(sum(list.map(m => num(m.fat)))),
      mealCount: list.length,
    });
  });

  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey(new Date(today.getTime() - i * DAY_MS));
    daily.push(byDay.get(d) || { date: d, calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 });
  }

  const todayRow = daily[daily.length - 1];
  const progress = pct => ({
    calories: pct(todayRow.calories, targets.calories),
    protein: pct(todayRow.protein, targets.protein),
    carbs: pct(todayRow.carbs, targets.carbs),
    fat: pct(todayRow.fat, targets.fat),
  });
  const pct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);

  const remaining = {
    calories: Math.max(0, round0(targets.calories - todayRow.calories)),
    protein: Math.max(0, round0(targets.protein - todayRow.protein)),
    carbs: Math.max(0, round0(targets.carbs - todayRow.carbs)),
    fat: Math.max(0, round0(targets.fat - todayRow.fat)),
  };

  // History excluding today (today is incomplete) for averages
  const past = daily.slice(0, -1);
  const loggedPast = past.filter(d => d.mealCount > 0 && d.calories > 0);
  const last7Logged = past.slice(-7).filter(d => d.mealCount > 0 && d.calories > 0);
  const avgOf = (rows, key) => (rows.length ? round0(avg(rows.map(r => r[key]))) : 0);

  const adherenceOf = (rows, key, target) =>
    rows.length && target > 0 ? Math.round(avg(rows.map(r => Math.min(r[key] / target, 1.5))) * 100) : null;

  // Calorie "on target" days: within -15% / +10% of the calorie target
  const onTargetDays = last7Logged.filter(
    d => d.calories >= targets.calories * 0.85 && d.calories <= targets.calories * 1.1,
  ).length;

  const todayMeals = (mealsByDay.get(todayKey) || [])
    .slice()
    .sort((a, b) => new Date(a.loggedAt || a.createdAt) - new Date(b.loggedAt || b.createdAt))
    .map(m => ({
      title: m.title,
      mealType: m.mealType,
      time: m.scheduledTime || toHHmm(new Date(m.loggedAt || m.createdAt).getHours() * 60 + new Date(m.loggedAt || m.createdAt).getMinutes()),
      calories: round0(num(m.calories)),
      protein: round1(num(m.protein)),
      carbs: round1(num(m.carbs)),
      fat: round1(num(m.fat)),
    }));

  // Frequently eaten foods (what this user actually eats) - used for realistic suggestions
  const foodMap = new Map();
  meals.forEach(m => {
    const items = m.items && m.items.length ? m.items : [{ name: m.title, ...m }];
    items.forEach(it => {
      const name = String(it.name || m.title || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const entry = foodMap.get(key) || {
        name,
        count: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };
      entry.count += 1;
      entry.calories += num(it.calories);
      entry.protein += num(it.protein);
      entry.carbs += num(it.carbs);
      entry.fat += num(it.fat);
      foodMap.set(key, entry);
    });
  });
  const frequentFoods = Array.from(foodMap.values())
    .map(f => ({
      name: f.name,
      count: f.count,
      calories: round0(f.calories / f.count),
      protein: round1(f.protein / f.count),
      carbs: round1(f.carbs / f.count),
      fat: round1(f.fat / f.count),
    }))
    .filter(f => f.calories > 0 && f.calories <= 1200)
    .sort((a, b) => b.count - a.count || b.protein - a.protein)
    .slice(0, 12);

  // Typical meal times by meal type
  const mealTimes = {};
  ['breakfast', 'lunch', 'dinner', 'snack'].forEach(type => {
    const mins = meals
      .filter(m => m.mealType === type)
      .map(m => toMinutes(m.scheduledTime) ?? (m.loggedAt ? new Date(m.loggedAt).getHours() * 60 + new Date(m.loggedAt).getMinutes() : null));
    const cs = circularStats(mins);
    if (cs && cs.n >= 2) mealTimes[type] = toHHmm(cs.mean);
  });

  return {
    today: {
      ...todayRow,
      meals: todayMeals,
      lastMealAt: todayMeals.length ? mealMoment((mealsByDay.get(todayKey) || []).slice().sort((a, b) => mealMoment(b) - mealMoment(a))[0]) : null,
    },
    progress: progress(pct),
    remaining,
    daily,
    week: {
      loggedDays: last7Logged.length,
      avg: {
        calories: avgOf(last7Logged, 'calories'),
        protein: avgOf(last7Logged, 'protein'),
        carbs: avgOf(last7Logged, 'carbs'),
        fat: avgOf(last7Logged, 'fat'),
      },
      adherence: {
        calories: adherenceOf(last7Logged, 'calories', targets.calories),
        protein: adherenceOf(last7Logged, 'protein', targets.protein),
      },
      onTargetDays,
    },
    loggedDaysInWindow: loggedPast.length,
    frequentFoods,
    mealTimes,
  };
};

// ---------------------------------------------------------------- sleep
const buildSleep = ({ logs, today, days, profile, workoutsLast7, workoutsToday }) => {
  // Personal sleep target (hours)
  let targetHours = 8;
  if (profile.age && profile.age < 18) targetHours = 9;
  else if (profile.age && profile.age >= 65) targetHours = 7.5;
  if (workoutsLast7 >= 5 && !(profile.age && profile.age < 18)) targetHours += 0.5;
  targetHours = Math.max(7, Math.min(9, targetHours));

  const byDay = new Map();
  logs.forEach(l => {
    const k = dayKey(l.date);
    const row = byDay.get(k) || {
      date: k,
      mainMinutes: 0,
      napMinutes: 0,
      recoveryMinutes: 0,
      qualities: [],
      bedtimes: [],
      wakes: [],
      energyBefore: [],
      energyAfter: [],
      entries: 0,
    };
    const minutes = num(l.durationMinutes);
    if (MAIN_SLEEP_KEYS.includes(l.activityKey)) {
      row.mainMinutes += minutes;
      row.bedtimes.push(toMinutes(l.startTime));
      row.wakes.push(toMinutes(l.endTime));
      row.qualities.push(QUALITY_SCORE[l.quality] || 2);
    } else if (NAP_KEYS.includes(l.activityKey)) {
      row.napMinutes += minutes;
      row.qualities.push(QUALITY_SCORE[l.quality] || 2);
    } else {
      row.recoveryMinutes += minutes;
    }
    if (l.energyBefore) row.energyBefore.push(l.energyBefore);
    if (l.energyAfter) row.energyAfter.push(l.energyAfter);
    row.entries += 1;
    byDay.set(k, row);
  });

  const nights = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(new Date(today.getTime() - i * DAY_MS));
    const row = byDay.get(k);
    const sleepMinutes = row ? row.mainMinutes + row.napMinutes : 0;
    nights.push({
      date: k,
      hours: round1(sleepMinutes / 60),
      mainHours: row ? round1(row.mainMinutes / 60) : 0,
      napHours: row ? round1(row.napMinutes / 60) : 0,
      quality: row && row.qualities.length ? qualityLabel(avg(row.qualities)) : null,
      bedtime: row && row.bedtimes.filter(v => v !== null).length ? toHHmm(circularStats(row.bedtimes).mean) : null,
      wake: row && row.wakes.filter(v => v !== null).length ? toHHmm(circularStats(row.wakes).mean) : null,
      logged: sleepMinutes > 0,
    });
  }

  const last7 = nights.slice(-7);
  const logged7 = last7.filter(n => n.logged);
  const total7 = sum(logged7.map(n => n.hours));
  const avgHours7 = logged7.length ? round1(total7 / logged7.length) : 0;
  const debt7 = logged7.length ? round1(Math.max(0, targetHours * logged7.length - total7)) : 0;

  const bedStats = circularStats(
    logs.filter(l => MAIN_SLEEP_KEYS.includes(l.activityKey) && toMinutes(l.startTime) !== null).map(l => toMinutes(l.startTime)),
  );
  const wakeStats = circularStats(
    logs.filter(l => MAIN_SLEEP_KEYS.includes(l.activityKey) && toMinutes(l.endTime) !== null).map(l => toMinutes(l.endTime)),
  );

  const qualityScores = logs
    .filter(l => MAIN_SLEEP_KEYS.includes(l.activityKey) || NAP_KEYS.includes(l.activityKey))
    .map(l => QUALITY_SCORE[l.quality] || 2);
  const qualityCounts = { poor: 0, average: 0, good: 0 };
  logs.forEach(l => {
    if (MAIN_SLEEP_KEYS.includes(l.activityKey) && qualityCounts[l.quality] !== undefined) qualityCounts[l.quality] += 1;
  });

  const todayKey = dayKey(today);
  const todayRow = nights.find(n => n.date === todayKey);
  const lastLogged = [...nights].reverse().find(n => n.logged) || null;

  // Previous 7 (for trend)
  const prev7 = nights.slice(-14, -7).filter(n => n.logged);
  const prevAvg = prev7.length ? round1(sum(prev7.map(n => n.hours)) / prev7.length) : null;

  const lastMain = logs
    .filter(l => MAIN_SLEEP_KEYS.includes(l.activityKey))
    .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt))[0];

  return {
    targetHours,
    nights,
    todayHours: todayRow ? todayRow.hours : 0,
    todayLogged: Boolean(todayRow && todayRow.logged),
    lastLogged,
    lastSleep: lastMain
      ? {
          hours: round1(num(lastMain.durationMinutes) / 60),
          quality: lastMain.quality,
          start: lastMain.startTime,
          end: lastMain.endTime,
          type: lastMain.activityKey,
          date: dayKey(lastMain.date),
        }
      : null,
    loggedNights7: logged7.length,
    avgHours7,
    prevAvgHours: prevAvg,
    debtHours7: debt7,
    avgQuality: qualityScores.length ? qualityLabel(avg(qualityScores)) : null,
    qualityCounts,
    avgBedtime: bedStats ? toHHmm(bedStats.mean) : null,
    avgWake: wakeStats ? toHHmm(wakeStats.mean) : null,
    bedtimeSpreadMin: bedStats && bedStats.n >= 3 ? Math.round(bedStats.spread) : null,
    wakeSpreadMin: wakeStats && wakeStats.n >= 3 ? Math.round(wakeStats.spread) : null,
    napsLast7: sum(last7.map(n => (n.napHours > 0 ? 1 : 0))),
    energyAvg: (() => {
      const e = logs.flatMap(l => (l.energyAfter ? [l.energyAfter] : []));
      return e.length ? round1(avg(e)) : null;
    })(),
    hasData: logs.some(l => MAIN_SLEEP_KEYS.includes(l.activityKey) || NAP_KEYS.includes(l.activityKey)),
    trainedToday: Boolean(workoutsToday),
  };
};

// ---------------------------------------------------------------- workouts
const buildWorkouts = ({ logs, today, totalCompleted, days = 28 }) => {
  const todayKey = dayKey(today);
  const dayCounts = new Map();
  const dayMinutes = new Map();
  logs.forEach(l => {
    const k = dayKey(l.date);
    dayCounts.set(k, (dayCounts.get(k) || 0) + 1);
    dayMinutes.set(k, (dayMinutes.get(k) || 0) + (num(l.durationMinutes) || num(l.workoutId?.durationMinutes)));
  });
  const daily = [];
  for (let i = Math.max(days, 28) - 1; i >= 0; i--) {
    const k = dayKey(new Date(today.getTime() - i * DAY_MS));
    daily.push({ date: k, count: dayCounts.get(k) || 0, minutes: round0(dayMinutes.get(k) || 0) });
  }

  const within = n => logs.filter(l => new Date(l.date) >= new Date(today.getTime() - (n - 1) * DAY_MS));
  const last7 = within(7);
  const last14 = within(14);
  const last28 = within(28);
  const minutes = list => sum(list.map(l => num(l.durationMinutes) || num(l.workoutId?.durationMinutes)));

  let daysSinceLast = null;
  if (logs.length) {
    const latest = logs.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b));
    daysSinceLast = Math.round((today - startOfDay(latest.date)) / DAY_MS);
  }

  // consecutive days with a workout (today counts only if done; otherwise start from yesterday)
  let streak = 0;
  let cursor = dayCounts.has(todayKey) ? 0 : 1;
  while (dayCounts.has(dayKey(new Date(today.getTime() - cursor * DAY_MS)))) {
    streak += 1;
    cursor += 1;
  }

  const intensity = { low: 0, medium: 0, high: 0 };
  last7.forEach(l => {
    if (intensity[l.intensity] !== undefined) intensity[l.intensity] += 1;
  });
  const rpe = last14.map(l => l.perceivedExertion).filter(Boolean);

  const categories = {};
  last28.forEach(l => {
    const c = l.workoutId?.category || 'other';
    categories[c] = (categories[c] || 0) + 1;
  });

  const experience =
    last28.length >= 12 || totalCompleted >= 40 ? 'advanced' : last28.length >= 4 || totalCompleted >= 8 ? 'intermediate' : 'beginner';

  // Consecutive training days in the last 3 days (fatigue signal)
  const highRecent = logs.filter(
    l => l.intensity === 'high' && new Date(l.date) >= new Date(today.getTime() - 2 * DAY_MS),
  ).length;

  return {
    daily,
    todayDone: dayCounts.has(todayKey),
    todayCount: dayCounts.get(todayKey) || 0,
    week: { count: last7.length, minutes: round0(minutes(last7)), days: new Set(last7.map(l => dayKey(l.date))).size },
    fortnight: { count: last14.length, minutes: round0(minutes(last14)) },
    month: { count: last28.length, minutes: round0(minutes(last28)) },
    daysSinceLast,
    streak,
    intensityWeek: intensity,
    avgRpe: rpe.length ? round1(avg(rpe)) : null,
    categories,
    totalCompleted,
    experience,
    highIntensityLast3Days: highRecent,
    recent: logs
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6)
      .map(l => ({
        date: dayKey(l.date),
        title: l.workoutId?.title || 'Workout',
        category: l.workoutId?.category || null,
        minutes: num(l.durationMinutes) || num(l.workoutId?.durationMinutes) || null,
        intensity: l.intensity,
      })),
  };
};

// ---------------------------------------------------------------- readiness
/**
 * Transparent 0-100 readiness built from the last few days (not just "today"),
 * so it does not collapse just because tonight's sleep is not logged yet.
 */
const buildReadiness = ({ sleep, workouts, nutrition, targets, goalType }) => {
  const parts = [];

  // Sleep (40%): last 3 logged days vs target, blended with quality
  const recentSleep = sleep.nights.slice(-3).filter(n => n.logged);
  if (recentSleep.length) {
    const ratio = Math.min(1, avg(recentSleep.map(n => n.hours)) / sleep.targetHours);
    const q = avg(recentSleep.map(n => (n.quality ? QUALITY_SCORE[n.quality] : 2)));
    const score = ratio * 80 + ((q - 1) / 2) * 20;
    parts.push({ key: 'sleep', weight: 0.4, score });
  }

  // Training load (30%): lots of consecutive / high-intensity days lowers readiness
  {
    let score = 90;
    if (workouts.streak >= 4) score -= (workouts.streak - 3) * 12;
    score -= workouts.highIntensityLast3Days * 10;
    if (workouts.todayDone) score -= 8;
    if (workouts.daysSinceLast !== null && workouts.daysSinceLast >= 2) score = Math.min(100, score + 6);
    parts.push({ key: 'load', weight: 0.3, score: Math.max(20, Math.min(100, score)) });
  }

  // Fuel (30% -> 20%): how well recent days hit the calorie target
  const recentFood = nutrition.daily
    .slice(-3, -1)
    .filter(d => d.mealCount > 0 && d.calories > 0);
  if (recentFood.length) {
    const score = avg(
      recentFood.map(d => calorieFitScore(d.calories, targets.calories, goalType)),
    );
    parts.push({ key: 'fuel', weight: 0.2, score });
  }

  const totalWeight = sum(parts.map(p => p.weight));
  let score = Math.round(sum(parts.map(p => p.score * p.weight)) / totalWeight);
  const dataPoints = parts.length;
  const confidence = dataPoints >= 3 ? 'high' : dataPoints === 2 ? 'medium' : 'low';

  // Only the training-load signal (no sleep / food logs): do not claim a high readiness
  if (confidence === 'low') score = Math.min(score, 70);
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    level: score >= 75 ? 'high' : score >= 55 ? 'moderate' : 'low',
    confidence,
    components: Object.fromEntries(parts.map(p => [p.key, Math.round(p.score)])),
  };
};

// ---------------------------------------------------------------- main
/**
 * @param {string} userId
 * @param {{days?: number}} [options] days = how many days of nutrition / sleep history (default 14)
 */
const buildUserContext = async (userId, options = {}) => {
  const days = Math.max(7, Math.min(70, options.days || 14));
  const today = startOfDay();
  const since = new Date(today.getTime() - (days - 1) * DAY_MS);
  const workoutSince = new Date(today.getTime() - (Math.max(days, 28) - 1) * DAY_MS);

  const user = await User.findById(userId).select('-password').lean();
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const [shift, savedTarget, meals, sleepLogs, workoutLogs, totalCompleted] = await Promise.all([
    user.shiftType ? Shift.findOne({ name: user.shiftType }).lean() : null,
    getUserTargets(userId),
    findEatenMeals(
      userId,
      since,
      null,
      'title mealType calories protein carbs fat loggedAt scheduledTime date createdAt items.name items.calories items.protein items.carbs items.fat',
    ),
    SleepLog.find({ userId, date: { $gte: since }, status: { $nin: ['skipped', 'expired', 'scheduled'] } })
      .select('activityKey durationMinutes quality startTime endTime date createdAt energyBefore energyAfter')
      .lean(),
    WorkoutLog.find({ userId, date: { $gte: workoutSince }, completed: true })
      .select('date durationMinutes intensity perceivedExertion workoutId')
      .populate('workoutId', 'title category durationMinutes')
      .lean(),
    WorkoutLog.countDocuments({ userId, completed: true }),
  ]);

  const profile = buildProfile(user, shift);
  const workouts = buildWorkouts({ logs: workoutLogs, today, totalCompleted, days });
  const targets = buildTargets(profile, savedTarget, user, workouts.todayDone);
  const nutrition = buildNutrition({ targets, meals, today, days });
  const sleep = buildSleep({
    logs: sleepLogs,
    today,
    days,
    profile,
    workoutsLast7: workouts.week.count,
    workoutsToday: workouts.todayDone,
  });
  const readiness = buildReadiness({ sleep, workouts, nutrition, targets, goalType: profile.goal });

  return {
    generatedAt: new Date().toISOString(),
    today: dayKey(today),
    days,
    profile,
    targets,
    nutrition,
    sleep,
    workouts,
    readiness,
  };
};

/** Compact, human-readable digest used in AI prompts (kept small for speed / cost). */
const toPromptDigest = ctx => {
  const { profile: p, targets: t, nutrition: n, sleep: s, workouts: w, readiness: r } = ctx;
  const lines = [];
  lines.push(
    `USER: ${p.name}, age ${p.age ?? 'n/a'}, ${p.gender ?? 'gender n/a'}, height ${p.heightCm ?? 'n/a'} cm, weight ${p.weightKg ?? 'n/a'} kg` +
      (p.bmi ? `, BMI ${p.bmi} (${p.bmiCategory}), body type: ${p.bodyType}` : '') +
      `. Goal: ${p.goalLabel}. Shift: ${p.shiftLabel}.`,
  );
  if (p.weightNote) lines.push(`WEIGHT NOTE: ${p.weightNote}`);
  if (p.missing.length) lines.push(`PROFILE GAPS (ask user to add if relevant): ${p.missing.join(', ')}`);
  lines.push(
    `DAILY TARGETS (${t.source}): ${t.calories} kcal, protein ${t.protein}g, carbs ${t.carbs}g, fat ${t.fat}g, water ${t.waterMl} ml.`,
  );
  lines.push(
    `TODAY EATEN: ${n.today.calories} kcal (${n.progress.calories}%), protein ${n.today.protein}g (${n.progress.protein}%), carbs ${n.today.carbs}g (${n.progress.carbs}%), fat ${n.today.fat}g (${n.progress.fat}%), ${n.today.mealCount} meal(s). ` +
      `REMAINING: ${n.remaining.calories} kcal, protein ${n.remaining.protein}g, carbs ${n.remaining.carbs}g, fat ${n.remaining.fat}g.`,
  );
  if (n.today.meals.length) {
    lines.push(
      'TODAY MEALS: ' +
        n.today.meals.map(m => `${m.time} ${m.mealType} "${m.title}" ${m.calories}kcal P${m.protein} C${m.carbs} F${m.fat}`).join('; '),
    );
  }
  lines.push(
    `LAST 7 DAYS NUTRITION: ${n.week.loggedDays} logged day(s), avg ${n.week.avg.calories} kcal, P${n.week.avg.protein}g, C${n.week.avg.carbs}g, F${n.week.avg.fat}g; calorie adherence ${n.week.adherence.calories ?? 'n/a'}%, protein adherence ${n.week.adherence.protein ?? 'n/a'}%, ${n.week.onTargetDays} day(s) on calorie target.`,
  );
  if (n.frequentFoods.length) {
    lines.push('FOODS THEY OFTEN EAT: ' + n.frequentFoods.slice(0, 6).map(f => `${f.name} (${f.calories}kcal, P${f.protein}g)`).join(', '));
  }
  lines.push(
    `SLEEP: target ${s.targetHours}h. Last 7 days: ${s.loggedNights7} logged, avg ${s.avgHours7}h, sleep debt ${s.debtHours7}h, quality ${s.avgQuality ?? 'n/a'}` +
      (s.avgBedtime ? `, usual bed ${s.avgBedtime}, wake ${s.avgWake}` : '') +
      (s.bedtimeSpreadMin !== null ? `, bedtime varies ~${s.bedtimeSpreadMin} min` : '') +
      `. Today so far: ${s.todayLogged ? s.todayHours + 'h' : 'not logged'}.`,
  );
  const nightLine = s.nights
    .slice(-7)
    .map(x => `${x.date.slice(5)}:${x.logged ? x.hours + 'h' + (x.quality ? '/' + x.quality : '') : '-'}`)
    .join(' ');
  lines.push(`SLEEP BY DAY: ${nightLine}`);
  lines.push(
    `WORKOUTS: ${w.week.count} in last 7 days (${w.week.minutes} min), ${w.month.count} in last 28 days, experience ${w.experience}, ` +
      `${w.daysSinceLast === null ? 'none logged yet' : w.daysSinceLast + ' day(s) since last'}, streak ${w.streak}, today ${w.todayDone ? 'done' : 'not done'}.`,
  );
  lines.push(
    `READINESS: ${r.score}/100 (${r.level}, confidence ${r.confidence}); components ${JSON.stringify(r.components)}.`,
  );
  return lines.join('\n');
};

module.exports = {
  buildUserContext,
  toPromptDigest,
  helpers: { startOfDay, dayKey, round1, round0, toMinutes, toHHmm, circularStats, QUALITY_SCORE, calorieFitScore },
};
