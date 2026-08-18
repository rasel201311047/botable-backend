# Admin Subscriptions System - Architecture & Flow

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD (React/Vue)                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Total Stats │  │    Revenue   │  │  Recent Transactions │  │
│  │   Widget     │  │    Widget    │  │     Widget           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└──────────────┬──────────────┬─────────────────┬──────────────────┘
               │              │                 │
               ▼              ▼                 ▼
    ┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
    │ /stats/total    │ │/stats/revenue│ │ /transactions    │
    │ /transactions   │ │              │ │ /transactions/:id│
    └─────────────────┘ └──────────────┘ └──────────────────┘
               │              │                 │
               └──────────────┬─────────────────┘
                              │
                              ▼
    ┌──────────────────────────────────────────────────────┐
    │   Admin Subscriptions Controller                     │
    │  ┌───────────────────────────────────────────────┐  │
    │  │ • getTotalSubscriptions()                     │  │
    │  │ • getMonthlyRevenue()                         │  │
    │  │ • getRecentTransactions()                     │  │
    │  │ • getTransactionDetail()                      │  │
    │  │ • getSubscriptions() [existing]               │  │
    │  │ • getPayments() [existing]                    │  │
    │  │ • getRevenueStats() [existing]                │  │
    │  └───────────────────────────────────────────────┘  │
    └──────────────────────────────────────────────────────┘
                              │
                              ▼
    ┌──────────────────────────────────────────────────────┐
    │            MongoDB Database                         │
    │  ┌──────────────────────────────────────────────┐  │
    │  │  User Collection                            │  │
    │  │  ┌────────────────────────────────────────┐ │  │
    │  │  │ _id: ObjectId                          │ │  │
    │  │  │ name: String                           │ │  │
    │  │  │ email: String                          │ │  │
    │  │  │ profilePhoto: String                   │ │  │
    │  │  │ subscription: {                        │ │  │
    │  │  │   plan: 'monthly'|'yearly'|'free'     │ │  │
    │  │  │   isActive: Boolean                    │ │  │
    │  │  │   startDate: Date                      │ │  │
    │  │  │   endDate: Date                        │ │  │
    │  │  │   stripeCustomerId: String             │ │  │
    │  │  │   stripeSubscriptionId: String         │ │  │
    │  │  │ }                                       │ │  │
    │  │  └────────────────────────────────────────┘ │  │
    │  └──────────────────────────────────────────────┘  │
    └──────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### 1. Total Subscriptions Flow
```
GET /api/admin/subscriptions/stats/total
    ↓
getTotalSubscriptions() method
    ↓
getSubscriptionStats() aggregation
    ├─ Group by subscription.plan
    ├─ Count total users per plan
    ├─ Count active users per plan
    └─ Return breakdown
    ↓
Calculate summary:
    ├─ totalUsers = sum of all plans
    ├─ totalActive = sum of active users
    ├─ totalPaid = monthly + yearly
    └─ conversionRate = (totalPaid/totalUsers)*100
    ↓
Response: {summary, breakdown}
```

### 2. Monthly Revenue Flow
```
GET /api/admin/subscriptions/stats/revenue?month=1&year=2024
    ↓
getMonthlyRevenue() method
    ├─ Set date range (1st to last day of month)
    ├─ Query monthly subscriptions count
    ├─ Query yearly subscriptions count
    └─ Try to fetch from Stripe
    ↓
Calculate revenue:
    ├─ monthlyRevenue = count × $10
    ├─ yearlyRevenue = count × $100
    └─ total = monthlyRevenue + yearlyRevenue
    ↓
Calculate metrics:
    ├─ MRR = monthlyRevenue + (yearlyRevenue / 12)
    └─ avgValue = total / (monthlySubs + yearlySubs)
    ↓
Response: {calculatedRevenue, stripeRevenue, metrics}
```

### 3. Recent Transactions Flow
```
GET /api/admin/subscriptions/transactions?page=1&limit=20&period=month&status=active
    ↓
getRecentTransactions() method
    ├─ Parse query parameters
    ├─ Build MongoDB query
    ├─ Add date filter based on period
    ├─ Add plan filter
    └─ Add status filter
    ↓
Database Query:
    find({ query filters })
        .select('name email profilePhoto subscription')
        .sort({ 'subscription.startDate': -1 })
        .skip((page-1)*limit)
        .limit(limit)
    ↓
Format each transaction:
    ├─ Generate transactionId from userId & timestamp
    ├─ Extract customer info
    ├─ Calculate renewal date
    ├─ Determine payment method
    └─ Set status
    ↓
Response: {transactions[], pagination, filters}
```

