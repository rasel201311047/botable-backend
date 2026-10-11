/**
 * "Analyze My Macros" - deterministic, data-driven nutrition coaching.
 * Pure function of the user context (no network, ~instant).
 */
const { calculateNutritionTargets } = require('../../../utils/macros');
const { helpers } = require('../context/userContext.service');

const { round0, round1, toMinutes, toHHmm } = helpers;

const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

const clampPct = v => Math.max(0, Math.min(999, Math.round(v)));

/** Maintenance calories (TDEE) for the user, if the profile is complete enough. */
const estimateMaintenance = ctx => {
  if (ctx.targets.maintenanceCalories) return ctx.targets.maintenanceCalories;
  const { profile: p } = ctx;
  if (!p.heightCm || !p.weightKg || !p.age) return null;
  const t = calculateNutritionTargets({
    goalType: p.goal,
    shiftType: p.shiftType,
    height: p.heightCm,
    weight: p.weightKg,
    age: p.age,
    gender: p.gender === 'female' ? 'female' : 'male',
  });
  return t.maintenanceCalories;
};

/** Start of the user's eating window (hour of day) - from their sleep pattern / shift. */
const wakeHourOf = ctx => {
  const wake = toMinutes(ctx.sleep.avgWake) ?? toMinutes(ctx.profile.shiftDefaults?.wake);
  if (wake !== null && wake !== undefined) return wake / 60;
  if (ctx.profile.shiftType === 'fixed_night') return 16;
  if (ctx.profile.shiftType === 'early_morning') return 4.5;
  return 7;
};

/** How far through the day the user "should" be (0..1), shift aware. */
const dayFraction = (ctx, now = new Date()) => {
  const wake = wakeHourOf(ctx);
  const hour = now.getHours() + now.getMinutes() / 60;
  const elapsed = (hour - wake + 24) % 24;
  return Math.max(0, Math.min(1, elapsed / 16));
};

const shiftGuidance = ctx => {
  const { profile: p, nutrition: n, sleep: s } = ctx;
  const typical = n.mealTimes;
  const own = Object.keys(typical).length
    ? ` Your usual meal times: ${Object.entries(typical)
        .map(([k, v]) => `${MEAL_LABELS[k] || k} ${v}`)
        .join(', ')}.`
    : '';

  switch (p.shiftType) {
    case 'fixed_night':
      return {
        text:
          `On a fixed night shift, eat your biggest protein-rich meal 1-2 hours before the shift, keep mid-shift meals light (protein + fibre, low refined carbs) and stop heavy eating ~2 hours before your daytime sleep${s.avgBedtime ? ` (you usually go to bed around ${s.avgBedtime})` : ''}.` + own,
        defaults: { breakfast: 'on waking', lunch: 'pre-shift', dinner: 'mid-shift' },
      };
    case 'rotating':
      return {
        text:
          'On a rotating shift, move your meal times 1-2 hours per day towards the new schedule and keep protein at every meal to stay alert while your body clock adjusts.' + own,
        defaults: null,
      };
    case 'early_morning':
      return {
        text:
          'On an early-morning shift, have a small carb-led snack before you leave (banana / toast), then a proper protein meal within 2 hours of finishing, and make dinner earlier so sleep is not delayed.' + own,
        defaults: null,
      };
    default:
      return {
        text:
          `Keep meals evenly spaced (every 4-5 hours) with protein in each one to hold energy steady.` + own,
        defaults: null,
      };
  }
};

