# 🚀 Quick Start - Notifications System

## ⚡ 5-Minute Setup

### 1. Start Your Server
```bash
npm start
```

The notification system is already integrated and ready to use!

---

## 🧪 Test Immediately

### Option 1: Use the HTML Test Client (Easiest)

1. Open `test-notification-client.html` in your browser
2. Enter your server URL: `http://localhost:5000`
3. Enter your JWT token
4. Click "Connect"
5. Click "Send Test Notification"

### Option 2: Use Postman

1. Import `POSTMAN_NOTIFICATIONS.json` into Postman
2. Set variables:
   - `baseUrl`: `http://localhost:5000`
   - `authToken`: Your JWT token
3. Run "Test Notification (Dev)" request

### Option 3: Use cURL

```bash
curl -X POST http://localhost:5000/api/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 📱 Connect from Frontend

### React/Vue/Angular

```javascript
import io from 'socket.io-client';

// Connect
const socket = io('http://localhost:5000', {
  auth: {
    token: localStorage.getItem('authToken')
  }
});

// Listen for notifications
socket.on('notification', (data) => {
  console.log('New notification:', data);
  // Show toast/alert to user
});
```

---

## 🔔 Send Notifications from Your Code

### Quick Examples

```javascript
const notificationService = require('./modules/notification/notification.service');

// 1. Subscription notification
await notificationService.sendSubscriptionNotification(
  userId,
  'subscription_created',
  { planName: 'Premium' }
);

// 2. Workout notification
await notificationService.sendWorkoutNotification(
  userId,
  'workout_completed',
  { workoutName: 'Morning Cardio' }
);

// 3. Meal notification
await notificationService.sendNutritionNotification(
  userId,
  'meal_logged',
  { mealType: 'breakfast' }
);

// 4. Achievement notification
await notificationService.sendAchievementNotification(userId, {
  message: 'You completed 10 workouts!'
});

// 5. Custom notification
await notificationService.createNotification({
  user: userId,
  type: 'SYSTEM',
  title: 'Welcome!',
  message: 'Thanks for joining!',
  priority: 'MEDIUM',
  icon: '👋'
});
```

---

## 📚 API Endpoints Cheat Sheet

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get all notifications |
| GET | `/api/notifications/unread/count` | Get unread count |
| GET | `/api/notifications/:id` | Get one notification |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/:id` | Delete notification |
| DELETE | `/api/notifications/read` | Delete all read |
| POST | `/api/notifications/test` | Send test (dev only) |

---

## 🎯 Common Use Cases

### 1. When User Subscribes
```javascript
// In subscription.controller.js
await notificationService.sendSubscriptionNotification(
  userId,
  'subscription_created',
  { planName: subscription.plan.name }
);
```

### 2. When Workout Completes
```javascript
// In workout.controller.js
await notificationService.sendWorkoutNotification(
  userId,
  'workout_completed',
  { workoutName: workout.name }
);
```

### 3. Daily Reminders
```javascript
// In jobs/reminder.job.js
await notificationService.sendWorkoutNotification(
  userId,
  'workout_reminder',
  { workoutName: 'Your scheduled workout' }
);
```

---

## 🔌 Socket.IO Events You'll Receive

```javascript
socket.on('notification', (data) => {
  // New notification received
});

socket.on('notification_read', (data) => {
  // Notification marked as read
});

socket.on('all_notifications_read', (data) => {
  // All notifications marked as read
});
```

---

## 📖 Full Documentation

- **Complete API Docs**: `NOTIFICATIONS_DOCUMENTATION.md`
- **Integration Examples**: `NOTIFICATION_INTEGRATION_EXAMPLES.md`
- **Postman Collection**: `POSTMAN_NOTIFICATIONS.json`
- **Test Client**: `test-notification-client.html`

---

## 🆘 Troubleshooting

### Socket.IO not connecting?
1. Check JWT token is valid
2. Verify server is running
3. Check CORS settings in `config/socket.js`

### Notifications not appearing?
1. Check user is authenticated
2. Verify Socket.IO connection
3. Check browser console for errors

### Test endpoint not working?
- Only available in development mode
- Check `NODE_ENV` is not 'production'

---

## ✅ Checklist

- [ ] Server running on port 5000
- [ ] Socket.IO initialized in `index.js`
- [ ] MongoDB connected
- [ ] JWT token obtained (login first)
- [ ] Test client opened or Postman configured
- [ ] Socket.IO connected successfully
- [ ] Test notification sent and received

---

## 🎉 You're Ready!

Start sending notifications in your application. They'll appear in real-time for connected users!

**Need help?** Check the full documentation or test with the HTML client first.
