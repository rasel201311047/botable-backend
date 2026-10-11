/**
 * "Review AI Suggestions" - today's prioritised actions, generated from the user's
 * live data (readiness, sleep debt, macros, training history, profile gaps).
 */
const { buildNutritionAdvice } = require('./nutritionInsights');
const { buildSleepCoaching } = require('./sleepInsights');
const { buildProgressInsights } = require('./progressInsights');

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

const readinessReason = ctx => {
  const { sleep: s, workouts: w, readiness: r } = ctx;
  const reasons = [];
  const recent = s.nights.slice(-3).filter(n => n.logged);
  if (r.components.sleep !== undefined && r.components.sleep < 65 && recent.length) {
    const recentAvg = Math.round((recent.reduce((a, n) => a + n.hours, 0) / recent.length) * 10) / 10;
    reasons.push(`you averaged ${recentAvg}h of sleep recently vs your ${s.targetHours}h target`);
  }
  if (w.streak >= 3) reasons.push(`you have trained ${w.streak} days in a row`);
  if (w.highIntensityLast3Days >= 2) reasons.push(`${w.highIntensityLast3Days} high-intensity sessions in the last 3 days`);
  if (r.components.fuel !== undefined && r.components.fuel < 60) reasons.push('your calorie intake has been off target');
  return reasons.length ? reasons.join(', ') : 'recent sleep, training load and food intake';
};

const trainingIdea = ctx => {
  const { profile: p, workouts: w } = ctx;
  if (p.goal === 'fat_loss') return `a ${w.experience === 'beginner' ? '25-30' : '35-40'} min HIIT / cardio + core session`;
  if (p.goal === 'strength_building') return `a ${w.experience === 'beginner' ? '35' : '45'} min strength session (compound lifts first)`;
  return `a ${w.experience === 'beginner' ? '30' : '40'} min full-body session`;
};

const buildSuggestions = (ctx, { context = 'dashboard', foodPool = [] } = {}) => {
  const { profile: p, nutrition: n, sleep: s, workouts: w, readiness: r, targets: t } = ctx;
  const list = [];
  const push = (type, priority, title, message, action, extra = {}) =>
    list.push({ type, priority, title, message, action, ...extra });

  const sleepPlan = buildSleepCoaching(ctx);
  const nutritionAdvice = buildNutritionAdvice(ctx, foodPool);

  // ---------------- Workout / recovery
  const hardRecovery = r.score < 40 || (s.lastSleep && s.lastSleep.hours < s.targetHours - 2.5 && s.lastSleep.date === ctx.today);
  if (hardRecovery) {
    push(
      'sleep',
      'high',
      'Prioritise recovery today',
      `Your readiness is ${r.score}/100 because ${readinessReason(ctx)}. Skip heavy training today - do 15-20 min of walking or mobility and aim to be in bed by ${sleepPlan.stats.plan.bedtime}.`,
      'log_sleep',
    );
    if (!w.todayDone) {
      push('workout', 'low', 'Active recovery only', `A 20 min easy walk or stretching keeps you moving without taxing your recovery (${r.score}/100).`, 'schedule_workout');
    }
  } else if (w.todayDone) {
    push(
      'workout',
      'low',
      'Training done - refuel',
      `You logged ${w.todayCount} session(s) today. ${n.remaining.protein > 20 ? `Get ${Math.min(40, n.remaining.protein)}g of protein in the next 2 hours.` : 'Protein is covered - hydrate and prioritise sleep tonight.'}`,
      'view_nutrition',
    );
  } else if (r.score >= 65) {
    const target = { beginner: 3, intermediate: 4, advanced: 5 }[w.experience] || 3;
    push(
      'workout',
      w.week.count < target ? 'high' : 'medium',
      w.daysSinceLast !== null && w.daysSinceLast >= 3 ? `${w.daysSinceLast} days since your last workout` : 'Good day to train',
      `${r.confidence === 'low' ? 'You have' : `Readiness is ${r.score}/100 and you have`} done ${w.week.count} of ${target} sessions this week. Suggested for your ${p.goalLabel.toLowerCase()} goal: ${trainingIdea(ctx)}.${r.confidence === 'low' ? ' Log your sleep so I can fine-tune the intensity.' : ''}`,
      'schedule_workout',
    );
  } else {
    push(
      'workout',
      'medium',
      'Keep today moderate',
      `Readiness is ${r.score}/100 (${readinessReason(ctx)}). Train at moderate intensity - cut volume by ~20% - or choose zone-2 cardio.`,
      'schedule_workout',
    );
  }
  if (w.streak >= 4 && !hardRecovery) {
    push(
      'workout',
      'high',
      w.todayDone ? 'Plan a rest day tomorrow' : 'Take a rest day',
      `You have trained ${w.streak} days in a row${w.todayDone ? ', including today' : ''}. ${w.todayDone ? 'Make tomorrow a rest or light-walk day: it lowers' : 'A rest day lowers'} injury risk and protects your ${p.goal === 'strength_building' ? 'strength' : 'fat-loss'} progress.`,
      'schedule_workout',
    );
  }

  // ---------------- Nutrition (reuse the macro engine so advice never disagrees)
  nutritionAdvice.insights
    .filter(i => ['calories', 'protein', 'goal'].includes(i.type) && i.severity === 'warning')
    .slice(0, 2)
    .forEach(i => push('nutrition', i.type === 'protein' || n.today.mealCount === 0 ? 'high' : 'medium', i.title, i.message, n.today.mealCount === 0 ? 'log_meal' : 'view_nutrition'));
  if (!list.some(x => x.type === 'nutrition')) {
    const protein = nutritionAdvice.insights.find(i => i.type === 'protein');
    if (protein) push('nutrition', 'low', protein.title, protein.message, 'view_nutrition');
  }

  // ---------------- Sleep
  sleepPlan.categories.behavioral
    .filter(b => b.priority !== 'low')
    .slice(0, 2)
    .forEach(b => push('sleep', b.priority, b.title, b.message, 'log_sleep'));
  if (!s.todayLogged && s.hasData) {
    push('sleep', 'low', 'Log your last sleep', `Today's sleep is not logged yet - log it so your readiness${r.confidence === 'low' ? '' : ` (${r.score}/100)`} and sleep debt (${s.debtHours7}h) stay accurate.`, 'log_sleep');
  }

  // ---------------- Progress snapshot
  const progress = buildProgressInsights(ctx, 'week');
  if (!progress.noData) {
    push('progress', 'low', `Weekly score ${progress.overall.score}/100`, progress.summary, 'view_progress');
  }

  // ---------------- Profile gaps
  const gaps = p.missing.filter(f => ['height', 'weight', 'age', 'goal'].includes(f));
  if (gaps.length) {
    push('profile', 'medium', 'Complete your profile', `Add your ${gaps.join(', ')} so your calorie, macro and sleep targets are calculated for your body instead of defaults.`, 'update_profile');
  }

  // ---------------- Context filter + ordering
  let result = list;
  if (['workout', 'nutrition', 'sleep'].includes(context)) {
    const filtered = list.filter(x => x.type === context);
    if (filtered.length) result = filtered;
  }

  // de-duplicate by title and sort by priority
  const seen = new Set();
  result = result
    .filter(x => (seen.has(x.title) ? false : (seen.add(x.title), true)))
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
    .slice(0, 6)
    .map((x, i) => ({ id: `${x.type}-${i}`, ...x }));

  return result;
};

module.exports = { buildSuggestions };
