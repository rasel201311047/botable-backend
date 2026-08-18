# Socket.IO Real-Time Testing Documentation

## Overview
This document provides comprehensive instructions for testing the Socket.IO real-time notification system using Postman. The system supports real-time notifications, reminders, announcements, and user activity tracking.

## Prerequisites
- Postman installed (version 10.0+ for WebSocket support)
- Server running on `http://localhost:3000` (or your configured URL)
- Valid JWT token for authentication
- User account with appropriate permissions

## Socket.IO Events

### Connection Events
- **connect**: Client connects to server
- **disconnect**: Client disconnects from server
- **error**: Connection/authentication errors

### User Events (Client → Server)
- **join_room**: Join a custom room
- **leave_room**: Leave a custom room
- **user_activity**: Send user activity data

### Server → Client Events
- **notification**: Real-time notifications sent to users
- **reminder**: Reminder notifications
- **announcement**: System-wide announcements
- **user_activity_update**: User activity updates (admin only)

## Postman Setup

### 1. Create New WebSocket Request
1. Open Postman
2. Click "New" → "WebSocket Request"
3. Enter WebSocket URL: `ws://localhost:3000/socket.io/?EIO=4&transport=websocket`
4. Add authentication headers

### 2. Authentication Setup
In the "Headers" tab, add:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

Or in the "Params" tab for query parameters:
```
token: YOUR_JWT_TOKEN
```

### 3. Connection Test
1. Click "Connect"
2. You should see connection established
3. Server will automatically join you to your user room (`user:{userId}`) and admin room if you're an admin

## Testing Scenarios

### Scenario 1: Receive Notifications
1. Connect with a user token
2. Use another Postman window or API call to trigger a notification
3. Observe the WebSocket receiving `notification` events

**Example API Call to Trigger Notification:**
```
POST http://localhost:3000/api/notifications/test
Authorization: Bearer USER_JWT_TOKEN
Content-Type: application/json

{
  "type": "SYSTEM",
  "title": "Test Notification",
  "message": "This is a test notification"
}
```

**Expected WebSocket Response:**
```json
{
  "event": "notification",
  "data": {
    "id": "notification_id",
    "type": "SYSTEM",
    "title": "Test Notification",
    "message": "This is a test notification",
    "data": {},
    "priority": "MEDIUM",
    "actionUrl": null,
    "icon": null,
    "timestamp": "2024-01-01T12:00:00.000Z",
    "read": false
  }
}
```

### Scenario 2: Send User Activity
1. Connect with user token
2. Send a message with event `user_activity`

**WebSocket Message to Send:**
```json
{
  "event": "user_activity",
  "data": {
    "activity": "page_view",
    "page": "/dashboard",
    "metadata": {
      "userAgent": "Postman",
      "ip": "127.0.0.1"
    }
  }
}
```

### Scenario 3: Join/Leave Custom Rooms
1. Connect with user token
2. Send join_room event

**Join Room:**
```json
{
  "event": "join_room",
  "data": "custom_room_123"
}
```

**Leave Room:**
```json
{
  "event": "leave_room",
  "data": "custom_room_123"
}
```

### Scenario 4: Admin Monitoring
1. Connect with admin token
2. Observe `user_activity_update` events when other users send activity

## Event Details

### Notification Event
**Event Name:** `notification`
**Target:** User room (`user:{userId}`)
**Payload:**
```json
{
  "id": "string",           // Notification ID
  "type": "string",         // SUBSCRIPTION, WORKOUT, MEAL, etc.
  "title": "string",        // Notification title
  "message": "string",      // Notification message
  "data": "object",         // Additional data
  "priority": "string",     // LOW, MEDIUM, HIGH, URGENT
  "actionUrl": "string",    // Optional action URL
  "icon": "string",         // Optional emoji icon
  "timestamp": "date",      // When notification was sent
  "read": "boolean"         // Always false for new notifications
}
```

### Reminder Event
**Event Name:** `reminder`
**Target:** User room
**Payload:**
```json
{
  "id": "string",
  "type": "REMINDER",
  "title": "string",
  "message": "string",
  "data": "object",
  "timestamp": "date"
}
```

### Announcement Event
**Event Name:** `announcement`
**Target:** All connected clients
**Payload:**
```json
{
  "title": "string",
  "message": "string",
  "type": "string",         // INFO, WARNING, ERROR
  "data": "object",
  "timestamp": "date"
}
```

### User Activity Update Event
**Event Name:** `user_activity_update`
**Target:** Admin room
**Payload:**
```json
{
  "userId": "string",
  "activity": "string",
  "timestamp": "date",
  "metadata": "object"
}
```

## Testing Scripts

### Postman Pre-request Script
```javascript
// Generate JWT token if needed
if (!pm.environment.get("jwt_token")) {
    // You'll need to get this from your login endpoint
    pm.environment.set("jwt_token", "your_token_here");
}
```

### Postman Test Script
```javascript
// Test WebSocket connection
pm.test("WebSocket connection established", function () {
    pm.expect(pm.response.code).to.eql(101); // WebSocket upgrade code
});

// Listen for events
pm.test("Notification received", function () {
    // This would be in the WebSocket response
    var jsonData = pm.response.json();
    if (jsonData.event === 'notification') {
        pm.expect(jsonData.data).to.have.property('id');
        pm.expect(jsonData.data).to.have.property('type');
    }
});
```

## Troubleshooting

### Connection Issues
- **Error: Authentication error: No token provided**
  - Ensure Authorization header or token query parameter is set
  - Verify token is valid and not expired

- **Error: Authentication error: User not found**
  - Ensure user exists in database and is active
  - Check token payload contains correct user ID

### No Events Received
- Verify you're in the correct room (user room for notifications)
- Check server logs for emission attempts
- Ensure notification was actually created via API

### Events Not Sent
- Check that `createNotification` is called in your service
- Verify `socketService.sendNotification` is invoked
- Ensure Socket.IO server is initialized

## Integration Testing

### Complete Notification Flow Test
1. **Connect WebSocket** with user token
2. **Create notification** via REST API:
   ```
   POST /api/notifications/test
   ```
3. **Verify WebSocket receives** `notification` event
4. **Mark as read** via API:
   ```
   PATCH /api/notifications/{id}/read
   ```
5. **Check notification status** via API:
   ```
   GET /api/notifications
   ```

### Bulk Notification Test
1. Connect multiple WebSocket clients (different users)
2. Send bulk notification via admin API
3. Verify each user receives appropriate notifications

## Performance Testing
- Test with multiple concurrent connections
- Monitor server resource usage
- Check notification delivery latency
- Test with high-frequency notification creation

## Security Testing
- Test with invalid tokens
- Attempt to join unauthorized rooms
- Verify admin-only events are properly restricted
- Test rate limiting on notification creation