# AI Fitness Coach Chat System - Documentation

## Overview

A dynamic AI-powered fitness coach chat system built with OpenAI GPT-3.5-turbo that provides personalized
health and fitness guidance based on real-time user data.

## Features

### ✅ Implemented Features

1. **Dynamic Context-Aware Responses**: AI coach analyzes real-time user data including:
    - User profile (age, gender, height, weight, shift type, goal type)
    - Today's nutrition summary and targets
    - Today's sleep logs with quality metrics
    - Today's workout logs
    - Calculated sleep, recovery, and readiness scores

2. **Fitness-Only Responses**: Smart filtering ensures AI only responds to fitness and health-related queries

3. **Chat History**: Stores and retrieves conversation history (last 20 messages)

4. **Persistent Storage**: All conversations saved to MongoDB with 30-day TTL

5. **Premium Feature**: Requires active subscription to access

## API Endpoints

### 1. Chat with AI Coach

**POST** `/api/ai/chat`

Send a message to the AI fitness coach and receive personalized advice.

**Authentication**: Required (Bearer Token)  
**Subscription**: Premium required

**Request Body**:

```json
{
    "message": "What should I eat before my workout today?",
    "context": {}
}
```

**Success Response** (200):

```json
{
    "status": "success",
    "data": {
        "response": "Based on your nutrition data today, you've consumed 1800 calories with 120g protein. Before your workout, I recommend...",
        "metadata": {
            "sleepScore": 75,
            "recoveryScore": 68,
            "readinessScore": 72
        }
    }
}
```

**Error Responses**:

- `400`: Message is required
- `401`: Unauthorized (no or invalid token)
- `403`: Premium subscription required
- `500`: OpenAI API key not configured or other server error

### 2. Get Chat History

**GET** `/api/ai/history`

Retrieve your conversation history with the AI coach.

**Authentication**: Required (Bearer Token)

**Query Parameters**:

- `limit` (optional): Number of messages to retrieve (default: 20, max: 100)

**Example**:

```
GET /api/ai/history?limit=20
```

**Success Response** (200):

```json
{
    "status": "success",
    "data": {
        "count": 12,
        "history": [
            {
                "_id": "65f8a9b1c2d3e4f5g6h7i8j9",
                "userId": "65f8a9b1c2d3e4f5g6h7i8j8",
                "role": "user",
                "message": "How should I adjust my workout for my night shift?",
                "createdAt": "2026-02-14T10:30:00.000Z"
            },
            {
                "_id": "65f8a9b1c2d3e4f5g6h7i8j0",
                "userId": "65f8a9b1c2d3e4f5g6h7i8j8",
                "role": "assistant",
                "message": "For night shift workers, timing your workout is crucial...",
                "createdAt": "2026-02-14T10:30:05.000Z"
            }
        ]
    }
}
```

## Database Schema

### AIChat Model

```javascript
{
  userId: ObjectId,        // Reference to User
  role: String,            // "user" or "assistant"
  message: String,         // Chat message content
  createdAt: Date         // Timestamp (auto-indexed, 30-day TTL)
}
```

**Indexes**:

- `userId + createdAt`: For efficient chat history retrieval
- `createdAt`: TTL index (30 days automatic cleanup)

## Key Components

### 1. aiChat.model.js

MongoDB model for storing chat messages with automatic cleanup after 30 days.

### 2. ai.service.js - Updated Methods

#### `chatWithAI(userId, message, context)`

Main chat function that:

1. Validates user and premium subscription
2. Checks if message is fitness-related
3. Loads all user data (nutrition, sleep, workouts)
4. Calculates health scores
5. Builds dynamic system prompt
6. Calls OpenAI API with conversation history
7. Saves user and assistant messages
8. Returns AI response with metadata

#### `isFitnessRelated(message)`

Validates if user's message is related to fitness, health, nutrition, sleep, or wellness topics.

**Fitness Keywords Detected**:

- Workout, exercise, fitness, training, gym, cardio, strength
- Nutrition, diet, meal, food, protein, carbs, calories
- Sleep, rest, recovery, energy, fatigue
- Health, wellness, body, muscle, weight
- Shift work, schedule, night shift

#### `buildSystemPrompt(data)`

Creates a comprehensive system prompt including:

- User profile details
- Current date
- Sleep, recovery, and readiness scores
- Today's nutrition progress vs targets
- Sleep log details
- Workout logs summary
- Role instructions for the AI coach

#### `getChatHistory(userId, limit)`

Retrieves user's conversation history in chronological order.

### 3. ai.controller.js - Updated Methods

#### `chatWithAI(req, res, next)`

Controller for POST /api/ai/chat endpoint.

#### `getChatHistory(req, res, next)`

