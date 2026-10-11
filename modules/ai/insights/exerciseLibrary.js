/**
 * Exercise pool for the AI workout planner.
 *
 * - Instant: returns the in-memory dataset when loaded, otherwise a built-in library.
 *   The planner never waits on the network.
 * - The large public dataset (with GIFs / instructions) is warmed in the background and
 *   cached on disk so restarts are fast too.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const logger = require('../../../utils/logger');

const DATASET_URL =
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/refs/heads/main/data/exercises.json';
const CACHE_FILE = path.join(os.tmpdir(), 'bootble-exercises-cache.json');
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// [name, body_part, target, equipment]
const BUILTIN = [
  ['Push-up', 'chest', 'pectorals', 'body weight'],
  ['Incline Push-up', 'chest', 'pectorals', 'body weight'],
  ['Dumbbell Bench Press', 'chest', 'pectorals', 'dumbbell'],
  ['Dumbbell Fly', 'chest', 'pectorals', 'dumbbell'],
  ['Diamond Push-up', 'upper arms', 'triceps', 'body weight'],
  ['Bench Dip', 'upper arms', 'triceps', 'body weight'],
  ['Dumbbell Biceps Curl', 'upper arms', 'biceps', 'dumbbell'],
  ['Hammer Curl', 'upper arms', 'biceps', 'dumbbell'],
  ['Pike Push-up', 'shoulders', 'delts', 'body weight'],
  ['Dumbbell Shoulder Press', 'shoulders', 'delts', 'dumbbell'],
  ['Lateral Raise', 'shoulders', 'delts', 'dumbbell'],
  ['Superman Hold', 'back', 'spinal erectors', 'body weight'],
  ['Dumbbell Bent-over Row', 'back', 'lats', 'dumbbell'],
  ['Resistance Band Row', 'back', 'lats', 'band'],
  ['Reverse Snow Angel', 'back', 'upper back', 'body weight'],
  ['Bodyweight Squat', 'upper legs', 'quads', 'body weight'],
  ['Reverse Lunge', 'upper legs', 'quads', 'body weight'],
  ['Glute Bridge', 'upper legs', 'glutes', 'body weight'],
  ['Goblet Squat', 'upper legs', 'quads', 'dumbbell'],
  ['Romanian Deadlift', 'upper legs', 'hamstrings', 'dumbbell'],
  ['Bulgarian Split Squat', 'upper legs', 'quads', 'body weight'],
  ['Wall Sit', 'upper legs', 'quads', 'body weight'],
  ['Calf Raise', 'lower legs', 'calves', 'body weight'],
  ['Single-leg Calf Raise', 'lower legs', 'calves', 'body weight'],
  ['Plank', 'waist', 'abs', 'body weight'],
  ['Dead Bug', 'waist', 'abs', 'body weight'],
  ['Bicycle Crunch', 'waist', 'abs', 'body weight'],
  ['Mountain Climber', 'waist', 'abs', 'body weight'],
  ['Side Plank', 'waist', 'obliques', 'body weight'],
  ['Bird Dog', 'waist', 'spinal erectors', 'body weight'],
  ['Brisk Walk', 'cardio', 'cardiovascular system', 'body weight'],
  ['Jumping Jacks', 'cardio', 'cardiovascular system', 'body weight'],
  ['High Knees', 'cardio', 'cardiovascular system', 'body weight'],
  ['Burpee', 'cardio', 'cardiovascular system', 'body weight'],
  ['Skater Hops', 'cardio', 'cardiovascular system', 'body weight'],
  ['Shadow Boxing', 'cardio', 'cardiovascular system', 'body weight'],
  ['Step-ups', 'cardio', 'cardiovascular system', 'body weight'],
  ['Easy March in Place', 'cardio', 'cardiovascular system', 'body weight'],
  ['Standing Hamstring Stretch', 'upper legs', 'hamstrings', 'body weight'],
  ['Thread the Needle Stretch', 'back', 'upper back', 'body weight'],
  ['Cat-Cow Stretch', 'waist', 'spine', 'body weight'],
  ['Hip Flexor Stretch', 'upper legs', 'hip flexors', 'body weight'],
  ["Child's Pose", 'back', 'lats', 'body weight'],
].map(([name, body_part, target, equipment], i) => ({
  id: `local-${i}`,
  name,
  body_part,
  target,
  equipment,
  secondary_muscles: [],
  instructions: '',
  gif_url: null,
  image: null,
  _builtin: true,
}));

let dataset = null; // loaded public dataset
let warming = null;

const readDiskCache = () => {
  try {
    const stat = fs.statSync(CACHE_FILE);
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (Array.isArray(data) && data.length > 100) {
      return { data, fresh: Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS };
    }
  } catch (e) {
    /* no cache yet */
  }
  return null;
};

const prewarm = () => {
  if (dataset && dataset.length) return Promise.resolve();
  if (warming) return warming;

  const cached = readDiskCache();
  if (cached) dataset = cached.data;
  if (cached && cached.fresh) return Promise.resolve();

  warming = axios
    .get(DATASET_URL, { timeout: 20000 })
    .then(res => {
      if (Array.isArray(res.data) && res.data.length > 100) {
        dataset = res.data;
        try {
          fs.writeFileSync(CACHE_FILE, JSON.stringify(res.data));
        } catch (e) {
          /* cache is optional */
        }
        logger.info(`Exercise library loaded (${dataset.length} exercises)`);
      }
    })
    .catch(err => {
      logger.warn(`Exercise dataset unavailable, using built-in library: ${err.message}`);
    })
    .finally(() => {
      warming = null;
    });
  return warming;
};

const instructionsOf = e => {
  const instr = e.instructions;
  if (!instr) return '';
  if (typeof instr === 'string') return instr;
  if (Array.isArray(instr)) return instr.join(' ');
  return instr.en || instr.tr || Object.values(instr)[0] || '';
};

const normalise = e => ({
  id: String(e.id ?? e.name),
  name: e.name || '',
  body_part: (e.body_part || '').toLowerCase(),
  target: e.target || '',
  equipment: (e.equipment || 'body weight').toLowerCase(),
  secondary_muscles: e.secondary_muscles || [],
  instructions: instructionsOf(e),
  gif_url: e.gif_url || null,
  image: e.image || null,
});

/** Synchronous and instant. Dataset exercises when available, else the built-in library. */
let normalisedFor = null;
let normalisedPool = null;
const getExercisePool = () => {
  const source = dataset && dataset.length ? dataset : BUILTIN;
  if (normalisedFor !== source) {
    normalisedPool = source.map(normalise);
    normalisedFor = source;
  }
  return normalisedPool;
};

module.exports = { getExercisePool, prewarm, BUILTIN_COUNT: BUILTIN.length };