/** Build ordered meal slots for the rest of the day. */
const buildDaySlots = (ctx, now = new Date()) => {
  const wake = wakeHourOf(ctx);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const typical = ctx.nutrition.mealTimes;

  // Night-shift workers do not eat "breakfast at 7am": name the meals by their role in the shift
  const night = ctx.profile.shiftType === 'fixed_night';
  const defaults = [
    { key: 'breakfast', label: night ? 'Pre-shift meal' : 'Breakfast', offset: night ? 1.5 : 1 },
    { key: 'lunch', label: night ? 'Mid-shift meal' : 'Lunch', offset: 5.5 },
    { key: 'snack', label: night ? 'Mid-shift snack' : 'Snack', offset: 9 },
    { key: 'dinner', label: night ? 'Post-shift meal' : 'Dinner', offset: 12 },
  ];

  const eatenTypes = new Set(ctx.nutrition.today.meals.map(m => m.mealType));

  const slots = defaults.map(d => {
    const timeMin = toMinutes(typical[d.key]) ?? Math.round(((wake + d.offset) % 24) * 60);
    return { ...d, timeMin, time: toHHmm(timeMin), eaten: eatenTypes.has(d.key) };
  });

  // Slots still ahead of the clock (within the next ~14h, wrapping midnight), not yet eaten
  const upcoming = slots
    .filter(s => !s.eaten)
    .map(s => ({ ...s, delta: (s.timeMin - nowMin + 1440) % 1440 }))
    .filter(s => s.delta <= 14 * 60)
    .sort((a, b) => a.delta - b.delta);

  return upcoming.slice(0, 3);
};

const fitScore = (food, need) => {
  // Lower is better: how far the food is from a "good" contribution to the slot
  const calPenalty = need.calories > 0 ? Math.abs(food.calories - need.calories) / need.calories : 0;
  const proteinPenalty = need.protein > 0 ? Math.max(0, need.protein - food.protein) / need.protein : 0;
  return calPenalty * 0.6 + proteinPenalty * 0.9;
};

// Curated, realistic everyday foods (per typical serving) - used when the user has little history
const COMMON_FOODS = [
  ['Grilled chicken breast (150g)', 248, 46, 0, 5],
  ['Chicken & rice bowl', 520, 40, 58, 12],
  ['Boiled eggs (3 large)', 234, 19, 2, 16],
  ['Egg omelette (3 eggs) with vegetables', 290, 20, 5, 21],
  ['Greek yogurt (200g, plain)', 130, 20, 8, 1],
  ['Cottage cheese (200g)', 196, 24, 7, 8],
  ['Tuna (1 can, drained) on whole-grain toast', 330, 35, 28, 6],
  ['Baked fish fillet (150g) with vegetables', 310, 36, 10, 14],
  ['Fish curry with 1 cup rice', 480, 32, 52, 15],
  ['Lentil dal (1.5 cups)', 340, 22, 52, 5],
  ['Paneer or tofu stir-fry (150g)', 340, 24, 12, 22],
  ['Protein shake (1 scoop whey + milk)', 220, 30, 12, 5],
  ['Oats with milk and a banana', 380, 14, 66, 7],
  ['Peanut butter toast (2 slices)', 360, 14, 36, 18],
  ['Lean beef & vegetable stir-fry (150g beef)', 380, 38, 14, 18],
  ['Chickpea & vegetable salad bowl', 360, 16, 48, 12],
  ['Turkey or chicken sandwich (whole-grain)', 340, 28, 36, 8],
  ['Cottage cheese + fruit snack', 210, 22, 20, 4],
  ['Mixed nuts (30g)', 180, 6, 6, 16],
  ['Banana + handful of almonds', 230, 6, 32, 10],
].map(([name, calories, protein, carbs, fat], i) => ({
  id: `common-${i}`,
  name,
  calories,
  protein,
  carbs,
  fat,
  serving: '1 serving',
  source: 'common_foods',
  reason: null,
}));

// USDA rows are noisy ("raw carcass", confectionery...) - only keep things people actually eat
const JUNK_FOOD = /\b(raw|carcass|confection|candy|cookie|cake|chips?|syrup|puffs?|dough|frosting|soda|beer|wine|liquor|oil|lard|shortening|seasoning|powder|supplement|baby food|pet)\b/i;

