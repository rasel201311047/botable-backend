/**
 * "Optimize My Sleep" - deterministic sleep coaching from the user's real sleep logs,
 * personal sleep target, shift pattern, training load and meal timing.
 */
const { helpers } = require('../context/userContext.service');

const { round1, toMinutes, toHHmm } = helpers;

const fmtHours = h => {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
};

const durationLabel = hours => `${round1(hours)}h`;

/** Default sleep/wake anchors per shift when the user has not logged enough sleep yet. */
const shiftAnchors = (ctx, target) => {
  const d = ctx.profile.shiftDefaults;
  if (d && toMinutes(d.wake) !== null && toMinutes(d.sleep) !== null) {
    return { bed: toMinutes(d.sleep), wake: toMinutes(d.wake), from: 'shift' };
  }
  const wake = { fixed_night: 15 * 60 + 30, rotating: 6 * 60, early_morning: 4 * 60 + 30 }[ctx.profile.shiftType] ?? 6 * 60 + 30;
  return { bed: (wake - Math.round((target + 0.25) * 60) + 1440) % 1440, wake, from: 'default' };
};

const buildSleepCoaching = (ctx) => {
  const { profile: p, sleep: s, workouts: w, nutrition: n } = ctx;
  const target = s.targetHours;
  const hasPattern = s.loggedNights7 >= 3 && s.avgBedtime && s.avgWake;

  // ---- anchors for recommended windows
  let wake;
  let anchorSource;
  if (hasPattern) {
    wake = toMinutes(s.avgWake);
    anchorSource = 'your logs';
  } else {
    const anchors = shiftAnchors(ctx, target);
    wake = anchors.wake;
    anchorSource = anchors.from === 'shift' ? 'your shift schedule' : 'a typical schedule for your shift';
  }
  const bedMinutes = (wake - Math.round((target + 0.25) * 60) + 1440 * 2) % 1440;
  const bed = toHHmm(bedMinutes);
  const wakeStr = toHHmm(wake);
  const windDown = toHHmm(bedMinutes - 60);
  const caffeineCutoff = toHHmm(bedMinutes - 6 * 60);
  const lastMeal = toHHmm(bedMinutes - 3 * 60);
  const lastWorkout = toHHmm(bedMinutes - 3 * 60);

  // Realistic step towards the ideal bedtime: at most 60 min earlier than the user's usual bedtime
  let tonightBed = bed;
  if (hasPattern) {
    const usual = toMinutes(s.avgBedtime);
    const gapEarlier = (usual - bedMinutes + 1440) % 1440; // minutes the ideal bedtime is earlier than usual
    if (usual !== null && gapEarlier > 60 && gapEarlier < 720) tonightBed = toHHmm(usual - 60);
  }
  const stepText = tonightBed === bed ? `bed by ${bed}` : `bed by ${tonightBed} (60 min earlier than usual), then shift 30-60 min earlier each night until you reach ${bed}`;

  const primaryLabel = { fixed_night: 'Daytime Sleep', rotating: 'Adaptive Sleep' }[p.shiftType] || 'Core Sleep';
  const recommendedWindows = [
    { type: 'primary', label: primaryLabel, start: bed, end: wakeStr, duration: durationLabel(target) },
  ];

  // Nap only when it is useful: noticeable debt, or a night-shift pattern
  const needsNap = s.debtHours7 >= 3 || (s.loggedNights7 >= 2 && s.avgHours7 > 0 && s.avgHours7 < target - 1);
  if (needsNap || p.shiftType === 'fixed_night') {
    const napLen = s.debtHours7 >= 6 || p.shiftType === 'fixed_night' ? 90 : 20;
    const napStart = (wake + (p.shiftType === 'fixed_night' ? 4 * 60 : 7 * 60)) % 1440;
    recommendedWindows.push({
      type: 'nap',
      label: napLen >= 60 ? 'Recovery Nap (full cycle)' : 'Power Nap',
      start: toHHmm(napStart),
      end: toHHmm(napStart + napLen),
      duration: napLen >= 60 ? `${round1(napLen / 60)}h` : `${napLen}m`,
    });
  }

  // ---- weekly sleep score
  const durationScore = s.loggedNights7 ? Math.min(1, s.avgHours7 / target) * 60 : 0;
  const qualityPts = { good: 20, average: 13, poor: 6 }[s.avgQuality] ?? 0;
  const consistencyPts = s.bedtimeSpreadMin === null ? 0 : Math.max(0, 20 - (s.bedtimeSpreadMin / 90) * 20);
  const score = s.loggedNights7 ? Math.round(durationScore + qualityPts + consistencyPts) : null;

  // ---- behavioural insights from the data
  const behavioral = [];
  const add = (priority, title, message) => behavioral.push({ title, message, priority });

  if (!s.hasData || s.loggedNights7 === 0) {
    add('medium', 'No sleep logged yet', `I cannot personalise your sleep plan until you log sleep. Log your last sleep and I will track it against your ${target}h target.`);
  } else {
    // Last sleep
    if (s.lastSleep && s.lastSleep.hours < target - 2) {
      add('high', 'Short last sleep', `Your last sleep was only ${fmtHours(s.lastSleep.hours)} (${s.lastSleep.start}-${s.lastSleep.end}), ${fmtHours(target - s.lastSleep.hours)} under your ${target}h target. ${w.todayDone ? 'You already trained - prioritise an early night.' : 'Keep today\'s training light and avoid high intensity.'}`);
    }

    // Weekly debt
    if (s.debtHours7 >= 5) {
      add('high', `${round1(s.debtHours7)}h sleep debt this week`, `Across ${s.loggedNights7} logged night(s) you slept ${s.avgHours7}h on average vs your ${target}h target. Tonight: ${stepText}. Use the ${recommendedWindows.find(x => x.type === 'nap') ? 'recovery nap window below' : 'weekend'} to pay it back.`);
    } else if (s.debtHours7 >= 2) {
      add('medium', 'Building sleep debt', `You are ${round1(s.debtHours7)}h behind your target over the last ${s.loggedNights7} logged night(s) (avg ${s.avgHours7}h vs ${target}h). Tonight: ${stepText} - that closes the gap in a few days.`);
    }

    // Trend
    if (s.prevAvgHours !== null && s.loggedNights7 >= 3) {
      const diff = round1(s.avgHours7 - s.prevAvgHours);
      if (diff <= -0.7) add('medium', 'Sleep is trending down', `You averaged ${s.avgHours7}h this week vs ${s.prevAvgHours}h the week before (${diff}h).`);
      else if (diff >= 0.7) add('low', 'Sleep is improving', `You are sleeping ${diff}h more per night than last week (${s.avgHours7}h vs ${s.prevAvgHours}h). Keep the routine going.`);
    }

    // Quality
    const mainNights = s.qualityCounts.poor + s.qualityCounts.average + s.qualityCounts.good;
    if (mainNights >= 3 && s.qualityCounts.poor / mainNights >= 0.4) {
      add('high', 'Quality is the problem', `${s.qualityCounts.poor} of ${mainNights} recent sleeps were rated poor${s.avgHours7 >= target - 0.5 ? ' even though you slept enough hours' : ''}. Look at light, noise, late caffeine (cut off by ${caffeineCutoff}) and screens after ${windDown}.`);
    }

    // Consistency
    if (s.bedtimeSpreadMin !== null && s.bedtimeSpreadMin >= 75) {
      add('medium', 'Irregular bedtime', `Your bedtime swings by about ${s.bedtimeSpreadMin} min (average ${s.avgBedtime}). A steady sleep time is the cheapest recovery upgrade - aim for ${bed}.`);
    }

    // Training load vs sleep
    if (w.week.count >= 4 && s.avgHours7 < target - 0.5) {
      add('high', 'Training hard on short sleep', `You trained ${w.week.count}x this week but slept ${s.avgHours7}h on average. Muscle repair and injury risk both suffer - swap one hard session for mobility or zone-2 work.`);
    }

    // Dinner timing vs bed
    const dinner = toMinutes(n.mealTimes.dinner);
    if (dinner !== null && s.avgBedtime) {
      const gap = (toMinutes(s.avgBedtime) - dinner + 1440) % 1440;
      if (gap < 150) {
        add('medium', 'Late heavy meal', `Your usual dinner (${n.mealTimes.dinner}) is only ${fmtHours(gap / 60)} before bed (${s.avgBedtime}). Move it to ${lastMeal} or earlier, or keep it light.`);
      }
    }

    // Positive reinforcement
    if (behavioral.length === 0) {
      add('low', 'Sleep looks solid', `${s.avgHours7}h average over ${s.loggedNights7} night(s) against a ${target}h target${s.bedtimeSpreadMin !== null ? ` with a steady ${s.avgBedtime} bedtime` : ''}. Keep going.`);
    }
  }

  // ---- shift specific (tailored with the user's own times)
  const shiftSpecific = [];
  switch (p.shiftType) {
    case 'fixed_night':
      shiftSpecific.push(`Protect your daytime sleep window ${bed}-${wakeStr} (${anchorSource}). Blackout curtains, white noise and phone on silent.`);
      shiftSpecific.push(`Wear sunglasses on the way home so morning light does not wake your body clock; finish your last coffee by ${caffeineCutoff}.`);
      shiftSpecific.push('Take a 60-90 min pre-shift nap before your first night to bank sleep.');
      break;
    case 'rotating':
      shiftSpecific.push(`Shift your bed and wake time by 1-2 hours per day before a rotation, starting from ${bed} / ${wakeStr}.`);
      shiftSpecific.push('Use bright light right after waking and dim lights 2 hours before bed to anchor your body clock to the new shift.');
      break;
    case 'early_morning':
      shiftSpecific.push(`To wake at ${wakeStr} with ${target}h of sleep you need to be in bed by ${bed}. Treat ${windDown} as "phone down".`);
      shiftSpecific.push('Get daylight within 30 minutes of waking and keep weekend wake-ups within 1 hour of weekdays.');
      break;
    default:
      shiftSpecific.push(`On regular days aim for ${bed}-${wakeStr}; on off days keep your wake time within 60 minutes of that.`);
  }
  if (s.debtHours7 >= 3 && p.shiftType !== 'fixed_night') {
    const nap = recommendedWindows.find(x => x.type === 'nap');
    shiftSpecific.push(
      nap
        ? `Because you carry ${round1(s.debtHours7)}h of debt, nap at ${nap.start} (${nap.duration}) - not later, so it does not hurt tonight's sleep.`
        : `Because you carry ${round1(s.debtHours7)}h of debt, add a 20-minute nap around 14:00 - not later, so it does not hurt tonight's sleep.`,
    );
  }

  // ---- personalised habits (replaces the generic list)
  const universal = [];
  universal.push(
    s.wakeSpreadMin !== null && s.wakeSpreadMin >= 45
      ? `Fix your wake time at ${wakeStr} - it currently varies by about ${s.wakeSpreadMin} min, which weakens sleep quality.`
      : `Keep waking at ${wakeStr} every day, including off days.`,
  );
  universal.push(`Start winding down at ${windDown}: dim the lights and stop screens 60 minutes before bed (${bed}).`);
  universal.push(`Last caffeine by ${caffeineCutoff} (about 6 hours before bed).`);
  universal.push(`Finish your last big meal by ${lastMeal}; a small protein snack later is fine.`);
  if (w.week.count > 0 || p.goal === 'strength_building') universal.push(`Finish hard training by ${lastWorkout}; evening sessions raise heart rate and delay sleep.`);
  if (s.avgQuality === 'poor' || s.qualityCounts.poor >= 2) universal.push('Keep the room cool (about 18C), dark and quiet - poor-quality nights are the biggest drag on your recovery.');

  // ---- actions (keep log_sleep always available for older clients)
  const actions = ['log_sleep'];
  if (s.debtHours7 > 0 || s.avgQuality === 'poor' || (s.bedtimeSpreadMin !== null && s.bedtimeSpreadMin >= 60) || !s.hasData) actions.push('schedule_wind_down');

  return {
    title: 'Sleep Coaching',
    categories: { behavioral, shiftSpecific, universal },
    actions,
    recommendedWindows,
    shiftContext: p.shiftType || 'standard',
    basis: {
      targetHours: target,
      targetReason:
        p.age && p.age < 18 ? 'Under-18s need ~9h' : p.age && p.age >= 65 ? 'Adults 65+ need ~7.5h' : w.week.count >= 5 ? '8h baseline + 0.5h for high training volume' : '8h adult baseline',
      anchoredOn: anchorSource,
      goal: p.goalLabel,
      shift: p.shiftLabel,
    },
    stats: {
      score,
      scoreLabel: score === null ? null : score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 45 ? 'Fair' : 'Needs work',
      targetHours: target,
      avgHours: s.avgHours7,
      loggedNights: s.loggedNights7,
      debtHours: s.debtHours7,
      quality: s.avgQuality,
      avgBedtime: s.avgBedtime,
      avgWake: s.avgWake,
      bedtimeSpreadMin: s.bedtimeSpreadMin,
      todayHours: s.todayHours,
      todayLogged: s.todayLogged,
      lastSleep: s.lastSleep,
      plan: { bedtime: bed, tonightBedtime: tonightBed, wake: wakeStr, windDown, caffeineCutoff, lastMeal },
    },
    week: s.nights.slice(-7).map(x => ({ date: x.date, hours: x.hours, quality: x.quality, logged: x.logged })),
    profileGaps: p.missing.filter(f => ['age', 'shift'].includes(f)),
    generatedAt: ctx.generatedAt,
  };
};

module.exports = { buildSleepCoaching };
