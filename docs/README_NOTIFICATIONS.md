# 🔔 Notification System - Complete Implementation

## 📋 Overview

A complete real-time notification system with REST API and Socket.IO integration for instant push notifications.

---

## 🎯 Quick Start (5 Minutes)

### 1. Start the Server
```bash
npm start
```

### 2. Test Immediately
Open `test-notification-client.html` in your browser or use Postman with `POSTMAN_NOTIFICATIONS.json`.

### 3. Get Your JWT Token
First, login to get a JWT token:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

### 4. Send Test Notification
```bash
curl -X POST http://localhost:5000/api/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 📚 Documentation Files

| File | Description |
|------|-------------|
| **NOTIFICATIONS_QUICK_START.md** | 5-minute setup guide - START HERE |
| **NOTIFICATIONS_DOCUMENTATION.md** | Complete API & Socket.IO reference |
| **NOTIFICATION_INTEGRATION_EXAMPLES.md** | Code examples for all modules |
| **NOTIFICATION_IMPLEMENTATION_SUMMARY.md** | What's been implemented |
| **POSTMAN_NOTIFICATIONS.json** | Postman API collection |
| **test-notification-client.html** | Browser test client |

---

## ✨ Key Features

### For Users
- ✅ Real-time notifications via WebSocket
- ✅ View notification history with filters
- ✅ Mark as read (single/multiple/all)
- ✅ Delete notifications
- ✅ Unread count badge
- ✅ Priority levels (LOW, MEDIUM, HIGH, URGENT)

### For Developers
- ✅ Easy integration with helper functions
- ✅ 10 notification types ready to use
- ✅ Test endpoint for development
- ✅ Comprehensive examples
- ✅ Full Postman collection

### For Admins
- ✅ Send custom notifications
- ✅ Bulk notifications to multiple users
- ✅ System-wide announcements

---

## 🔌 API Endpoints

### User Endpoints
```
GET    /api/notifications              # Get all notifications
GET    /api/notifications/unread/count # Get unread count
GET    /api/notifications/:id          # Get one notification
PATCH  /api/notifications/:id/read     # Mark as read
PATCH  /api/notifications/read-all     # Mark all as read
PATCH  /api/notifications/read-many    # Mark multiple as read
DELETE /api/notifications/:id          # Delete notification
DELETE /api/notifications/read         # Delete all read
```

### Admin Endpoints
```
POST   /api/notifications/custom       # Send custom notification
POST   /api/notifications/bulk         # Send bulk notifications
```

### Dev Endpoint
```
POST   /api/notifications/test         # Send test notification
```

---

## 📦 Notification Types

| Type | Use For | Helper Function |
|------|---------|-----------------|
| `SUBSCRIPTION` | Subscription events | `sendSubscriptionNotification()` |
| `WORKOUT` | Workout events | `sendWorkoutNotification()` |
| `MEAL` | Nutrition events | `sendNutritionNotification()` |
| `ACHIEVEMENT` | Achievements | `sendAchievementNotification()` |
| `SYSTEM` | System messages | `sendSystemNotification()` |
| `REMINDER` | Reminders | `createNotification()` |
| `SLEEP_RECOVERY` | Sleep tracking | `createNotification()` |
| `AI_INSIGHT` | AI insights | `createNotification()` |
| `CALENDAR` | Calendar events | `createNotification()` |
| `ADMIN` | Admin messages | `createNotification()` |

---

## 💻 Code Examples

### Send Subscription Notification
```javascript
const notificationService = require('./modules/notification/notification.service');

await notificationService.sendSubscriptionNotification(
  userId,
  'subscription_created',
  { planName: 'Premium' }
);
```

### Send Workout Notification
```javascript
await notificationService.sendWorkoutNotification(
  userId,
  'workout_completed',
  { workoutName: 'Morning Run', duration: 30 }
);
```

### Send Custom Notification
```javascript
await notificationService.createNotification({
  user: userId,
  type: 'SYSTEM',
  title: 'Welcome! 👋',
  message: 'Thanks for joining!',
  priority: 'MEDIUM',
  icon: '🎉',
  actionUrl: '/getting-started'
});
```

---

## 🔌 Frontend Integration

### React Example
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('authToken') }
});

socket.on('notification', (data) => {
  console.log('New notification:', data);
  // Show toast notification
});
```

### Fetch Notifications
```javascript
const response = await fetch('http://localhost:5000/api/notifications', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

---

## 🧪 Testing

### 1. HTML Test Client (Recommended)
1. Open `test-notification-client.html` in browser
2. Enter server URL: `http://localhost:5000`
3. Enter your JWT token
4. Click "Connect"
5. Send test notifications

### 2. Postman
1. Import `POSTMAN_NOTIFICATIONS.json`
2. Set variables: `baseUrl`, `authToken`
3. Run requests