/** All candidate foods: the user's own foods first, then curated everyday foods, then the (filtered) database. */
const candidateFoods = (ctx, foodPool) => {
  const own = ctx.nutrition.frequentFoods
    .filter(f => f.calories > 0)
    .map(f => ({
      id: `own-${f.name}`,
      name: f.name,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      serving: 'your usual portion',
      source: 'your_foods',
      reason: `You eat this often (${f.count}x lately)`,
      bias: -0.2,
    }));

  const common = COMMON_FOODS.map(f => ({ ...f, bias: 0 }));

  const db = (foodPool || [])
    .filter(f => f.name && f.name.length >= 4 && !JUNK_FOOD.test(f.name) && (f.protein * 4) / Math.max(1, f.calories) >= 0.18)
    .map(f => ({
      id: String(f._id),
      name: f.name,
      calories: round0(f.calories),
      protein: round1(f.protein),
      carbs: round1(f.carbs),
      fat: round1(f.fat),
      serving: `${round0(f.servingSize || 100)}${f.servingUnit || 'g'}`,
      source: 'food_database',
      reason: null,
      bias: 0.1,
    }));

  return [...own, ...common, ...db].filter(f => f.calories > 0 && f.protein <= 80);
};

const rankFor = (candidates, need, calCap) =>
  candidates
    .filter(f => f.calories <= calCap + 100)
    .map(f => ({ f, score: fitScore(f, need) + f.bias }))
    .sort((a, b) => a.score - b.score)
    .map(x => x.f);

const describeFood = (f, remaining, needsProtein) =>
  f.reason ||
  (needsProtein
    ? `${f.protein}g protein for ${f.calories} kcal - helps close your ${remaining.protein}g protein gap`
    : `Fits your remaining ${remaining.calories} kcal`);

/** Foods that really help close today's gap (shown as cards). */
const pickFoods = (ctx, candidates) => {
  const { remaining } = ctx.nutrition;
  const needsProtein = remaining.protein > 15;
  const calCap = Math.max(250, Math.min(700, remaining.calories || 500));
  const need = { calories: Math.min(calCap, remaining.calories || calCap), protein: Math.min(40, remaining.protein) };

  const result = [];
  const seen = new Set();
  for (const f of rankFor(candidates, need, calCap).filter(x => (needsProtein ? x.protein >= 8 : true))) {
    const key = f.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const { bias, ...clean } = f;
    result.push({ ...clean, reason: describeFood(f, remaining, needsProtein) });
    if (result.length >= 6) break;
  }
  return result;
};

