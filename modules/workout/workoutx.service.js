const axios = require('axios');
const logger = require('../../utils/logger');
const WellnessEngine = require('../engine/wellnessEngine.service');

// High-performance in-memory cache to respect rate limits & quota
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

function clearCache() {
  cache.clear();
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
   * Normalize user gender to 'male' or 'female'
   */
  normalizeGender(gender) {
    if (!gender) return 'male';
    const g = String(gender).toLowerCase().trim();
    return g === 'female' ? 'female' : 'male';
  }

  /**
   * Maps WorkoutX exercise object to app workout model
   */
  mapExercise(exercise, isRecommended = false, recommendationReason = null) {
    if (!exercise) return null;

    let intensity = 'medium';
    if (exercise.difficulty === 'beginner') intensity = 'low';
    if (exercise.difficulty === 'advanced') intensity = 'high';

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
   * Fetches exercises library strictly filtered by user's profile gender
   */
  async getLibraryExercises({ limit = 20, offset = 0, search = '', gender = 'male', bodyPart = '' } = {}) {
    const userModel = this.normalizeGender(gender);
    const cacheKey = `lib_${limit}_${offset}_${search}_${userModel}_${bodyPart}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      params.append('limit', String(Math.min(limit, 50)));
      params.append('offset', String(offset));
      // Always enforce the user's gender model
      params.append('model', userModel);

      if (search && search.trim()) {
        params.append('name', search.trim());
      }
      if (bodyPart && bodyPart.trim()) {
        params.append('bodyPart', bodyPart.trim());
      }

      const url = `${this.baseUrl}/exercises?${params.toString()}`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: this.timeout,
      });

      const total = response.data?.total || 0;
      const rawResults = response.data?.results || [];

      // Guarantee strict gender model match
      const results = rawResults.filter(item => item.model === userModel);
      const mapped = results.map(item => this.mapExercise(item));

      const result = {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        results: mapped,
        hasMore: offset + rawResults.length < total,
      };

      // Cache for 6 hours
      setCached(cacheKey, result, 6 * 60 * 60 * 1000);
      return result;
    } catch (error) {
      logger.error(`WorkoutX getLibraryExercises error: ${error.response?.data?.message || error.message}`);
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
   * Get single exercise by ID with strict gender model resolution
   */
  async getExerciseById(id, targetGender = null) {
    if (!id) return null;

    const normalizedGender = this.normalizeGender(targetGender);
    const cacheKey = `ex_v2_${id}_${normalizedGender}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/exercises/${id}`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: this.timeout,
      });

      let exercise = response.data;

      // Strict Gender Resolution: If the exercise model does not match the user's gender
      if (exercise.model && exercise.model !== normalizedGender) {
        let matched = false;

        // 1. Try counterpartId
        if (exercise.counterpartId) {
          try {
            const counterpartUrl = `${this.baseUrl}/exercises/${exercise.counterpartId}`;
            const counterpartRes = await axios.get(counterpartUrl, {
              headers: this.getHeaders(),
              timeout: this.timeout,
            });
            if (counterpartRes.data && counterpartRes.data.model === normalizedGender && counterpartRes.data.media) {
              exercise = counterpartRes.data;
              matched = true;
            }
          } catch (cpErr) {
            logger.warn(`Could not fetch counterpart ${exercise.counterpartId}: ${cpErr.message}`);
          }
        }

        // 2. If no counterpart or counterpart failed, search by name with the user's gender
        if (!matched && exercise.name) {
          try {
            const nameSearchUrl = `${this.baseUrl}/exercises?name=${encodeURIComponent(exercise.name)}&model=${normalizedGender}&limit=1`;
            const nameSearchRes = await axios.get(nameSearchUrl, {
              headers: this.getHeaders(),
              timeout: this.timeout,
            });
            if (nameSearchRes.data?.results?.length > 0) {
              const candidate = nameSearchRes.data.results[0];
              if (candidate.model === normalizedGender) {
                exercise = candidate;
                matched = true;
              }
            }
          } catch (nsErr) {
            logger.warn(`Could not search name for gender counterpart: ${nsErr.message}`);
          }
        }

        // 3. If still not matched, find equivalent exercise with same bodyPart and target gender
        if (!matched && (exercise.bodyPart || exercise.target)) {
          try {
            const filterKey = exercise.bodyPart ? `bodyPart=${encodeURIComponent(exercise.bodyPart)}` : `target=${encodeURIComponent(exercise.target)}`;
            const fallbackUrl = `${this.baseUrl}/exercises?${filterKey}&model=${normalizedGender}&limit=5`;
            const fallbackRes = await axios.get(fallbackUrl, {
              headers: this.getHeaders(),
              timeout: this.timeout,
            });
            const validCandidates = (fallbackRes.data?.results || []).filter(item => item.model === normalizedGender);
            if (validCandidates.length > 0) {
              exercise = validCandidates[0];
              matched = true;
            }
          } catch (fbErr) {
            logger.warn(`Could not search bodyPart fallback for gender: ${fbErr.message}`);
          }
        }

        // 4. Absolute fallback: Any exercise of the user's gender
        if (!matched) {
          try {
            const anyUrl = `${this.baseUrl}/exercises?model=${normalizedGender}&limit=1`;
            const anyRes = await axios.get(anyUrl, {
              headers: this.getHeaders(),
              timeout: this.timeout,
            });
            const valid = (anyRes.data?.results || []).filter(item => item.model === normalizedGender);
            if (valid.length > 0) {
              exercise = valid[0];
              matched = true;
            }
          } catch (anyErr) {
            logger.warn(`Could not fallback to model: ${anyErr.message}`);
          }
        }
      }

      const mapped = this.mapExercise(exercise);
      setCached(cacheKey, mapped, 12 * 60 * 60 * 1000);
      return mapped;
    } catch (error) {
      logger.error(`WorkoutX getExerciseById error for ${id}: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  /**
   * Generates 2 recommended exercises for today strictly matching user's profile gender & health condition
   */
  async getRecommendedForUser(user) {
    if (!user) return [];

    const userGender = this.normalizeGender(user.gender);
    const todayStr = new Date().toISOString().slice(0, 10);
    const userId = user._id || user.id;
    const cacheKey = `rec_v2_${userId}_${userGender}_${todayStr}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const goal = user.goalType || 'maintenance';

    let conditionReason = '';
    let targetBodyPart = 'Cardio';

    try {
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
      // Fetch exercises with model STRICTLY set to userGender
      const params = new URLSearchParams();
      params.append('model', userGender);
      params.append('bodyPart', targetBodyPart);
      params.append('limit', '20');

      const url = `${this.baseUrl}/exercises?${params.toString()}`;
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: this.timeout,
      });

      let candidates = (response.data?.results || []).filter(item => item.model === userGender);

      // Fallback: If no exercises found for this specific bodyPart with this gender, query just the gender
      if (candidates.length < 2) {
        const fallbackParams = new URLSearchParams({ model: userGender, limit: '20' });
        const fallbackRes = await axios.get(`${this.baseUrl}/exercises?${fallbackParams.toString()}`, {
          headers: this.getHeaders(),
          timeout: this.timeout,
        });
        candidates = (fallbackRes.data?.results || []).filter(item => item.model === userGender);
      }

      // Pick exactly 2 exercises deterministically for today
      const dayOfYear = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
      );
      const idx1 = dayOfYear % Math.max(1, candidates.length);
      const idx2 = (dayOfYear + 1) % Math.max(1, candidates.length);

      const rec1 = candidates[idx1] || candidates[0];
      const rec2 = candidates[idx2] && candidates[idx2].id !== rec1?.id ? candidates[idx2] : candidates[1] || rec1;

      const validCandidates = [rec1, rec2].filter(Boolean).filter(item => item.model === userGender);
      const recommendations = validCandidates.map(item => this.mapExercise(item, true, conditionReason));

      // Cache until tomorrow
      setCached(cacheKey, recommendations, 12 * 60 * 60 * 1000);
      return recommendations;
    } catch (err) {
      logger.error(`WorkoutX getRecommendedForUser error: ${err.response?.data?.message || err.message}`);
      return [];
    }
  }

  clearCache() {
    clearCache();
  }
}

module.exports = new WorkoutXService();
