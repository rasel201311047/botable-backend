# Test Form-Data Workout Creation

## How to Send Form-Data in Postman

### Method: POST
### URL: `http://localhost:5000/api/admin/workouts`

### Headers:
```
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: multipart/form-data
```

### Body (form-data):
```
Key: title, Value: System Strength Workout
Key: description, Value: Full body strength training
Key: durationMinutes, Value: 60
Key: category, Value: strength
Key: intensity, Value: high
Key: exercises, Value: [{"name": "Squats", "sets": 4, "reps": 8, "rest": 90}]
Key: equipment, Value: ["barbell"]
Key: tags, Value: ["full body", "strength"]
Key: image, Value: [Select file] (optional - can be named anything, e.g., 'workoutImage', 'file', etc.)
```

## Alternative: Send as JSON Strings

If your client sends arrays/objects as JSON strings:

```
Key: exercises, Value: "[{\"name\": \"Squats\", \"sets\": 4, \"reps\": 8, \"rest\": 90}]"
Key: equipment, Value: "[\"barbell\"]"
Key: tags, Value: "[\"full body\", \"strength\"]"
```

## Expected Response:
```json
{
  "status": "success",
  "message": "Workout created successfully",
  "data": {
    "_id": "...",
    "title": "System Strength Workout",
    "userId": null,
    "isPublic": true,
    "isActive": true,
    "imageUrl": "/uploads/workouts/workout-1234567890.jpg", // if image uploaded
    // ... other fields
  }
}
```

## Troubleshooting:

1. **"Request body is required"** - Make sure you're sending form-data, not raw JSON
2. **"Title is required"** - Check that the 'title' field is included
3. **"Duration in minutes is required"** - Check that 'durationMinutes' is a number
4. **File upload issues** - Make sure the image field is named 'image'

The controller now properly handles both:
- ✅ Raw JSON requests (for API clients)
- ✅ Form-data requests (for Postman/file uploads)