### 3. cURL
```bash
# Send test notification
curl -X POST http://localhost:5000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Get notifications
curl http://localhost:5000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get unread count
curl http://localhost:5000/api/notifications/unread/count \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Socket.IO Events

### Received by Client
```javascript
socket.on('notification', (data) => {
  // New notification
});

socket.on('notification_read', (data) => {
  // Notification marked as read
});

socket.on('all_notifications_read', (data) => {
  // All marked as read
});
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              Client (React/Vue/Mobile)               │
└──────────────┬─────────────────────┬────────────────┘
               │ REST API            │ Socket.IO
               │                     │
┌──────────────▼─────────────────────▼────────────────┐
│           Express Server + Socket.IO                 │
│  ┌────────────────┐      ┌────────────────┐        │
│  │  Notification  │◄─────┤  Socket.IO     │        │
│  │  Controller    │      │  Service       │        │
│  └───────┬────────┘      └────────────────┘        │
│          │                                           │
│  ┌───────▼────────┐      ┌────────────────┐        │
│  │  Notification  │─────►│    MongoDB     │        │
│  │  Service       │      │    Database    │        │
│  └────────────────┘      └────────────────┘        │
└─────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
modules/notification/
├── notification.model.js          # MongoDB schema
├── notification.service.js        # Business logic & helpers
├── notification.controller.js     # API request handlers
└── notification.routes.js         # Route definitions

Documentation:
├── NOTIFICATIONS_QUICK_START.md
├── NOTIFICATIONS_DOCUMENTATION.md
├── NOTIFICATION_INTEGRATION_EXAMPLES.md
├── NOTIFICATION_IMPLEMENTATION_SUMMARY.md
├── POSTMAN_NOTIFICATIONS.json
└── test-notification-client.html
```

---

## ⚙️ Environment Variables

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
APP_URL=http://localhost:3000
```

---

## 🔐 Security

- ✅ JWT authentication required
- ✅ Socket.IO authentication middleware
- ✅ User-specific notification access
- ✅ Admin-only endpoints
- ✅ Rate limiting enabled

---

## 🎯 Priority Levels

| Priority | Color | When to Use |
|----------|-------|-------------|
| `URGENT` | 🔴 Red | Payment failures, critical actions |
| `HIGH` | 🟠 Orange | Reminders, important updates |
| `MEDIUM` | 🔵 Blue | Achievements, completions |
| `LOW` | ⚫ Gray | Informational updates |

---

## 📈 Performance

- ✅ Database indexes for fast queries
- ✅ Pagination support (default: 20/page)
- ✅ Automatic cleanup of old notifications
- ✅ Efficient Socket.IO room-based targeting
- ✅ Optional notification expiration

---

## 🆘 Troubleshooting

### Socket.IO not connecting?
1. Check JWT token is valid
2. Verify server is running on correct port
3. Check CORS settings in `config/socket.js`

### Notifications not appearing?
1. Verify Socket.IO connection
2. Check browser console for errors
3. Verify JWT token in both REST and Socket.IO

### Test endpoint not working?
- Only available when `NODE_ENV !== 'production'`

---

## ✅ Integration Checklist

- [ ] Server running (`npm start`)
- [ ] MongoDB connected
- [ ] JWT token obtained (login first)
- [ ] Test client working
- [ ] Socket.IO connected
- [ ] Test notification sent and received
- [ ] Add notification triggers to your modules
- [ ] Frontend connected to Socket.IO
- [ ] Notification UI implemented

---

## 🎓 Next Steps

1. **Test the system**: Use the HTML test client
2. **Integrate in modules**: Add notification triggers
3. **Setup frontend**: Connect Socket.IO client
4. **Add scheduled jobs**: Daily reminders, etc.
5. **Customize UI**: Build notification components

---

## 📖 Learn More

- **Quick Start**: Read `NOTIFICATIONS_QUICK_START.md`
- **Full API Docs**: Read `NOTIFICATIONS_DOCUMENTATION.md`
- **Code Examples**: Read `NOTIFICATION_INTEGRATION_EXAMPLES.md`
- **Implementation Details**: Read `NOTIFICATION_IMPLEMENTATION_SUMMARY.md`

---

## 🎉 You're All Set!

Your notification system is fully implemented and production-ready!

**Start testing now:**
```bash
npm start
# Then open test-notification-client.html
```

---

## 💡 Tips

1. **Start Simple**: Use the test endpoint to verify everything works
2. **Use HTML Client**: Best way to see real-time notifications
3. **Check Examples**: Lots of code examples in integration guide
4. **Read Docs**: Comprehensive documentation available
5. **Test First**: Test with Postman before frontend integration

---

## 🤝 Support

- Check the documentation files
- Use the test client for debugging
- Review the integration examples
- Check server logs for errors

**Happy coding! 🚀**
