const axios = require('axios');

const USDA_API_KEY = process.env.USDA_API_KEY;
const USDA_API_URL = process.env.USDA_API_URL || 'https://api.nal.usda.gov/fdc/v1';

if (!USDA_API_KEY) {
  console.warn('USDA_API_KEY is not set. USDA food search will not work.');
}

const usdaClient = axios.create({
  baseURL: USDA_API_URL,
  timeout: 30000, // Increased from 10000ms to 30000ms for slower API responses
  headers: {
    'Content-Type': 'application/json'
  },
  params: {
    api_key: USDA_API_KEY
  }
});

/**
 * Search foods in USDA database
 * @param {string} query - Search query
 * @param {number} pageSize - Results per page
 * @param {number} pageNumber - Page number
 * @returns {Promise<Array>} Search results
 */
const searchFoods = async (query, pageSize = 20, pageNumber = 1) => {
  if (!USDA_API_KEY) {
    throw new Error('USDA API key not configured');
  }

  // Validate input parameters
  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  if (pageSize < 1 || pageSize > 100) {
    throw new Error('Page size must be between 1 and 100');
  }

  try {
    const response = await usdaClient.get('/foods/search', {
      params: {
        query: query.trim(),
        pageSize,
        pageNumber
      }
    });

    // Filter results to only include foods with nutrition data
    const foods = response.data.foods || [];
    
    // Prefer Foundation and SR Legacy foods as they have complete nutrition
    const filteredFoods = foods.filter(food => {
      const dataType = food.dataType || '';
      return dataType === 'Foundation' || 
             dataType === 'SR Legacy' || 
             dataType === 'Survey (FNDDS)';
    });

    // If filtered results are empty, return all foods (will be validated later)
    return filteredFoods.length > 0 ? filteredFoods : foods;
  } catch (error) {
    console.error('USDA search error:', error.message);
    if (error.response) {
      console.error('USDA API response status:', error.response.status);
      console.error('USDA API response data:', error.response.data);
    }
    throw new Error(`USDA search failed: ${error.message}`);
  }
};

/**
 * Get food details by FDC ID
 * @param {string} fdcId - USDA FDC ID
 * @returns {Promise<Object>} Food details
 */
const getFoodDetails = async (fdcId) => {
  if (!USDA_API_KEY) {
    throw new Error('USDA API key not configured');
  }

  try {
    const response = await usdaClient.get(`/food/${fdcId}`);
    return response.data;
  } catch (error) {
    console.error('USDA food details error:', error.message);
    throw new Error(`Failed to get food details: ${error.message}`);
  }
};

/**
 * Extract nutrition facts from USDA food data
 * According to official USDA FoodData Central API documentation
 * @param {Object} foodData - USDA food data
 * @returns {Object} Extracted nutrition facts
 */
const extractNutritionFacts = (foodData) => {
  const nutrients = foodData.foodNutrients || [];
  const servingSize = foodData.servingSize || 100;
  const servingUnit = foodData.servingSizeUnit || 'g';

  // Helper function to find nutrient - handles multiple USDA API response structures
  const findNutrient = (...nutrientIds) => {
    for (const id of nutrientIds) {
      // Try multiple possible structures from USDA API
      const nutrient = nutrients.find(n => 
        n.nutrientId === id || 
        n.nutrient?.id === id || 
        n.nutrient?.number === String(id) ||
        n.nutrientNumber === String(id)
      );
      
      if (nutrient) {
        return nutrient.amount || nutrient.value || 0;
      }
    }
    return 0;
  };

  // Extract nutrition using official USDA nutrient IDs
  // Multiple IDs provided for compatibility across different USDA data types
  const calories = findNutrient(1008, 208); // Energy (kcal)
  const protein = findNutrient(1003, 203); // Protein
  const carbs = findNutrient(1005, 205); // Carbohydrate, by difference
  const fat = findNutrient(1004, 204); // Total lipid (fat)
  const fiber = findNutrient(1079, 291); // Fiber, total dietary
  const sugar = findNutrient(2000, 269); // Sugars, total including NLEA

  const result = {
    fdcId: foodData.fdcId,
    name: foodData.description,
    brand: foodData.brandOwner || null,
    description: foodData.additionalDescriptions || foodData.description,
    servingSize,
    servingUnit,
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sugar: Math.round(sugar * 10) / 10,
    source: 'usda',
    isVerified: true,
    hasNutrition: calories > 0 || protein > 0 || carbs > 0 || fat > 0 // Flag for validation
  };

  return result;
};

module.exports = {
  searchFoods,
  getFoodDetails,
  extractNutritionFacts,
  usdaClient
};