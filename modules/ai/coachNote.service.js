/**
 * Personalised "coach note" for each AI tool.
 *
 * The main screens are computed instantly from the user's data. This note is the extra
 * AI-written narrative on top. It is:
 *   - built from the SAME data digest (profile, targets, nutrition / sleep logs, training),
 *   - cached per user + tool and reused until the underlying data changes,
 *   - always available: falls back to a rule-based note if OpenAI is slow / unavailable.
 */
const crypto = require('crypto');
const AIInsightCache = require('./aiInsightCache.model');
const llm = require('./context/llm');
const logger = require('../../utils/logger');
const { buildUserContext, toPromptDigest } = require('./context/userContext.service');
const { buildNutritionAdvice } = require('./insights/nutritionInsights');
const { buildSleepCoaching } = require('./insights/sleepInsights');
const { buildProgressInsights } = require('./insights/progressInsights');
const { buildSuggestions } = require('./insights/suggestionInsights');
const { buildWorkoutPlan } = require('./insights/workoutPlanner');

const TOOLS = ['nutrition', 'sleep', 'workout', 'progress', 'suggestions'];

const FOCUS = {
  nutrition: "Focus: today's calories and macros versus target, the 7-day pattern, and exactly what to eat next.",
  sleep: 'Focus: sleep debt versus their personal target, consistency, and the single most useful change for tonight.',
  workout: 'Focus: why this training plan fits their goal, body, readiness and sleep, and how to execute it.',
  progress: 'Focus: what changed versus the previous period, their strongest area and the one thing to fix first.',
  suggestions: "Focus: the most important thing to do right now and why, using today's data.",
};

const inflight = new Map();

// ------------------------------------------------------------------ tool facts
const buildFacts = (tool, ctx) => {
  switch (tool) {
    case 'nutrition': {
      const a = buildNutritionAdvice(ctx);
      return {
        lines: [
          'KEY FINDINGS: ' + a.insights.map(i => `${i.title}: ${i.message}`).join(' | '),
          a.mealPlan.length ? 'NEXT MEALS: ' + a.mealPlan.map(m => `${m.label} ~${m.time}: ${m.calories}kcal/${m.protein}g protein${m.idea ? ' e.g. ' + m.idea : ''}`).join('; ') : '',
        ],
        rule: () => {
          const top = a.insights.find(i => i.severity === 'warning') || a.insights[0];
          return {
            headline: top.title,
            note: top.message,
            actions: a.mealPlan.slice(0, 2).map(m => `${m.label} (~${m.time}): ${m.calories} kcal, ${m.protein}g protein`),
          };
        },
      };
    }
    case 'sleep': {
      const a = buildSleepCoaching(ctx);
      return {
        lines: [
          'KEY FINDINGS: ' + a.categories.behavioral.map(b => `${b.title}: ${b.message}`).join(' | '),
          `PLAN: bed ${a.stats.plan.bedtime}, wake ${a.stats.plan.wake}, wind-down ${a.stats.plan.windDown}, caffeine cut-off ${a.stats.plan.caffeineCutoff}`,
        ],
        rule: () => {
          const top = a.categories.behavioral[0];
          return {
            headline: top.title,
            note: top.message,
            actions: [`Be in bed by ${a.stats.plan.bedtime}`, `Start winding down at ${a.stats.plan.windDown}`, `Last caffeine by ${a.stats.plan.caffeineCutoff}`],
          };
        },
      };
    }
    case 'workout': {
      const a = buildWorkoutPlan(ctx, {});
      return {
        lines: [
          `PLAN: ${a.summary.workouts} sessions, ${a.summary.totalMinutes} min total, ~${a.summary.estCalories} kcal burned. Adjustments: ${a.personalization.adjustments.join(' ') || 'none'}`,
          `SESSIONS: ${a.schedule.filter(d => d.duration).map(d => `${d.day} ${d.workout} (${d.duration}min, ${d.intensity})`).join('; ')}`,
        ],
        rule: () => ({
          headline: `${a.summary.workouts} sessions built around you`,
          note: `${a.description} ${a.personalization.adjustments[0] || ''}`.trim(),
          actions: [a.personalization.trainingWindow ? `Train around ${a.personalization.trainingWindow.split(' ')[0]}` : 'Start with your first session today', 'Log every session so next week adapts'],
        }),
      };
    }
    case 'progress': {
      const a = buildProgressInsights(ctx, 'week');
      return {
        lines: [
          `SCORES: overall ${a.overall.score}, workouts ${a.scores.workouts}, sleep ${a.scores.sleep ?? 'n/a'}, nutrition ${a.scores.nutrition ?? 'n/a'}`,
          `SUMMARY: ${a.summary}`,
          `STRENGTHS: ${a.strengths.join(' | ')}`,
          `AREAS: ${a.areasForImprovement.join(' | ')}`,
        ],
        rule: () => ({
          headline: `${a.overall.label} week - ${a.overall.score}/100`,
          note: a.summary,
          actions: a.nextSteps.slice(0, 3),
        }),
      };
    }
    default: {
      const list = buildSuggestions(ctx);
      return {
        lines: ['TODAY\'S TOP PRIORITIES: ' + list.slice(0, 4).map(s => `[${s.priority}] ${s.title}: ${s.message}`).join(' | ')],
        rule: () => ({
          headline: list[0]?.title || 'Keep going',
          note: list[0]?.message || 'Log your meals, sleep and workouts so I can tailor your day.',
          actions: list.slice(1, 4).map(s => s.title),
        }),
      };
    }
  }
};