Controller for GET /api/ai/history endpoint.

### 4. ai.routes.js

Added route: `GET /api/ai/history`

## Usage Examples

### Example 1: Basic Workout Question

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Should I workout today? I only slept 5 hours."
  }'
```

**AI Response**:

> "Your sleep score is 50/100 (Fair) and recovery score is 45/100 (Poor). With only 5 hours of sleep, I
> recommend a light activity today such as a 20-minute walk or gentle stretching instead of an intense
> workout. Your body needs recovery to perform optimally."

### Example 2: Nutrition Question

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need help hitting my protein target"
  }'
```

**AI Response**:

> "You're at 80g/150g protein today (53%). To reach your target, you need 70g more. Here are some high-protein
> options: 1) Grilled chicken breast (200g = 60g protein), 2) Greek yogurt (1 cup = 20g protein), 3) Protein
> shake (30g protein). Try adding one to your next meal!"

### Example 3: Non-Fitness Question (Rejected)

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the weather today?"
  }'
```

**AI Response**:

> "I'm a fitness and health coach. I can only help with topics related to fitness, nutrition, sleep, recovery,
> workouts, and overall health. Please ask me something related to your fitness journey!"

### Example 4: Get Chat History

```bash
curl -X GET "http://localhost:3000/api/ai/history?limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Configuration

### Environment Variables Required

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### OpenAI Model Used

- **Model**: `gpt-3.5-turbo`
- **Temperature**: `0.7` (balanced creativity and consistency)
- **Max Tokens**: `500` (concise responses)

## Data Flow

```
User Message
    ↓
Premium Check
    ↓
Fitness Topic Check
    ↓
Load User Data (Profile, Nutrition, Sleep, Workouts)
    ↓
Calculate Scores (Sleep, Recovery, Readiness)
    ↓
Build Dynamic System Prompt
    ↓
Load Recent Chat History (10 messages)
    ↓
Call OpenAI API
    ↓
Save User & Assistant Messages
    ↓
Return Response + Metadata
```

## Benefits

1. **Personalized Advice**: AI considers your actual data, not generic advice
2. **Shift Work Optimized**: Understands unique challenges of shift workers
3. **Real-Time Context**: Uses today's nutrition, sleep, and workout data
4. **Score-Based Guidance**: Incorporates calculated health scores
5. **Conversation Memory**: Maintains context across multiple messages
6. **Safety**: Only responds to fitness/health topics
7. **Automatic Cleanup**: Old chats automatically deleted after 30 days

## Testing Recommendations

### Test Cases

1. ✅ Send fitness-related questions
2. ✅ Send non-fitness questions (should be rejected)
3. ✅ Test with logged nutrition data
4. ✅ Test with logged sleep data
5. ✅ Test with logged workout data
6. ✅ Test without any logged data
7. ✅ Test chat history retrieval
8. ✅ Test without premium subscription (should fail)

### Sample Test Data

Create test data for comprehensive AI responses:

```javascript
// Nutrition
POST /api/nutrition/meals
{ "name": "Chicken Breast", "calories": 300, "protein": 60, ... }

// Sleep
POST /api/sleep-recovery/sleep
{ "durationMinutes": 420, "quality": "good", ... }

// Workout
POST /api/workouts/log
{ "workoutId": "...", "completed": true, "intensity": "high", ... }

// Then test AI chat
POST /api/ai/chat
{ "message": "Should I do cardio or strength training today?" }
```

## Error Handling

The system handles:

- Missing OpenAI API key
- Invalid or expired JWT tokens
- Non-premium users attempting access
- Non-fitness related queries
- OpenAI API failures
- Database connection issues
- Missing user data gracefully

## Performance Considerations

- **Chat History Limit**: Default 10 messages sent to OpenAI (balances context and tokens)
- **Database Indexes**: Optimized for fast chat retrieval
- **TTL Index**: Automatic cleanup prevents database bloat
- **Parallel Data Loading**: All user data loaded concurrently

## Security

- All endpoints require authentication
- Premium subscription verified before chat access
- User can only access their own chat history
- Messages sanitized before storage
- OpenAI API key stored securely in environment variables

## Future Enhancements

Potential improvements:

- Voice input/output
- Multi-language support
- Image analysis for meal logging
- Exercise form video analysis
- Integration with wearables
- Scheduled check-ins and reminders
- Goal tracking and progress reports

## Support

For issues or questions:

1. Check OpenAI API key is configured
2. Verify user has active premium subscription
3. Check database connection
4. Review error logs in `utils/logger.js`

## License

Part of Bootble API backend system.

---

**Last Updated**: February 14, 2026  
**Version**: 1.0.0  
**Author**: AI Development Team
