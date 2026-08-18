const { OpenAI } = require('openai');
const logger = require('../utils/logger');

if (!process.env.OPENAI_API_KEY) {
  logger.warn('OPENAI_API_KEY is not set. AI features will use rule-based fallbacks.');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate AI response for fitness coaching
 * @param {string} prompt - The user's message
 * @param {Object} context - User context information
 * @returns {Promise<string>} AI response
 */
const generateAIResponse = async (prompt, context = {}) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const systemPrompt = `You are a knowledgeable fitness coach specializing in shift work optimization. 
    The user is a shift worker with the following context:
    - Shift type: ${context.shiftType || 'Not specified'}
    - Fitness goal: ${context.goalType || 'Not specified'}
    - Experience level: ${context.experienceLevel || 'Beginner'}
    
    Provide helpful, evidence-based advice. Be encouraging but realistic.
    Focus on practical solutions for shift workers.
    Keep responses concise and actionable.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    logger.error(`OpenAI API error: ${error.message}`);
    throw new Error(`AI service unavailable: ${error.message}`);
  }
};

/**
 * Generate personalized workout plan
 * @param {Object} userProfile - User profile information
 * @returns {Promise<Object>} Workout plan
 */
const generateWorkoutPlanAI = async (userProfile) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const prompt = `Create a detailed workout plan for a shift worker with the following profile:
    - Age: ${userProfile.age || 'Not specified'}
    - Gender: ${userProfile.gender || 'Not specified'}
    - Shift type: ${userProfile.shiftType}
    - Fitness goal: ${userProfile.goalType}
    - Experience level: ${userProfile.experienceLevel || 'Beginner'}
    - Available time per session: ${userProfile.timeAvailable || '30-45 minutes'}
    - Equipment available: ${userProfile.equipment || 'Basic home equipment'}
    
    Provide a weekly schedule with specific exercises, sets, reps, and rest periods.
    Include shift-specific considerations.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an expert fitness coach creating personalized workout plans for shift workers." },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    // Parse the response into structured format
    return parseWorkoutPlanResponse(completion.choices[0].message.content);
  } catch (error) {
    logger.error(`OpenAI workout plan error: ${error.message}`);
    throw new Error(`Failed to generate workout plan: ${error.message}`);
  }
};

/**
 * Generate nutrition recommendations
 * @param {Object} userProfile - User profile
 * @param {Object} nutritionData - Current nutrition data
 * @returns {Promise<Object>} Nutrition recommendations
 */
const generateNutritionAdviceAI = async (userProfile, nutritionData) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const prompt = `Provide nutrition advice for a shift worker with:
    - Shift type: ${userProfile.shiftType}
    - Goal: ${userProfile.goalType}
    - Current daily intake: ${JSON.stringify(nutritionData)}
    - Dietary restrictions: ${userProfile.dietaryRestrictions || 'None'}
    
    Focus on practical meal timing, food choices, and hydration strategies for shift work.
    Include specific food recommendations.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a nutritionist specializing in shift work nutrition and fitness goals." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    return parseNutritionAdviceResponse(completion.choices[0].message.content);
  } catch (error) {
    logger.error(`OpenAI nutrition advice error: ${error.message}`);
    throw new Error(`Failed to generate nutrition advice: ${error.message}`);
  }
};

/**
 * Parse workout plan response
 */
const parseWorkoutPlanResponse = (response) => {
  // This is a simplified parser
  // In production, you would implement more sophisticated parsing
  
  const lines = response.split('\n');
  const plan = {
    title: 'AI-Generated Workout Plan',
    description: '',
    weeklySchedule: [],
    exercises: [],
    tips: []
  };

  let currentSection = '';
  
  lines.forEach(line => {
    line = line.trim();
    
    if (line.includes('**') || line.includes('Day') || line.includes('Monday')) {
      currentSection = 'schedule';
    } else if (line.includes('Exercise') || line.includes('Sets')) {
      currentSection = 'exercises';
    } else if (line.includes('Tip') || line.includes('Note')) {
      currentSection = 'tips';
    }
    
    if (line && currentSection === 'schedule') {
      plan.weeklySchedule.push(line);
    } else if (line && currentSection === 'exercises') {
      plan.exercises.push(line);
    } else if (line && currentSection === 'tips') {
      plan.tips.push(line);
    } else if (line && !plan.description) {
      plan.description = line;
    }
  });

  return plan;
};

/**
 * Parse nutrition advice response
 */
const parseNutritionAdviceResponse = (response) => {
  const lines = response.split('\n');
  const advice = {
    mealTiming: [],
    foodRecommendations: [],
    hydrationTips: [],
    shiftSpecificAdvice: [],
    sampleMealPlan: []
  };

  let currentSection = '';
  
  lines.forEach(line => {
    line = line.trim().toLowerCase();
    
    if (line.includes('meal timing') || line.includes('when to eat')) {
      currentSection = 'mealTiming';
    } else if (line.includes('food') || line.includes('eat')) {
      currentSection = 'foodRecommendations';
    } else if (line.includes('water') || line.includes('hydrat')) {
      currentSection = 'hydrationTips';
    } else if (line.includes('shift') || line.includes('work')) {
      currentSection = 'shiftSpecificAdvice';
    } else if (line.includes('sample') || line.includes('meal plan')) {
      currentSection = 'sampleMealPlan';
    }
    
    if (line && currentSection && advice[currentSection]) {
      advice[currentSection].push(line);
    }
  });

  return advice;
};

module.exports = {
  openai,
  generateAIResponse,
  generateWorkoutPlanAI,
  generateNutritionAdviceAI
};