const clean = (value, max) =>
  String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const normalise = raw => ({
  headline: clean(raw.headline, 70),
  note: clean(raw.note, 420),
  actions: (Array.isArray(raw.actions) ? raw.actions : [])
    .map(a => clean(a, 110))
    .filter(Boolean)
    .slice(0, 3),
});

const SYSTEM_PROMPT = `You are Bootsy, the personal coach inside the Bootble fitness app for shift workers.
Write a short, personal coach note for ONE screen of the app, using ONLY the data provided.
Rules:
- Use the user's first name once, and quote their real numbers (kcal, grams, hours, scores, times).
- Never invent data. If something is missing, say what to log instead.
- Write clock times in the 12-hour format with AM/PM (for example 9:30 PM), never 24-hour.
- Tailor to their goal, body (weight / BMI), shift pattern and the numbers provided.
- Warm, direct and practical. No medical diagnosis. No emojis. No markdown.
- Return ONLY JSON: {"headline": string (max 8 words), "note": string (2-3 sentences, max 60 words), "actions": [string, string, string] (max 14 words each)}`;

// ------------------------------------------------------------------ main
const generate = async (userId, tool) => {
  const ctx = await buildUserContext(userId, { days: 14 });
  const facts = buildFacts(tool, ctx);
  const digest = [toPromptDigest(ctx), ...facts.lines].filter(Boolean).join('\n');
  const hash = crypto.createHash('sha1').update(`${tool}|${digest}`).digest('hex');

  const cached = await AIInsightCache.findOne({ userId, tool }).lean();
  if (cached && cached.hash === hash) {
    return { ...cached.payload, source: cached.source, cached: true };
  }

  const ruleNote = () => ({ ...normalise(facts.rule()), source: 'rules', cached: false });

  if (!llm.isConfigured()) return ruleNote();

  try {
    const { content, model } = await llm.complete({
      json: true,
      maxTokens: 260,
      temperature: 0.4,
      timeoutMs: 9000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${FOCUS[tool]}\n\n<user_data>\n${digest}\n</user_data>` },
      ],
    });
    const note = normalise(JSON.parse(content));
    if (!note.headline || !note.note) throw new Error('Incomplete coach note');
    const payload = { ...note, model };

    await AIInsightCache.findOneAndUpdate(
      { userId, tool },
      { userId, tool, hash, payload, source: 'ai', createdAt: new Date() },
      { upsert: true, returnDocument: 'after' },
    ).catch(err => logger.warn(`Coach note cache write failed: ${err.message}`));

    return { ...payload, source: 'ai', cached: false };
  } catch (error) {
    logger.warn(`Coach note (${tool}) falling back to rules: ${error.message}`);
    return ruleNote();
  }
};

const getCoachNote = (userId, tool) => {
  if (!TOOLS.includes(tool)) {
    const error = new Error(`Unknown tool. Use one of: ${TOOLS.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
  const key = `${userId}:${tool}`;
  if (inflight.has(key)) return inflight.get(key);
  const promise = generate(String(userId), tool).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
};

module.exports = { getCoachNote, TOOLS };
