const axios = require('axios');
const logger = require('../../utils/logger');
const WellnessEngine = require('../engine/wellnessEngine.service');

// Simple, high-performance in-memory cache to respect rate limits & quota
const cache = new Map();

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

class WorkoutXService {
  constructor() {
    this.baseUrl = 'https://api.workoutxapp.com/v2';
    this.timeout = 8000; // 8s timeout
  }

  getApiKey() {
    const rawKey = process.env.WORKOUTXAPP_API_KEY || '';
    if (!rawKey) {
      logger.warn('WORKOUTXAPP_API_KEY is not set in environment.');
      return '';
    }
    return rawKey.startsWith('wx_') ? rawKey : `wx_${rawKey}`;
  }

  getHeaders() {
    return {
      'X-WorkoutX-Key': this.getApiKey(),
      Accept: 'application/json',
    };
  }

  /**
   * Maps WorkoutX exercise object to app workout model
   */
  mapExercise(exercise, isRecommended = false, recommendationReason = null) {
    if (!exercise) return null;

    // Intensity mapping from difficulty
    let intensity = 'medium';
    if (exercise.difficulty === 'beginner') intensity = 'low';
    if (exercise.difficulty === 'advanced') intensity = 'high';

    // Category mapping
    let category = 'custom';
    const cat = (exercise.category || '').toLowerCase();
    const bp = (exercise.bodyPart || '').toLowerCase();
    if (cat.includes('strength') || bp.includes('chest') || bp.includes('back') || bp.includes('upper legs')) {
      category = 'strength';
    } else if (cat.includes('cardio') || bp.includes('cardio')) {
      category = 'cardio';
    } else if (cat.includes('plyo') || cat.includes('hiit')) {
      category = 'hiit';
    } else if (cat.includes('stretch') || cat.includes('recovery')) {
      category = 'recovery';
    }

    // Default duration estimation: ~15 to 25 mins
    const durationMinutes = exercise.difficulty === 'advanced' ? 25 : exercise.difficulty === 'intermediate' ? 20 : 15;

    const posterUrl = exercise.media?.poster || '';
    const animationUrl = exercise.media?.mp4 || '';

    const instructions = Array.isArray(exercise.instructions) ? exercise.instructions : [];
    const tips = Array.isArray(exercise.tips) ? exercise.tips : [];

    return {
      _id: exercise.id,
      id: exercise.id,
      title: exercise.name,
      name: exercise.name,
      description: exercise.description || instructions.join(' '),
      durationMinutes,
      category,
      intensity,
      imageUrl: posterUrl,
      posterUrl,
      videoUrl: animationUrl,
      animationUrl,
      model: exercise.model || 'male',
      counterpartId: exercise.counterpartId || null,
      equipment: exercise.equipment ? [exercise.equipment] : ['bodyweight'],
      bodyPart: exercise.bodyPart || 'Full Body',
      target: exercise.target || '',
      caloriesPerMinute: exercise.caloriesPerMinute || 6,
      exercises: [
        {
          name: exercise.name,
          sets: parseInt(exercise.recommendedSets) || 3,
          reps: parseInt(exercise.recommendedReps) || 12,
          instructions,
          tips,
        },
      ],
      instructions,
      tips,
      recommended: isRecommended,
      recommendationReason: recommendationReason || null,
    };
  }