### 4. Transaction Detail Flow
```
GET /api/admin/subscriptions/transactions/TXN_507f1f77bcf86cd799439011_1705324200000
    ↓
getTransactionDetail() method
    ├─ Extract userId from transactionId
    ├─ Query user by ID
    └─ Check user has subscription
    ↓
Format transaction details:
    ├─ Calculate renewal date
    ├─ Calculate days until renewal
    ├─ Gather all customer info
    ├─ Stripe details
    └─ Payment method
    ↓
Response: Complete transaction object with calculated fields
```

---

## 🔑 Key Calculations

### Transaction ID Generation
```
Format: TXN_{userId}_{timestamp}
Example: TXN_507f1f77bcf86cd799439011_1705324200000

Usage: Extract userId when needed
const match = transactionId.match(/TXN_([a-f0-9]{24})_/);
const userId = match[1];
```

### Renewal Date Calculation
```javascript
const renewalDate = new Date(subscription.startDate);

if (subscription.plan === 'monthly') {
  renewalDate.setMonth(renewalDate.getMonth() + 1);
} else {
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
}
```

### Days Until Renewal
```javascript
const now = new Date();
const daysUntilRenewal = Math.ceil(
  (renewalDate - now) / (1000 * 60 * 60 * 24)
);
```

### Conversion Rate
```javascript
const totalUsers = 215;
const totalPaid = 65;
const conversionRate = ((totalPaid / totalUsers) * 100).toFixed(2) + '%';
// Result: "30.23%"
```

### MRR (Monthly Recurring Revenue)
```javascript
const monthlyRevenue = monthlySubs * 10;
const yearlyRevenue = yearlySubs * 100;
const mrr = monthlyRevenue + (yearlyRevenue / 12);
```

---

## 🔀 Route Structure

```
/api/admin (protected, admin-only)
│
├── /subscriptions
│   ├── GET                          → getSubscriptions() [existing]
│   │   ├── Query: page, limit, plan, isActive, search
│   │   └── Returns: Subscription list with stats
│   │
│   ├── PUT /:userId                 → updateSubscription() [existing]
│   │   └── Returns: Updated subscription object
│   │
│   ├── /stats
│   │   ├── GET /total               → getTotalSubscriptions() [NEW]
│   │   │   └── Returns: Summary + breakdown
│   │   │
│   │   └── GET /revenue             → getMonthlyRevenue() [NEW]
│   │       ├── Query: month, year
│   │       └── Returns: Revenue data + metrics
│   │
│   └── /transactions
│       ├── GET                      → getRecentTransactions() [NEW]
│       │   ├── Query: page, limit, period, plan, status
│       │   └── Returns: Transaction list with pagination
│       │
│       └── GET /:transactionId      → getTransactionDetail() [NEW]
│           └── Returns: Detailed transaction info
│
├── /payments                        → getPayments() [existing]
│
└── /revenue                         → getRevenueStats() [existing]
```

---

## 🧮 Query Examples

### MongoDB Aggregation for Stats
```javascript
User.aggregate([
  { $match: {} },
  {
    $group: {
      _id: '$subscription.plan',
      count: { $sum: 1 },
      active: {
        $sum: {
          $cond: [{ $eq: ['$subscription.isActive', true] }, 1, 0]
        }
      }
    }
  }
])

// Result:
// { _id: 'free', count: 150, active: 145 }
// { _id: 'monthly', count: 45, active: 42 }
// { _id: 'yearly', count: 20, active: 20 }
```

### MongoDB Find for Transactions
```javascript
User.find({
  'subscription.plan': { $in: ['monthly', 'yearly'] },
  'subscription.startDate': { $gte: startDate, $lte: endDate }
})
.select('name email profilePhoto subscription')
.sort({ 'subscription.startDate': -1 })
.skip((page - 1) * limit)
.limit(limit)
```

### MongoDB Count for Revenue
```javascript
const monthlySubs = await User.countDocuments({
  'subscription.plan': 'monthly',
  'subscription.isActive': true,
  'subscription.startDate': { $lte: endDate }
});

const yearlySubs = await User.countDocuments({
  'subscription.plan': 'yearly',
  'subscription.isActive': true,
  'subscription.startDate': { $lte: endDate }
});
```

---

## 🔐 Authentication Flow