const buildNutritionAdvice = (ctx, foodPool = [], now = new Date()) => {
  const { profile: p, targets: t, nutrition: n, workouts: w } = ctx;
  const today = n.today;
  const rem = n.remaining;
  const fraction = dayFraction(ctx, now);
  const expectedCalories = Math.round(t.calories * fraction);
  const insights = [];
  const recommendations = [];

  // Meals still ahead today (drives realistic per-meal advice)
  const slots = rem.calories > 120 ? buildDaySlots(ctx, now) : [];
  const mealsLeft = Math.max(1, slots.length);
  const MAX_MEAL_PROTEIN = 55;
  const MAX_MEAL_KCAL = 850;

  const add = (severity, type, title, message) => {
    insights.push({ severity, type, title, message });
    recommendations.push(message);
  };

  const proteinPerKg = p.weightKg ? round1(t.protein / p.weightKg) : null;
  const eatenProteinPerKg = p.weightKg ? round1(today.protein / p.weightKg) : null;

  // ---- 1. Calories vs pace
  if (today.mealCount === 0) {
    add(
      'warning',
      'calories',
      'Nothing logged yet',
      `You have not logged any food today. Your ${p.goalLabel.toLowerCase()} target is ${t.calories} kcal - aim for a first meal of about ${Math.round(t.calories * 0.28)} kcal with ${Math.round(t.protein * 0.28)}g protein, then log it so I can keep you on track.`,
    );
  } else if (n.progress.calories > 112) {
    add(
      'warning',
      'calories',
      'Over your calorie target',
      `You are ${today.calories - t.calories} kcal over your ${t.calories} kcal target (${n.progress.calories}%). Keep the next meal light - lean protein and vegetables - and skip liquid calories.`,
    );
  } else if (fraction >= 0.35 && today.calories < expectedCalories * 0.6) {
    add(
      'warning',
      'calories',
      'Behind on fuel',
      `You have eaten ${today.calories} of ${t.calories} kcal (${n.progress.calories}%), about ${expectedCalories - today.calories} kcal behind where you should be by now. Eat a ${Math.min(rem.calories, 550)} kcal meal soon so you do not overeat late.`,
    );
  } else if (rem.calories <= t.calories * 0.08) {
    add('success', 'calories', 'Calories on target', `You are at ${n.progress.calories}% of your ${t.calories} kcal target - you have effectively hit today's calories.`);
  } else {
    add(
      'info',
      'calories',
      'Calories on pace',
      `${today.calories} / ${t.calories} kcal so far (${n.progress.calories}%). ${rem.calories} kcal left - roughly ${mealsLeft} more meal(s) of ~${Math.min(MAX_MEAL_KCAL, Math.round(rem.calories / mealsLeft))} kcal.`,
    );
  }

  // ---- 2. Protein (most important for body composition)
  if (rem.protein > 20) {
    const perMeal = rem.protein / mealsLeft;
    const split =
      perMeal <= MAX_MEAL_PROTEIN
        ? `Split the rest into ${mealsLeft} meal(s) of about ${Math.round(perMeal)}g.`
        : `Realistically you can add about ${MAX_MEAL_PROTEIN * mealsLeft}g across the ${mealsLeft} meal(s) left today (~${MAX_MEAL_PROTEIN}g each) - do that and start tomorrow with protein at breakfast instead of forcing it all in tonight.`;
    add(
      n.progress.protein < 40 && fraction > 0.5 ? 'warning' : 'info',
      'protein',
      'Protein gap',
      `You are ${rem.protein}g short on protein today (${today.protein}/${t.protein}g, ${n.progress.protein}%). ${split}${proteinPerKg ? ` Your target is ${proteinPerKg} g per kg of body weight.` : ''}`,
    );
  } else {
    add('success', 'protein', 'Protein target hit', `Protein is covered (${today.protein}/${t.protein}g${eatenProteinPerKg ? `, ${eatenProteinPerKg} g/kg` : ''}). Keep the rest of the day lighter on fat to stay within calories.`);
  }

  // ---- 3. Goal-specific, based on the last 7 days of REAL logs
  const maintenance = estimateMaintenance(ctx);
  if (n.week.loggedDays >= 3) {
    const avgCal = n.week.avg.calories;
    if (p.goal === 'fat_loss' && maintenance) {
      const weeklyDeficit = (maintenance - avgCal) * 7;
      const kgPerWeek = round1(weeklyDeficit / 7700);
      if (kgPerWeek > 1) {
        add('warning', 'goal', 'Deficit too aggressive', `Your 7-day average (${avgCal} kcal) is ${maintenance - avgCal} kcal under maintenance (${maintenance}). That is about ${kgPerWeek} kg/week - too fast to protect muscle. Add ~${Math.round(Math.min(300, (maintenance - avgCal) * 0.4))} kcal, mostly protein and carbs.`);
      } else if (kgPerWeek >= 0.2) {
        add('success', 'goal', 'Fat-loss pace is healthy', `Your 7-day average of ${avgCal} kcal is ${maintenance - avgCal} kcal under maintenance - roughly ${kgPerWeek} kg/week of fat loss at your current weight of ${p.weightKg ?? 'n/a'} kg.`);
      } else {
        add('warning', 'goal', 'No real deficit yet', `Your 7-day average (${avgCal} kcal) is basically at maintenance (${maintenance}). For fat loss, aim for ${t.calories} kcal per day.`);
      }
    } else if (p.goal === 'strength_building') {
      if (maintenance && avgCal < maintenance) {
        add('warning', 'goal', 'Not eating enough to build', `Your 7-day average (${avgCal} kcal) is below maintenance (${maintenance}). For strength gains, aim for ${t.calories} kcal - add a ${Math.min(500, t.calories - avgCal)} kcal meal such as rice, eggs and a protein source.`);
      } else if (n.week.avg.protein && p.weightKg && n.week.avg.protein / p.weightKg < 1.6) {
        add('warning', 'goal', 'Protein too low to build', `You average ${n.week.avg.protein}g protein (${round1(n.week.avg.protein / p.weightKg)} g/kg). Strength training works best at 1.6-2.2 g/kg - for you that is ${Math.round(p.weightKg * 1.6)}-${Math.round(p.weightKg * 2.2)}g.`);
      } else {
        add('success', 'goal', 'Fuelling your training', `Your 7-day average of ${n.week.avg.calories} kcal and ${n.week.avg.protein}g protein supports muscle building.`);
      }
    } else if (p.goal === 'maintenance' && maintenance) {
      const diff = avgCal - maintenance;
      add(Math.abs(diff) > maintenance * 0.12 ? 'warning' : 'success', 'goal', 'Weight stability', Math.abs(diff) > maintenance * 0.12 ? `Your 7-day average (${avgCal} kcal) is ${Math.abs(diff)} kcal ${diff > 0 ? 'above' : 'below'} maintenance (${maintenance}), so your weight will drift ${diff > 0 ? 'up' : 'down'}.` : `Your 7-day average (${avgCal} kcal) is right on maintenance - great for holding weight.`);
    }
  } else {
    add('info', 'consistency', 'Log more days for sharper advice', `I only have ${n.week.loggedDays} day(s) of food logs in the last week. Log 3+ days and I can tell you your real weekly average, adherence and fat-loss / muscle-gain pace.`);
  }

  // ---- 4. Body-type specific note
  if (p.bmiCategory === 'obese' || p.bmiCategory === 'overweight') {
    if (p.goal !== 'strength_building') {
      add('info', 'body', `Tailored for BMI ${p.bmi}`, `At ${p.weightKg} kg / ${p.heightCm} cm, high-protein, high-fibre meals keep you full on fewer calories. Build each plate around lean protein + vegetables, and keep sugary drinks to a minimum.`);
    }
  } else if (p.bmiCategory === 'underweight') {
    add('info', 'body', `Tailored for BMI ${p.bmi}`, `At ${p.weightKg} kg you are below the healthy range (${p.idealWeightRange?.[0]}+ kg). Do not skip meals - add calorie-dense foods like nuts, oats, olive oil and whole milk.`);
  }

  // ---- 5. Training day fuel
  if (w.todayDone) {
    add('info', 'recovery', 'Post-workout fuel', `You trained today - get 25-40g of protein and some carbs within 2 hours to recover${rem.protein > 25 ? `, which also closes your ${rem.protein}g protein gap` : ''}.`);
  }

  // ---- 6. Hydration
  const waterLitres = round1(t.waterMl / 1000);
  recommendations.push(`Drink about ${waterLitres} L of water today (${t.waterMl} ml based on your ${p.weightKg ? p.weightKg + ' kg weight' : 'profile'}${w.todayDone ? ' plus training' : ''}).`);

  // ---- Rest-of-day plan
  const weights = slots.map(s => (s.key === 'snack' ? 0.6 : s.key === 'dinner' ? 1.2 : 1));
  const weightTotal = weights.reduce((a, b) => a + b, 0) || 1;
  const candidates = candidateFoods(ctx, foodPool);
  const foods = pickFoods(ctx, candidates);
  const usedIdeas = new Set();

  const mealPlan = slots.map((s, i) => {
    const share = weights[i] / weightTotal;
    // Cap each meal at what a person can realistically eat in one sitting
    const rawCal = rem.calories * share;
    const scale = rawCal > MAX_MEAL_KCAL ? MAX_MEAL_KCAL / rawCal : 1;
    const slotNeed = {
      calories: Math.round(rawCal * scale),
      protein: Math.min(MAX_MEAL_PROTEIN, Math.round(rem.protein * share)),
      carbs: Math.round(rem.carbs * share * scale),
      fat: Math.round(rem.fat * share * scale),
    };
    // a different idea for each slot, sized for that slot
    const idea = rankFor(candidates, slotNeed, Math.max(250, slotNeed.calories)).find(f => !usedIdeas.has(f.name));
    if (idea) usedIdeas.add(idea.name);
    return {
      slot: s.key,
      label: s.label,
      time: s.time,
      ...slotNeed,
      idea: idea ? `${idea.name} (~${idea.calories} kcal, ${idea.protein}g protein)` : null,
    };
  });

  const plannedCalories = mealPlan.reduce((a, m) => a + m.calories, 0);
  const planNote =
    mealPlan.length && rem.calories - plannedCalories > 150
      ? `Only about ${plannedCalories} of your remaining ${rem.calories} kcal fit into the meals left today - that is fine. Do not force the rest in late at night; start tomorrow on target.`
      : null;

  const guidance = shiftGuidance(ctx);

  // Meal timing map (kept for older clients): the user's real times where known, else slot defaults
  const slotTimes = {};
  ['breakfast', 'lunch', 'dinner'].forEach(k => {
    const base = n.mealTimes[k] || buildDaySlotsTimes(ctx)[k];
    slotTimes[k] = base;
  });

  return {
    title: 'Live Nutrition Guidance',
    basis: {
      goal: p.goalLabel,
      weightKg: p.weightKg,
      heightCm: p.heightCm,
      age: p.age,
      bmi: p.bmi,
      bodyType: p.bodyType,
      shift: p.shiftLabel,
      targetSource: t.source,
    },
    dailyTargets: {
      calorieTarget: t.calories,
      proteinTarget: t.protein,
      carbTarget: t.carbs,
      fatTarget: t.fat,
      waterMl: t.waterMl,
      maintenanceCalories: maintenance,
      proteinPerKg,
    },
    consumed: {
      calories: today.calories,
      protein: today.protein,
      carbs: today.carbs,
      fat: today.fat,
      mealCount: today.mealCount,
    },
    remaining: rem,
    progress: n.progress,
    paceCalories: { expectedByNow: expectedCalories, eaten: today.calories },
    todayMeals: today.meals,
    week: {
      loggedDays: n.week.loggedDays,
      avg: n.week.avg,
      adherence: n.week.adherence,
      onTargetDays: n.week.onTargetDays,
      daily: n.daily.slice(-7).map(d => ({ date: d.date, calories: d.calories, protein: d.protein, logged: d.mealCount > 0 })),
    },
    insights,
    recommendations,
    mealPlan,
    planNote,
    shiftSpecific: guidance.text,
    mealTiming: slotTimes,
    suggestedFoods: foods,
    hydration: { targetMl: t.waterMl },
    profileGaps: p.missing.filter(f => ['height', 'weight', 'age', 'goal'].includes(f)),
    generatedAt: ctx.generatedAt,
  };
};

// default slot times (without upcoming filtering) for the legacy mealTiming map
function buildDaySlotsTimes(ctx) {
  const wake = wakeHourOf(ctx);
  const make = offset => toHHmm(Math.round(((wake + offset) % 24) * 60));
  const range = offset => `${make(offset)}-${toHHmm(((toMinutes(make(offset)) + 90) % 1440))}`;
  return { breakfast: range(1), lunch: range(5.5), dinner: range(12) };
}

module.exports = { buildNutritionAdvice, estimateMaintenance, dayFraction, wakeHourOf, clampPct };