  /**
   * Fetches exercises library with pagination, gender model, and optional search
   */
  async getLibraryExercises({ limit = 20, offset = 0, search = '', gender = 'male', bodyPart = '' } = {}) {
    const userModel = gender === 'female' ? 'female' : 'male';
    const cacheKey = `lib_${limit}_${offset}_${search}_${userModel}_${bodyPart}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      params.append('limit', String(Math.min(limit, 50)));
      params.append('offset', String(offset));

      // Note: Free plan supports one primary filter at a time (model or name or bodyPart)
      if (search && search.trim()) {
        params.append('name', search.trim());
      } else if (bodyPart && bodyPart.trim()) {
        params.append('bodyPart', bodyPart.trim());
      } else {
        params.append('model', userModel);
      }

      const url = `${this.baseUrl}/exercises?${params.toString()}`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: this.timeout,
      });

      const total = response.data?.total || 0;
      const results = response.data?.results || [];

      // If results returned a model different from user requested and counterpart is available, we map cleanly
      const mapped = results.map(item => this.mapExercise(item));

      const result = {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        results: mapped,
        hasMore: offset + results.length < total,
      };

      // Cache for 6 hours
      setCached(cacheKey, result, 6 * 60 * 60 * 1000);
      return result;
    } catch (error) {
      logger.error(`WorkoutX getLibraryExercises error: ${error.response?.data?.message || error.message}`);
      // Fallback empty result so UI doesn't crash
      return {
        total: 0,
        limit,
        offset,
        results: [],
        hasMore: false,
      };
    }
  }

  /**
   * Get single exercise by ID with gender counterpart resolution
   */
  async getExerciseById(id, targetGender = null) {
    if (!id) return null;

    const cacheKey = `ex_${id}_${targetGender || 'any'}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/exercises/${id}`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: this.timeout,
      });

      let exercise = response.data;

      // Gender Counterpart Resolution
      // If user is female and exercise is male, check counterpartId
      if (targetGender) {
        const normalizedGender = targetGender.toLowerCase();
        if (exercise.model && exercise.model !== normalizedGender && exercise.counterpartId) {
          try {
            const counterpartUrl = `${this.baseUrl}/exercises/${exercise.counterpartId}`;
            const counterpartRes = await axios.get(counterpartUrl, {
              headers: this.getHeaders(),
              timeout: this.timeout,
            });
            if (counterpartRes.data && counterpartRes.data.media) {
              exercise = counterpartRes.data;
            }
          } catch (cpErr) {
            logger.warn(`Could not fetch counterpart ${exercise.counterpartId}: ${cpErr.message}`);
          }
        }
      }

      const mapped = this.mapExercise(exercise);
      // Cache for 12 hours
      setCached(cacheKey, mapped, 12 * 60 * 60 * 1000);
      return mapped;
    } catch (error) {
      logger.error(`WorkoutX getExerciseById error for ${id}: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  /**
   * Generates 2 recommended exercises for today based on user's current health/body condition & goal
   */
  async getRecommendedForUser(user) {
    if (!user) return [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const userId = user._id || user.id;
    const cacheKey = `rec_${userId}_${todayStr}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const userGender = user.gender === 'female' ? 'female' : 'male';
    const goal = user.goalType || 'maintenance';

    let conditionReason = '';
    let targetBodyPart = 'Cardio';

    try {
      // Build context from WellnessEngine
      const context = await WellnessEngine.buildContext(userId);
      const readiness = context.scores?.readiness ?? 80;
      const sleepScore = context.scores?.sleep ?? 80;
      const recoveryScore = context.scores?.recovery ?? 80;

      // 1. Health Condition Check: High fatigue / low recovery
      if (readiness < 50 || sleepScore < 60 || recoveryScore < 50) {
        targetBodyPart = 'Waist';
        conditionReason = 'Active recovery & core: tailored to your low sleep/recovery score today';
      }
      // 2. Goal Check
      else if (goal === 'fat_loss') {
        targetBodyPart = 'Cardio';
        conditionReason = 'Matches your fat loss goal with high calorie burn';
      } else if (goal === 'strength_building') {
        targetBodyPart = 'Chest';
        conditionReason = 'Matches your muscle & strength building goal';
      } else {
        targetBodyPart = 'Upper Legs';
        conditionReason = 'Balanced functional fitness for daily energy';
      }
    } catch (ctxErr) {
      logger.warn(`Could not build wellness context for user ${userId}: ${ctxErr.message}`);
      if (goal === 'fat_loss') {
        targetBodyPart = 'Cardio';
        conditionReason = 'Matches your fat loss goal with high calorie burn';
      } else if (goal === 'strength_building') {
        targetBodyPart = 'Chest';
        conditionReason = 'Matches your muscle & strength building goal';
      } else {
        targetBodyPart = 'Waist';
        conditionReason = 'Core conditioning for daily energy';
      }
    }

    try {
      // Fetch exercises for the target body part
      const params = new URLSearchParams();
      params.append('bodyPart', targetBodyPart);
      params.append('limit', '10');

      const url = `${this.baseUrl}/exercises?${params.toString()}`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: this.timeout,
      });

      let candidates = response.data?.results || [];

      // Filter or resolve for user gender
      if (candidates.length > 0) {
        // If candidate model does not match user gender, attempt counterpart if available
        candidates = await Promise.all(
          candidates.slice(0, 4).map(async item => {
            if (item.model !== userGender && item.counterpartId) {
              try {
                const cpRes = await axios.get(`${this.baseUrl}/exercises/${item.counterpartId}`, {
                  headers: this.getHeaders(),
                  timeout: 4000,
                });
                if (cpRes.data) return cpRes.data;
              } catch (e) {}
            }
            return item;
          })
        );
      }

      // Pick exactly 2 exercises deterministically for today
      // Generate daily offset index based on day of year
      const dayOfYear = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
      );
      const idx1 = dayOfYear % Math.max(1, candidates.length);
      const idx2 = (dayOfYear + 1) % Math.max(1, candidates.length);

      const rec1 = candidates[idx1] || candidates[0];
      const rec2 = candidates[idx2] && candidates[idx2].id !== rec1?.id ? candidates[idx2] : candidates[1] || rec1;

      const recommendations = [
        this.mapExercise(rec1, true, conditionReason),
        this.mapExercise(rec2, true, conditionReason),
      ].filter(Boolean);

      // Cache until tomorrow
      setCached(cacheKey, recommendations, 12 * 60 * 60 * 1000);
      return recommendations;
    } catch (err) {
      logger.error(`WorkoutX getRecommendedForUser error: ${err.response?.data?.message || err.message}`);
      return [];
    }
  }
}

module.exports = new WorkoutXService();
