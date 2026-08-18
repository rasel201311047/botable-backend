# 🔔 Real-time Notifications System

Complete notification system with REST API and Socket.IO real-time updates.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [Socket.IO Events](#socketio-events)
- [Notification Types](#notification-types)
- [Integration Examples](#integration-examples)
- [Testing](#testing)

---

## 🎯 Overview

The notification system provides:
- **REST API** for notification CRUD operations
- **Socket.IO** for real-time push notifications
- **Automatic triggers** for system events (subscriptions, workouts, meals, etc.)
- **Read/Unread status tracking**
- **Priority levels** and filtering
- **Bulk operations** for administrators

---

## ✨ Features

### User Features
- ✅ Receive real-time notifications via WebSocket
- ✅ View notification history with pagination
- ✅ Filter by type, priority, and read status
- ✅ Mark single or multiple notifications as read
- ✅ Delete notifications individually or in bulk
- ✅ Get unread count badge

### Admin Features
- ✅ Send custom notifications to specific users
- ✅ Send bulk notifications to multiple users
- ✅ System-wide announcements

### Developer Features
- ✅ Test notifications in development mode
- ✅ Automatic notification cleanup
- ✅ Comprehensive logging

---

## 🏗️ Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                   Client Application                 │
│  (React, Vue, Angular, Mobile App)                  │
└─────────────┬───────────────────────┬───────────────┘
              │                       │
              │ REST API              │ Socket.IO
              │                       │
┌─────────────▼───────────────────────▼───────────────┐
│                   Express Server                     │
│  ┌──────────────────┐    ┌──────────────────┐      │
│  │ Notification     │    │  Socket.IO       │      │
│  │ Controller       │◄───┤  Service         │      │
│  └────────┬─────────┘    └──────────────────┘      │
│           │                                          │
│  ┌────────▼─────────┐    ┌──────────────────┐      │
│  │ Notification     │    │  MongoDB         │      │
│  │ Service          │───►│  Database        │      │
│  └──────────────────┘    └──────────────────┘      │
└─────────────────────────────────────────────────────┘
```

### Database Schema

```javascript
{
  user: ObjectId,           // Reference to User
  type: String,             // SUBSCRIPTION, WORKOUT, MEAL, etc.
  title: String,            // Notification title
  message: String,          // Notification message
  data: Object,             // Additional data
  priority: String,         // LOW, MEDIUM, HIGH, URGENT
  read: Boolean,            // Read status
  readAt: Date,             // When marked as read
  actionUrl: String,        // Optional action URL
  icon: String,             // Emoji or icon
  expiresAt: Date,          // Optional expiration
  createdAt: Date,          // Created timestamp
  updatedAt: Date           // Updated timestamp
}
```

---

## 🔌 API Endpoints

### Base URL
```
http://localhost:5000/api/notifications
```

### Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <your_jwt_token>
```

---

### 1. Get All Notifications

**GET** `/api/notifications`

Get paginated list of user's notifications with optional filters.

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `read` | boolean | - | Filter by read status |
| `type` | string | - | Filter by notification type |
| `priority` | string | - | Filter by priority level |

#### Example Request
```bash
GET /api/notifications?page=1&limit=20&read=false&type=SUBSCRIPTION
```

#### Response
```json
{
  "status": "success",
  "data": {
    "notifications": [
      {
        "_id": "65f123abc456...",
        "user": "65f456...",
        "type": "SUBSCRIPTION",
        "title": "Subscription Activated",
        "message": "Your Premium subscription is now active!",
        "data": {
          "planName": "Premium",
          "subscriptionId": "sub_123..."
        },
        "priority": "MEDIUM",
        "read": false,
        "actionUrl": "/subscription",
        "icon": "🎉",
        "createdAt": "2026-02-01T10:00:00.000Z",
        "updatedAt": "2026-02-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

---

### 2. Get Unread Count

**GET** `/api/notifications/unread/count`

Get the count of unread notifications.

#### Response
```json
{
  "status": "success",
  "data": {
    "count": 5
  }
}
```

---

### 3. Get Notification by ID

**GET** `/api/notifications/:id`

Get a specific notification by ID.

#### Response
```json
{
  "status": "success",
  "data": {
    "notification": {
      "_id": "65f123...",
      "type": "WORKOUT",
      "title": "Workout Completed! 💪",
      "message": "Great job! You've completed Morning Cardio.",
      ...
    }
  }
}
```

---

### 4. Mark Notification as Read

**PATCH** `/api/notifications/:id/read`

Mark a specific notification as read.

#### Response
```json
{
  "status": "success",
  "data": {
    "notification": {
      "_id": "65f123...",
      "read": true,
      "readAt": "2026-02-01T10:30:00.000Z",
      ...
    }
  }
}
```

**Socket Event Emitted:** `notification_read`

---

### 5. Mark All as Read

**PATCH** `/api/notifications/read-all`

Mark all notifications as read.

#### Response
```json
{
  "status": "success",
  "message": "All notifications marked as read",
  "data": {
    "modifiedCount": 15
  }
}
```

**Socket Event Emitted:** `all_notifications_read`

---

### 6. Mark Many as Read

**PATCH** `/api/notifications/read-many`

Mark multiple notifications as read.

#### Request Body
```json
{
  "notificationIds": [
    "65f123abc456...",
    "65f123abc789...",
    "65f123abcdef..."
  ]
}
```

#### Response
```json
{
  "status": "success",
  "message": "Notifications marked as read",
  "data": {
    "modifiedCount": 3
  }
}
```

**Socket Event Emitted:** `notifications_read`

---

### 7. Delete Notification

**DELETE** `/api/notifications/:id`

Delete a specific notification.

#### Response
```json
{
  "status": "success",
  "message": "Notification deleted successfully"
}
```

**Socket Event Emitted:** `notification_deleted`

---

### 8. Delete All Read Notifications

**DELETE** `/api/notifications/read`

Delete all read notifications.

#### Response
```json
{
  "status": "success",
  "message": "All read notifications deleted",
  "data": {
    "deletedCount": 10
  }
}
```

**Socket Event Emitted:** `read_notifications_deleted`

---

### 9. Create Custom Notification (Admin)

**POST** `/api/notifications/custom`

Create a custom notification for a specific user (Admin only).

#### Request Body
```json
{
  "userId": "65f123abc456...",
  "type": "SYSTEM",
  "title": "Important Update",
  "message": "We've updated our terms of service.",
  "priority": "HIGH",
  "data": {
    "version": "2.0"
  },
  "actionUrl": "/terms",
  "icon": "📢"
}
```

#### Response
```json
{
  "status": "success",
  "data": {
    "notification": {...}
  }
}
```

---

### 10. Send Bulk Notifications (Admin)

**POST** `/api/notifications/bulk`

Send notifications to multiple users (Admin only).

#### Request Body
```json
{
  "userIds": [
    "65f123abc456...",
    "65f123abc789..."
  ],
  "type": "SYSTEM",
  "title": "Scheduled Maintenance",
  "message": "System maintenance on Sunday at 2 AM.",
  "priority": "MEDIUM",
  "icon": "🔧"
}
```

#### Response
```json
{
  "status": "success",
  "message": "Bulk notifications sent to 2 users",
  "data": {
    "count": 2
  }
}
```

---

### 11. Test Notification (Dev Only)

**POST** `/api/notifications/test`

Send a test notification (Development mode only).

#### Request Body
```json
{
  "type": "SYSTEM",
  "title": "Test Notification",
  "message": "This is a test",
  "priority": "LOW"
}
```

---

## 🔌 Socket.IO Events

### Client Connection

#### Connect to Socket.IO
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token_here'
  },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected to Socket.IO');
});

socket.on('disconnect', () => {
  console.log('Disconnected from Socket.IO');
});
```

---

### Events Received by Client

#### 1. `notification` - New Notification
Received when a new notification is created.

```javascript
socket.on('notification', (data) => {
  console.log('New notification:', data);
  // {
  //   id: "65f123...",
  //   type: "SUBSCRIPTION",
  //   title: "Subscription Activated",
  //   message: "Your Premium subscription is now active!",
  //   data: {...},
  //   priority: "MEDIUM",
  //   actionUrl: "/subscription",
  //   icon: "🎉",
  //   timestamp: "2026-02-01T10:00:00.000Z",
  //   read: false
  // }
});
```

#### 2. `notification_read` - Notification Marked as Read
```javascript
socket.on('notification_read', (data) => {
  // {
  //   notificationId: "65f123...",
  //   readAt: "2026-02-01T10:30:00.000Z"
  // }
});
```

#### 3. `all_notifications_read` - All Marked as Read
```javascript
socket.on('all_notifications_read', (data) => {
  // { count: 15 }
});
```

#### 4. `notifications_read` - Multiple Marked as Read
```javascript
socket.on('notifications_read', (data) => {
  // {
  //   notificationIds: ["id1", "id2", "id3"],
  //   count: 3
  // }
});
```

#### 5. `notification_deleted` - Notification Deleted
```javascript
socket.on('notification_deleted', (data) => {
  // { notificationId: "65f123..." }
});
```

#### 6. `read_notifications_deleted` - Read Notifications Deleted
```javascript
socket.on('read_notifications_deleted', (data) => {
  // { count: 10 }
});
```

#### 7. `reminder` - Reminder Notification
```javascript
socket.on('reminder', (data) => {
  // Reminder-specific notifications
});
```

#### 8. `announcement` - System Announcement
```javascript
socket.on('announcement', (data) => {
  // System-wide announcements
});
```

---

## 📌 Notification Types

| Type | Description | Use Cases |
|------|-------------|-----------|
| `SUBSCRIPTION` | Subscription-related | Created, renewed, cancelled, expired, payment failed |
| `WORKOUT` | Workout-related | Completed, reminder, new plan |
| `MEAL` | Nutrition/meal-related | Logged, reminder, goal reached |
| `REMINDER` | General reminders | Custom reminders, scheduled tasks |
| `ACHIEVEMENT` | Achievement unlocked | Milestones, goals reached |
| `SYSTEM` | System notifications | Updates, maintenance, announcements |
| `SLEEP_RECOVERY` | Sleep/recovery tracking | Sleep goals, recovery scores |
| `AI_INSIGHT` | AI-generated insights | Personalized recommendations |
| `CALENDAR` | Calendar events | Event reminders, schedule updates |
| `ADMIN` | Admin notifications | Admin-specific alerts |

---

## 🔗 Integration Examples

### React Example

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

function NotificationSystem() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Fetch initial notifications
    fetchNotifications();
    fetchUnreadCount();

    // Connect to Socket.IO
    const token = localStorage.getItem('authToken');
    const newSocket = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to notifications');
    });

    // Listen for new notifications
    newSocket.on('notification', (data) => {
      setNotifications(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show toast/alert
      showNotification(data);
    });

    // Listen for read events
    newSocket.on('notification_read', (data) => {
      setNotifications(prev =>
        prev.map(n =>
          n.id === data.notificationId
            ? { ...n, read: true, readAt: data.readAt }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/notifications?limit=50');
      setNotifications(response.data.data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get('/api/notifications/unread/count');
      setUnreadCount(response.data.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`/api/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch('/api/notifications/read-all');
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const showNotification = (data) => {
    // Show browser notification or toast
    if (Notification.permission === 'granted') {
      new Notification(data.title, {
        body: data.message,
        icon: data.icon
      });
    }
  };

  return (
    <div>
      <div className="notification-bell">
        🔔 {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </div>
      
      <div className="notifications-list">
        {notifications.map(notification => (
          <NotificationItem
            key={notification._id || notification.id}
            notification={notification}
            onMarkAsRead={markAsRead}
          />
        ))}
      </div>
      
      {unreadCount > 0 && (
        <button onClick={markAllAsRead}>
          Mark All as Read
        </button>
      )}
    </div>
  );
}
```

---

### Node.js Service Integration

```javascript
// In any service file (e.g., subscription.service.js)
const notificationService = require('../notification/notification.service');

// When subscription is created
const createSubscription = async (userId, planId) => {
  // ... create subscription logic
  
  // Send notification
  await notificationService.sendSubscriptionNotification(
    userId,
    'subscription_created',
    {
      planName: subscription.plan.name,
      subscriptionId: subscription.id
    }
  );
};

// When workout is completed
const completeWorkout = async (userId, workoutId) => {
  // ... complete workout logic
  
  // Send notification
  await notificationService.sendWorkoutNotification(
    userId,
    'workout_completed',
    {
      workoutName: workout.name,
      duration: workout.duration,
      calories: workout.caloriesBurned
    }
  );
};

// Custom notification
const sendCustomNotification = async (userId) => {
  await notificationService.createNotification({
    user: userId,
    type: 'ACHIEVEMENT',
    title: 'Milestone Reached! 🎯',
    message: 'You\'ve completed 50 workouts!',
    priority: 'HIGH',
    icon: '🏆',
    data: {
      achievement: 'workout_50',
      milestone: 50
    },
    actionUrl: '/achievements'
  });
};
```

---

## 🧪 Testing

### Using Postman

1. **Import Collection**: Import `POSTMAN_NOTIFICATIONS.json` into Postman
2. **Set Variables**:
   - `baseUrl`: `http://localhost:5000`
   - `authToken`: Your JWT token
3. **Test Endpoints**: Run requests from the collection

### Using Socket.IO Client

```javascript
// test-socket.js
const io = require('socket.io-client');

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token_here'
  }
});

socket.on('connect', () => {
  console.log('✅ Connected');
});

socket.on('notification', (data) => {
  console.log('📬 New notification:', data);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});
```

### Using cURL

```bash
# Get notifications
curl -X GET http://localhost:5000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"

# Mark as read
curl -X PATCH http://localhost:5000/api/notifications/NOTIFICATION_ID/read \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test notification (dev only)
curl -X POST http://localhost:5000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","message":"Hello"}'
```

---

## 🔐 Authentication

All API endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Socket.IO connections also require authentication via the `auth` parameter during connection.

---

## ⚙️ Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=your_mongodb_connection_string

# JWT
JWT_SECRET=your_jwt_secret

# Frontend URL (for CORS)
APP_URL=http://localhost:3000
```

---

## 📊 Performance Considerations

1. **Pagination**: Always use pagination for notification lists
2. **Indexes**: Database indexes are created for efficient queries
3. **Cleanup**: Old read notifications are automatically cleaned up
4. **Socket Rooms**: Users are automatically joined to their private rooms
5. **Expiration**: Set `expiresAt` for time-sensitive notifications

---

## 🎨 Priority Levels

| Priority | Color | Use Case |
|----------|-------|----------|
| `LOW` | Gray | Informational updates |
| `MEDIUM` | Blue | Standard notifications |
| `HIGH` | Orange | Important updates |
| `URGENT` | Red | Critical actions required |

---

## 🚀 Quick Start

1. **Start the server**:
```bash
npm start
```

2. **Connect from frontend**:
```javascript
const socket = io('http://localhost:5000', {
  auth: { token: 'your_token' }
});

socket.on('notification', (data) => {
  console.log('New notification:', data);
});
```

3. **Send test notification** (dev only):
```bash
curl -X POST http://localhost:5000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 📚 Additional Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Postman Collection](./POSTMAN_NOTIFICATIONS.json)
- [API Endpoints](#api-endpoints)

---

**Need Help?** Check the logs at `logs/` directory or enable debug mode in development.
