/**
 * "Analyze Progress" - week / month review built from the user's real logs,
 * compared against the previous period and against targets derived from their profile.
 */
const { helpers } = require('../context/userContext.service');

const { round0, round1 } = helpers;

const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const sum = arr => arr.reduce((a, b) => a + b, 0);
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const signed = v => (v > 0 ? `+${v}` : `${v}`);

const SESSIONS_PER_WEEK = { beginner: 3, intermediate: 4, advanced: 5 };

const label = score => (score >= 85 ? 'Excellent' : score >= 70 ? 'Strong' : score >= 55 ? 'Building' : score >= 40 ? 'Needs focus' : 'Getting started');

/**
 * @param {object} ctx  context built with days >= period * 2
 * @param {'week'|'month'} period
 */
const buildProgressInsights = (ctx, period = 'week') => {
  const P = period === 'month' ? 28 : 7;
  const { profile: p, targets: t, nutrition: n, sleep: s, workouts: w } = ctx;
  const isMonth = period === 'month';
  const unitWord = isMonth ? 'month' : 'week';
  const prevWord = isMonth ? 'last month' : 'last week';

  // ---------- slice current / previous windows
  const sleepDays = s.nights; // length == ctx.days
  const cur = a => a.slice(-P);
  const prev = a => a.slice(-P * 2, -P);

  const curSleep = cur(sleepDays).filter(d => d.logged);
  const prevSleep = prev(sleepDays).filter(d => d.logged);

  // nutrition: exclude today (incomplete)
  const nutDays = n.daily.slice(0, -1);
  const curNut = nutDays.slice(-P).filter(d => d.mealCount > 0 && d.calories > 0);
  const prevNut = nutDays.slice(-P - P, -P).filter(d => d.mealCount > 0 && d.calories > 0);

  const wDays = w.daily;
  const curW = cur(wDays);
  const prevW = prev(wDays);

  // ---------- workouts
  const sessionsTarget = (SESSIONS_PER_WEEK[w.experience] || 3) * (isMonth ? 4 : 1);
  const sessions = sum(curW.map(d => d.count));
  const prevSessions = sum(prevW.map(d => d.count));
  const minutes = sum(curW.map(d => d.minutes));
  const prevMinutes = sum(prevW.map(d => d.minutes));
  const workoutScore = clamp((sessions / sessionsTarget) * 100);

  // ---------- sleep
  const avgSleep = curSleep.length ? round1(avg(curSleep.map(d => d.hours))) : null;
  const prevAvgSleep = prevSleep.length ? round1(avg(prevSleep.map(d => d.hours))) : null;
  const sleepCoverage = curSleep.length / P;
  const sleepScore = avgSleep === null ? null : clamp(Math.pow(Math.min(1, avgSleep / s.targetHours), 2) * 85 + Math.min(1, sleepCoverage * 1.5) * 15);
  const poorNights = cur(sleepDays).filter(d => d.quality === 'poor').length;

  // ---------- nutrition
  const avgCalories = curNut.length ? round0(avg(curNut.map(d => d.calories))) : null;
  const avgProtein = curNut.length ? round0(avg(curNut.map(d => d.protein))) : null;
  const prevAvgCalories = prevNut.length ? round0(avg(prevNut.map(d => d.calories))) : null;
  const calAdherence = curNut.length ? round0(avg(curNut.map(d => helpers.calorieFitScore(d.calories, t.calories, p.goal)))) : null;
  const proteinAdherence = curNut.length ? round0(avg(curNut.map(d => Math.min(d.protein / t.protein, 1) * 100))) : null;
  const onTarget = curNut.filter(d => d.calories >= t.calories * 0.85 && d.calories <= t.calories * 1.1).length;
  const nutritionScore = curNut.length ? clamp(calAdherence * 0.5 + proteinAdherence * 0.35 + Math.min(1, curNut.length / (P * 0.7)) * 15) : null;

  // ---------- consistency (days with ANY log)
  const activeDays = curW.filter((d, i) => {
    const sleepRow = cur(sleepDays)[i];
    const nutRow = cur(n.daily)[i];
    return d.count > 0 || (sleepRow && sleepRow.logged) || (nutRow && nutRow.mealCount > 0);
  }).length;
  const consistencyScore = clamp((activeDays / P) * 100);

  // ---------- overall (re-weighted when a domain has no data)
  const parts = [
    { w: 0.3, v: workoutScore },
    { w: 0.3, v: sleepScore },
    { w: 0.3, v: nutritionScore },
    { w: 0.1, v: consistencyScore },
  ].filter(x => x.v !== null);
  const overall = parts.length ? Math.round(sum(parts.map(x => x.v * x.w)) / sum(parts.map(x => x.w))) : 0;

  // ---------- strengths / improvements / next steps (all with the user's numbers)
  const strengths = [];
  const areas = [];
  const nextSteps = [];

  // workouts
  if (sessions >= sessionsTarget) {
    strengths.push(`Training consistency: ${sessions} session(s) this ${unitWord} (target ${sessionsTarget} for your ${w.experience} level)${prevSessions ? `, ${signed(sessions - prevSessions)} vs ${prevWord}` : ''}.`);
  } else if (sessions > 0) {
    areas.push(`Training volume: ${sessions} of ${sessionsTarget} target sessions this ${unitWord}.`);
    nextSteps.push(`Schedule ${sessionsTarget - sessions} more session(s) ${isMonth ? 'this month' : 'this week'} - ${w.daysSinceLast !== null && w.daysSinceLast >= 2 ? `it has been ${w.daysSinceLast} days since your last workout, so ` : ''}start with ${p.goal === 'fat_loss' ? 'a 30-min HIIT or cardio + core session' : p.goal === 'strength_building' ? 'a 40-min strength session' : 'a 30-min full-body session'}.`);
  } else {
    areas.push(`No workouts completed this ${unitWord}.`);
    nextSteps.push(`Do one 20-30 min session ${w.daysSinceLast === null ? 'to get started' : 'in the next 24 hours'} - generate it from the AI Program.`);
  }
  if (prevSessions && sessions >= prevSessions + 2) strengths.push(`Big jump in activity: ${sessions} sessions vs ${prevSessions} ${prevWord}.`);

  // sleep
  if (avgSleep === null) {
    areas.push(`No sleep logged this ${unitWord}, so recovery cannot be measured.`);
    nextSteps.push(`Log your sleep every morning - aim for ${s.targetHours}h.`);
  } else if (avgSleep >= s.targetHours - 0.3) {
    strengths.push(`Sleep: ${avgSleep}h average against your ${s.targetHours}h target${prevAvgSleep !== null ? ` (${signed(round1(avgSleep - prevAvgSleep))}h vs ${prevWord})` : ''}.`);
  } else {
    areas.push(`Sleep duration: ${avgSleep}h average, ${round1(s.targetHours - avgSleep)}h under your ${s.targetHours}h target${s.debtHours7 >= 2 ? ` (${s.debtHours7}h debt this week)` : ''}.`);
    nextSteps.push(`Go to bed ${Math.min(90, Math.round((s.targetHours - avgSleep) * 60))} minutes earlier${s.avgBedtime ? ` than your usual ${s.avgBedtime}` : ''} for the next 7 days.`);
  }
  if (poorNights >= 2) {
    areas.push(`${poorNights} poor-quality sleep(s) this ${unitWord}.`);
    nextSteps.push('Cut caffeine 6 hours before bed and keep screens off for the last hour.');
  }

  // nutrition
  if (nutritionScore === null) {
    areas.push(`No meals logged this ${unitWord}, so nutrition cannot be analysed.`);
    nextSteps.push(`Log at least your main meals - your daily target is ${t.calories} kcal and ${t.protein}g protein.`);
  } else {
    if (proteinAdherence >= 90) strengths.push(`Protein: you average ${avgProtein}g vs a ${t.protein}g target (${proteinAdherence}%).`);
    else {
      areas.push(`Protein: ${avgProtein}g average vs ${t.protein}g target (${proteinAdherence}%).`);
      nextSteps.push(`Add ~${Math.max(10, t.protein - avgProtein)}g protein per day - e.g. an extra serving of eggs, fish, chicken or Greek yogurt.`);
    }
    if (calAdherence >= 85) strengths.push(`Calories: ${onTarget} of ${curNut.length} logged day(s) within range of your ${t.calories} kcal target.`);
    else {
      const diff = avgCalories - t.calories;
      areas.push(`Calories: you average ${avgCalories} kcal, ${Math.abs(diff)} ${diff > 0 ? 'over' : 'under'} your ${t.calories} kcal target.`);
      const steepDeficit = t.maintenanceCalories && t.maintenanceCalories - avgCalories > 1000;
      if (diff > 0) nextSteps.push(`Trim about ${Math.min(500, diff)} kcal per day (portion sizes / sugary drinks) to match your ${p.goalLabel} goal.`);
      else if (p.goal === 'fat_loss' && !steepDeficit) nextSteps.push(`You are in a steady deficit - keep it, and spend the calories you do eat on protein and vegetables.`);
      else nextSteps.push(`Eat about ${Math.min(500, -diff)} kcal more per day - under-eating makes ${p.goalLabel.toLowerCase()} progress harder to sustain.`);
    }
    if (curNut.length < P * 0.6) {
      areas.push(`Logging gaps: food logged on only ${curNut.length} of ${P} day(s).`);
    } else {
      strengths.push(`Nutrition tracking: ${curNut.length} of ${P} days logged.`);
    }
  }

  // body / profile
  if (p.weightNote && p.bmiCategory) {
    if (p.bmiCategory === 'healthy') strengths.push(`Body metrics: ${p.weightKg} kg at ${p.heightCm} cm (BMI ${p.bmi}) is in the healthy range.`);
  }
  if (!p.isComplete) {
    nextSteps.push(`Complete your profile (${p.missing.filter(f => ['height', 'weight', 'age', 'goal'].includes(f)).join(', ')}) so targets are exact.`);
  }
  if (ctx.readiness.confidence !== 'low' && ctx.readiness.score < 55) nextSteps.push(`Your readiness is ${ctx.readiness.score}/100 - make the next session light or active recovery.`);

  // ---------- summary
  const bits = [];
  bits.push(`${sessions} workout(s) (${minutes} min)`);
  bits.push(avgSleep !== null ? `${avgSleep}h average sleep` : 'no sleep logged');
  bits.push(avgCalories !== null ? `${avgCalories} kcal average intake (${calAdherence}% on target)` : 'no meals logged');
  const weakest = [
    { k: 'training', v: workoutScore },
    { k: 'sleep', v: sleepScore ?? -1 },
    { k: 'nutrition', v: nutritionScore ?? -1 },
  ].sort((a, b) => a.v - b.v)[0];
  const strongest = [
    { k: 'training', v: workoutScore },
    { k: 'sleep', v: sleepScore ?? -1 },
    { k: 'nutrition', v: nutritionScore ?? -1 },
  ].sort((a, b) => b.v - a.v)[0];
  const noData = sessions === 0 && avgSleep === null && nutritionScore === null;
  const rangeText = isMonth ? 'last 4 weeks' : 'last 7 days';
  const summary = noData
    ? `No workouts, sleep or meals logged in the ${rangeText}, so there is nothing to analyse yet. Log a few days of activity and I will score your progress against your ${p.goalLabel.toLowerCase()} goal.`
    : `${isMonth ? 'Last 4 weeks' : 'Last 7 days'}: ${bits.join(', ')}. Overall ${overall}/100 for your ${p.goalLabel.toLowerCase()} goal` +
      (parts.length >= 2 && strongest.v >= 50 && strongest.v - weakest.v >= 20 && weakest.k !== strongest.k
        ? ` - ${strongest.k} is your strongest area, ${weakest.k} needs the most work.`
        : '.');

  // ---------- metrics (for the UI cards)
  const delta = (cur, previous, digits = 0) => (previous === null || previous === undefined ? null : digits ? round1(cur - previous) : round0(cur - previous));
  const metrics = [
    {
      key: 'workouts',
      label: 'Workouts',
      value: sessions,
      unit: '',
      target: sessionsTarget,
      delta: prevSessions || prevW.some(d => d.count) ? delta(sessions, prevSessions) : null,
      detail: `${minutes} min total`,
      status: workoutScore >= 90 ? 'good' : workoutScore >= 55 ? 'ok' : 'low',
    },
    {
      key: 'sleep',
      label: 'Avg sleep',
      value: avgSleep,
      unit: 'h',
      target: s.targetHours,
      delta: avgSleep !== null ? delta(avgSleep, prevAvgSleep, 1) : null,
      detail: `${curSleep.length}/${P} nights logged`,
      status: avgSleep === null ? 'none' : avgSleep >= s.targetHours - 0.3 ? 'good' : avgSleep >= s.targetHours - 1.2 ? 'ok' : 'low',
    },
    {
      key: 'calories',
      label: 'Avg calories',
      value: avgCalories,
      unit: 'kcal',
      target: t.calories,
      delta: avgCalories !== null ? delta(avgCalories, prevAvgCalories) : null,
      detail: avgCalories !== null ? `${onTarget}/${curNut.length} days on target` : 'no logs',
      status: calAdherence === null ? 'none' : calAdherence >= 85 ? 'good' : calAdherence >= 65 ? 'ok' : 'low',
    },
    {
      key: 'protein',
      label: 'Avg protein',
      value: avgProtein,
      unit: 'g',
      target: t.protein,
      delta: null,
      detail: proteinAdherence !== null ? `${proteinAdherence}% of target` : 'no logs',
      status: proteinAdherence === null ? 'none' : proteinAdherence >= 90 ? 'good' : proteinAdherence >= 65 ? 'ok' : 'low',
    },
  ];

  return {
    period,
    rangeLabel: isMonth ? 'Last 4 weeks' : 'Last 7 days',
    summary,
    overall: { score: overall, label: noData ? 'No data yet' : label(overall) },
    noData,
    scores: {
      workouts: Math.round(workoutScore),
      sleep: sleepScore === null ? null : Math.round(sleepScore),
      nutrition: nutritionScore === null ? null : Math.round(nutritionScore),
      consistency: Math.round(consistencyScore),
    },
    strengths: strengths.slice(0, 5),
    areasForImprovement: areas.slice(0, 5),
    nextSteps: nextSteps.slice(0, 5),
    metrics,
    readiness: ctx.readiness,
    basis: {
      goal: p.goalLabel,
      weightKg: p.weightKg,
      heightCm: p.heightCm,
      bmi: p.bmi,
      bodyType: p.bodyType,
      experience: w.experience,
      daysTracked: activeDays,
      periodDays: P,
    },
    trend: cur(wDays).map((d, i) => ({
      date: d.date,
      workouts: d.count,
      sleepHours: cur(sleepDays)[i]?.hours || 0,
      calories: cur(n.daily)[i]?.calories || 0,
    })),
    profileGaps: p.missing.filter(f => ['height', 'weight', 'age', 'goal'].includes(f)),
    generatedAt: ctx.generatedAt,
  };
};

module.exports = { buildProgressInsights };