```
1. Admin User Login
   ├─ POST /api/auth/login
   └─ Returns: JWT token + user info

2. Store Token
   └─ localStorage.setItem('token', jwtToken)

3. Make Admin Request
   ├─ GET /api/admin/subscriptions/stats/total
   ├─ Headers: { Authorization: "Bearer [JWT_TOKEN]" }
   └─ Middleware chain:
       ├─ protect middleware → Verify JWT
       ├─ admin middleware → Check admin role
       └─ Controller method executes

4. Response or Error
   ├─ 200: Success response
   ├─ 401: Unauthorized (invalid/missing token)
   ├─ 403: Forbidden (not admin)
   └─ 500: Server error
```

---

## 📈 Response Structure

### Success Response
```javascript
{
  status: "success",
  data: {
    // Endpoint-specific data
    // Can include: stats, transactions, pagination, etc.
  }
}
```

### Error Response
```javascript
{
  status: "error",
  message: "Error description"
}
```

### Pagination Object
```javascript
{
  page: 1,
  limit: 20,
  total: 65,
  pages: 4
}
```

---

## 🔄 Filtering Logic

### Period Filter
```javascript
switch (period) {
  case 'today':
    startDate = new Date().setHours(0, 0, 0, 0);
    break;
  case 'week':
    startDate = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
    break;
  case 'month':
    startDate = new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
    break;
  case 'year':
    startDate = new Date().getTime() - 365 * 24 * 60 * 60 * 1000;
    break;
  case 'all':
    // No date filter
    break;
}
```

### Plan Filter
```javascript
if (plan !== 'all') {
  query['subscription.plan'] = plan;
}
```

### Status Filter
```javascript
if (status === 'active') {
  query['subscription.isActive'] = true;
} else if (status === 'inactive') {
  query['subscription.isActive'] = false;
}
```

---

## 🧪 Testing Workflow

```
1. Get Admin Token
   curl -X POST http://localhost:5000/api/auth/admin/login \
     -d '{"email": "admin@example.com", "password": "password"}'

2. Test Total Subscriptions
   curl -X GET http://localhost:5000/api/admin/subscriptions/stats/total \
     -H "Authorization: Bearer TOKEN"

3. Test Monthly Revenue
   curl -X GET "http://localhost:5000/api/admin/subscriptions/stats/revenue?month=1&year=2024" \
     -H "Authorization: Bearer TOKEN"

4. Test Recent Transactions
   curl -X GET "http://localhost:5000/api/admin/subscriptions/transactions?period=month&status=active" \
     -H "Authorization: Bearer TOKEN"

5. Test Transaction Details
   curl -X GET "http://localhost:5000/api/admin/subscriptions/transactions/TXN_[ID]_[TS]" \
     -H "Authorization: Bearer TOKEN"
```

---

## 💾 Caching Considerations

Current implementation: No caching
Recommended for production:
- Cache total subscriptions (TTL: 1 hour)
- Cache monthly revenue (TTL: 1 hour)
- Cache transaction list (TTL: 5 minutes)
- No cache on transaction details (real-time)

```javascript
// Example with Redis
async getTotalSubscriptions(req, res, next) {
  const cached = await redis.get('admin:total-subs');
  if (cached) return res.json(JSON.parse(cached));
  
  // ... fetch from DB ...
  
  await redis.setex('admin:total-subs', 3600, JSON.stringify(data));
  res.json(data);
}
```

---

## 🚀 Performance Notes

- **Query Optimization**: Using `.select()` to only fetch needed fields
- **Pagination**: Implemented to handle large datasets
- **Sorting**: By `startDate` for most recent first
- **Lean Queries**: Using `.lean()` for read-only operations
- **Aggregation**: Used for complex statistics calculations

---

## 📋 Integration Checklist

- [ ] Test each endpoint with valid admin token
- [ ] Verify response format matches documentation
- [ ] Test pagination with different page/limit values
- [ ] Test filters individually and in combination
- [ ] Test with no results (empty responses)
- [ ] Test error cases (401, 403, 404)
- [ ] Load test with large datasets
- [ ] Verify Stripe integration if configured
- [ ] Create React components for display
- [ ] Set up auto-refresh for dashboard

---

## 🔗 Related Files

- Controller: `admin/subscriptions/admin.subscriptions.controller.js`
- Routes: `admin/admin.routes.js`
- User Model: `modules/user/user.model.js`
- Stripe Config: `config/stripe.js`
- Middleware: `middlewares/auth.middleware.js`

---

## 📚 Documentation

- `ADMIN_SUBSCRIPTIONS_API.md` - Full API reference
- `ADMIN_SUBSCRIPTIONS_IMPLEMENTATION.md` - Implementation guide
- `ADMIN_SUBSCRIPTIONS_QUICK_REFERENCE.md` - Quick reference
- `CHANGES_SUMMARY.md` - Summary of changes
