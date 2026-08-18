# Workout File Upload Documentation

## Overview
This document explains how to upload image and video files when creating or updating custom workouts in the Bootble API.

## File Upload Support

### Supported File Types
- **Images**: JPEG, JPG, PNG, GIF
- **Videos**: MP4, AVI, MOV, WMV, FLV, MKV, WEBM

### File Size Limits
- **Images**: 50MB maximum
- **Videos**: 50MB maximum

## API Endpoints

### Create Workout with File Upload
- **Method**: POST
- **URL**: `/api/workouts`
- **Content-Type**: `multipart/form-data`

### Update Workout with File Upload
- **Method**: PUT
- **URL**: `/api/workouts/:id`
- **Content-Type**: `multipart/form-data`

## Request Format

### Form Data Fields

#### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| title | string | Workout title |
| durationMinutes | number | Workout duration in minutes |

#### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| description | string | Workout description |
| category | string | Workout category |
| intensity | string | Workout intensity level |
| exercises | array | List of exercises |
| equipment | array | Required equipment |
| tags | array | Workout tags |
| isPublic | boolean | Whether workout is public |

#### File Upload Fields
| Field | Type | Description |
|-------|------|-------------|
| image | file | Workout image file (optional) |
| video | file | Workout video file (optional) |

#### URL Fields (Alternative to file uploads)
| Field | Type | Description |
|-------|------|-------------|
| imageUrl | string | Direct image URL (if not uploading file) |
| videoUrl | string | Direct video URL (if not uploading file) |

## Example Usage

### Using Postman

1. **Set Method**: POST
2. **Set URL**: `{{base_url}}/api/workouts`
3. **Set Headers**:
   - `Authorization: Bearer {{auth_token}}`
4. **Set Body to form-data**:

| Key | Value/Type | Description |
|-----|------------|-------------|
| title | Full Body Workout | Workout title |
| description | Complete full body routine | Workout description |
| durationMinutes | 45 | Duration in minutes |
| category | strength | Workout category |
| intensity | intermediate | Intensity level |
| image | [Select File] | Choose image file |
| video | [Select File] | Choose video file (optional) |
| exercises | `[{"name": "Push-ups", "sets": 3, "reps": 15}]` | JSON string of exercises |
| equipment | `["dumbbells", "bench"]` | JSON string of equipment |
| tags | `["full-body", "strength"]` | JSON string of tags |
| isPublic | false | Public visibility |

### Using cURL

```bash
curl -X POST "{{base_url}}/api/workouts" \
  -H "Authorization: Bearer {{auth_token}}" \
  -F "title=Full Body Workout" \
  -F "description=Complete full body routine" \
  -F "durationMinutes=45" \
  -F "category=strength" \
  -F "intensity=intermediate" \
  -F "image=@/path/to/workout-image.jpg" \
  -F "video=@/path/to/workout-video.mp4" \
  -F "exercises=[{\"name\": \"Push-ups\", \"sets\": 3, \"reps\": 15}]" \
  -F "equipment=[\"dumbbells\", \"bench\"]" \
  -F "tags=[\"full-body\", \"strength\"]" \
  -F "isPublic=false"
```

## Response

### Success Response (201 Created)
```json
{
  "status": "success",
  "message": "Workout created successfully",
  "data": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "title": "Full Body Workout",
    "description": "Complete full body routine",
    "durationMinutes": 45,
    "category": "strength",
    "intensity": "intermediate",
    "imageUrl": "http://localhost:5000/uploads/workouts/workout-1643723400000-123456789.jpg",
    "videoUrl": "http://localhost:5000/uploads/workouts/workout-1643723400000-987654321.mp4",
    "exercises": [
      {
        "name": "Push-ups",
        "sets": 3,
        "reps": 15
      }
    ],
    "equipment": ["dumbbells", "bench"],
    "tags": ["full-body", "strength"],
    "isPublic": false,
    "createdBy": "64f1a2b3c4d5e6f7g8h9i0j1",
    "createdAt": "2023-02-01T12:30:00.000Z"
  }
}
```

## File Storage

### Upload Directory
- Files are stored in: `uploads/workouts/`
- Each file gets a unique filename with timestamp and random suffix
- Example: `workout-1643723400000-123456789.jpg`

### URL Generation
- **Development**: `http://localhost:5000/uploads/workouts/{filename}`
- **Production**: Uses CDN URL if configured, otherwise API URL

## Error Handling

### File Upload Errors
```json
{
  "status": "error",
  "message": "Only image (jpeg, jpg, png, gif) and video (mp4, avi, mov, wmv, flv, mkv, webm) files are allowed"
}
```

### File Size Limit Exceeded
```json
{
  "status": "error",
  "message": "File too large"
}
```

## Notes

1. **File Priority**: If both file upload and URL are provided, the uploaded file takes priority
2. **Validation**: Files are validated for type and size before processing
3. **Storage**: Files are stored locally in the `uploads/workouts/` directory
4. **Cleanup**: Old files are not automatically deleted when updating - consider implementing cleanup logic
5. **Security**: File uploads include basic security measures but consider additional validation for production use