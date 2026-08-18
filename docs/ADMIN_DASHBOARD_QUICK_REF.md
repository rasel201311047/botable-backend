# Admin Dashboard API - Quick Reference

## 🎯 Quick Access Guide

---

## 1️⃣ Revenue Statistics

**Get year-wise revenue with monthly breakdown:**
```
GET /api/admin/revenue?year=2026
```

**Response includes:**
- Total revenue for the year
- Monthly breakdown (12 months)
- MRR & ARR calculations
- Chart-ready data

---

## 2️⃣ Dashboard Stats

**Get dashboard overview with year filtering:**
```
GET /api/admin/dashboard?year=2026
```

**Response includes:**
- Total revenue, users, subscribers
- Monthly new users count
- Monthly new subscribers count
- Conversion rate
- Chart-ready data

---

## 3️⃣ Subscriptions Management

**Get all subscriptions:**
```
GET /api/admin/subscriptions
```

**Filter by period:**
```
GET /api/admin/subscriptions?period=today
GET /api/admin/subscriptions?period=week
GET /api/admin/subscriptions?period=month
GET /api/admin/subscriptions?period=year&year=2026
```

**Search by name/email/phone:**
```
GET /api/admin/subscriptions?search=john
```

**Filter by status:**
```
GET /api/admin/subscriptions?status=active
GET /api/admin/subscriptions?status=pending
GET /api/admin/subscriptions?status=rejected
GET /api/admin/subscriptions?status=cancelled
```

**Update subscription status:**
```
PUT /api/admin/subscriptions/:userId
Body: {
  "status": "active",
  "isActive": true
}
```

**Subscription fields returned:**
- Profile photo
- Email, Phone, Username
- Plan name, Amount
- Subscription date, Start/End dates
- Status, Payment method
- Height, Weight, Location

---

## 4️⃣ Users Management

**Get all users with aggregate data:**
```
GET /api/admin/users
```

**Aggregate data includes:**
- Total users
- Active users
- Premium users
- Blocked users
- Conversion rate

**Search:**
```
GET /api/admin/users?search=john
GET /api/admin/users?search=john@example.com
GET /api/admin/users?location=New York
```

**Filter by status:**
```
GET /api/admin/users?status=active
GET /api/admin/users?status=blocked
GET /api/admin/users?status=all
```

**Filter by subscription:**
```
GET /api/admin/users?subscription=monthly
GET /api/admin/users?subscription=yearly
GET /api/admin/users?subscription=free
```

**Block user:**
```
PUT /api/admin/users/:id/block
```

**Unblock user:**
```
PUT /api/admin/users/:id/unblock
```

**Update user status:**
```
PUT /api/admin/users/:id/status
Body: {
  "isActive": false
}
```

**User fields returned:**
- Username, Email, Profile photo
- Phone number
- Height, Weight, Age, Gender
- Location (city, country)
- Subscription plan & status
- Join date, Last login
- Status (Active/Blocked)
- Goal type, Shift type

---

## 🔑 Authentication

All endpoints require:
```javascript
Headers: {
  'Authorization': 'Bearer YOUR_ADMIN_TOKEN',
  'Content-Type': 'application/json'
}
```

---

## 📋 Filter Options Summary

### Revenue
- `year` - Year (2024, 2025, 2026, etc.)

### Dashboard
- `year` - Year (2024, 2025, 2026, etc.)

### Subscriptions
- `period` - today | week | month | year
- `year` - Year number
- `search` - Text search (name, email, phone)
- `plan` - monthly | yearly | all
- `status` - active | pending | rejected | cancelled | all
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

### Users
- `search` - Text search (name, email, location)
- `status` - active | blocked | all
- `subscription` - monthly | yearly | free | all
- `location` - Location search
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

---

## 🎨 Chart Data Format

All chart endpoints return data in this format:

```json
{
  "chartData": {
    "labels": ["January", "February", "March", ...],
    "datasets": [
      {
        "label": "Revenue",
        "data": [120, 150, 180, ...]
      }
    ]
  }
}
```

Ready to use with Chart.js, Recharts, or any chart library!

---

## 📊 Common Response Patterns

### Pagination
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 250,
    "pages": 13
  }
}
```

### Statistics
```json
{
  "aggregateData": {
    "totalUsers": 1500,
    "activeUsers": 1350,
    "premiumUsers": 250
  }
}
```

### Filters Applied
```json
{
  "filters": {
    "status": "active",
    "period": "month",
    "year": 2026
  }
}
```

---

## 🚀 Quick Start Examples

### Example 1: Get Revenue Chart Data
```javascript
const response = await fetch(
  'http://localhost:5000/api/admin/revenue?year=2026',
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
const data = await response.json();
// Use data.data.chartData in your chart component
```

### Example 2: Search Subscriptions
```javascript
const response = await fetch(
  'http://localhost:5000/api/admin/subscriptions?search=john&period=month',
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
const data = await response.json();
// data.data.subscriptions contains the results
```

### Example 3: Block User
```javascript
const response = await fetch(
  `http://localhost:5000/api/admin/users/${userId}/block`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
const data = await response.json();
// User is now blocked
```

### Example 4: Update Subscription Status
```javascript
const response = await fetch(
  `http://localhost:5000/api/admin/subscriptions/${userId}`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'active',
      isActive: true
    })
  }
);
const data = await response.json();
// Subscription status updated
```

---

## 📞 Support

For full documentation, see: [ADMIN_DASHBOARD_ENHANCEMENTS.md](ADMIN_DASHBOARD_ENHANCEMENTS.md)

---

**Quick Reference v1.0**  
**Last Updated:** February 19, 2026
