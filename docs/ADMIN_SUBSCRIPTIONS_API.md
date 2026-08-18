# Admin Subscriptions API Documentation

Complete API reference for subscription management, revenue analytics, and transaction tracking in the admin panel.

## Base URL
```
/api/admin/subscriptions
```

## Authentication
All endpoints require:
- Admin authentication via `protect` and `admin` middleware
- Valid JWT token in Authorization header
- Admin role in user account

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subscriptions` | Get all subscriptions with pagination |
| GET | `/subscriptions/stats/total` | Get total subscription counts and breakdown |
| GET | `/subscriptions/stats/revenue` | Get monthly revenue analytics |
| GET | `/subscriptions/transactions` | Get recent transactions with customer details |
| GET | `/subscriptions/transactions/:transactionId` | Get detailed transaction information |
| PUT | `/subscriptions/:userId` | Update user subscription manually |
| GET | `/payments` | Get payment history from Stripe |
| GET | `/revenue` | Get revenue statistics |

---

## 1. Get All Subscriptions

### Endpoint
```
GET /api/admin/subscriptions
```

### Query Parameters
```javascript
{
  "page": 1,              // Page number (default: 1)
  "limit": 20,            // Results per page (default: 20)
  "plan": "monthly",      // Filter by plan: 'free', 'monthly', 'yearly', 'all'
  "isActive": "true",     // Filter by status: 'true', 'false'
  "search": "john"        // Search by name or email
}
```

### Example Request
```bash
curl -X GET "http://localhost:5000/api/admin/subscriptions?page=1&limit=20&plan=monthly&isActive=true" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "subscriptions": [
      {
        "userId": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com",
        "plan": "monthly",
        "isActive": true,
        "startDate": "2024-01-15T10:30:00Z",
        "endDate": "2025-01-15T10:30:00Z",
        "customerId": "cus_XXXXXXXXX",
        "subscriptionId": "sub_XXXXXXXXX",
        "memberSince": "2023-12-01T08:00:00Z"
      },
      {
        "userId": "507f1f77bcf86cd799439012",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "plan": "yearly",
        "isActive": true,
        "startDate": "2024-06-20T14:22:00Z",
        "endDate": "2025-06-20T14:22:00Z",
        "customerId": "cus_YYYYYYYYY",
        "subscriptionId": "sub_YYYYYYYYY",
        "memberSince": "2024-01-10T09:15:00Z"
      }
    ],
    "stats": {
      "free": { "total": 150, "active": 145 },
      "monthly": { "total": 45, "active": 42 },
      "yearly": { "total": 20, "active": 20 }
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 215,
      "pages": 11
    }
  }
}
```

---

## 2. Get Total Subscriptions

### Endpoint
```
GET /api/admin/subscriptions/stats/total
```

### Query Parameters
None required

### Example Request
```bash
curl -X GET "http://localhost:5000/api/admin/subscriptions/stats/total" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "summary": {
      "totalUsers": 215,
      "totalActive": 207,
      "totalPaid": 65,
      "conversionRate": "30.23%"
    },
    "breakdown": {
      "free": {
        "total": 150,
        "active": 145
      },
      "monthly": {
        "total": 45,
        "active": 42
      },
      "yearly": {
        "total": 20,
        "active": 20
      }
    }
  }
}
```

### Field Descriptions
- **totalUsers**: Total number of users in the system
- **totalActive**: Number of active users
- **totalPaid**: Number of paid subscription users (monthly + yearly)
- **conversionRate**: Percentage of users with paid subscriptions
- **breakdown.free**: Free plan user statistics
- **breakdown.monthly**: Monthly subscription statistics
- **breakdown.yearly**: Yearly subscription statistics

---

## 3. Get Monthly Revenue

### Endpoint
```
GET /api/admin/subscriptions/stats/revenue
```

### Query Parameters
```javascript
{
  "month": 1,     // Month number 1-12 (default: current month)
  "year": 2024    // Year (default: current year)
}
```

### Example Request
```bash
# Get current month revenue
curl -X GET "http://localhost:5000/api/admin/subscriptions/stats/revenue" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get specific month (January 2024)
curl -X GET "http://localhost:5000/api/admin/subscriptions/stats/revenue?month=1&year=2024" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "period": "1/2024",
    "calculatedRevenue": {
      "monthlySubscriptions": {
        "count": 42,
        "amount": 420
      },
      "yearlySubscriptions": {
        "count": 20,
        "amount": 2000
      },
      "total": 2420
    },
    "stripeRevenue": {
      "totalCharges": 62,
      "totalAmount": "2420.00",
      "succeededCharges": 62,
      "failedCharges": 0
    },
    "metrics": {
      "averageSubscriptionValue": 37.23,
      "mrr": 385
    }
  }
}
```

### Field Descriptions
- **period**: The month and year in M/YYYY format
- **calculatedRevenue**: Revenue calculated from database subscriptions
  - **monthlySubscriptions.count**: Number of active monthly subscriptions
  - **monthlySubscriptions.amount**: Total revenue from monthly plans (count × $10)
  - **yearlySubscriptions.amount**: Total revenue from yearly plans (count × $100)
  - **total**: Total revenue for the period
- **stripeRevenue**: Revenue data from Stripe API (if configured)
  - **succeededCharges**: Number of successful payments
  - **failedCharges**: Number of failed payments
- **metrics**:
  - **averageSubscriptionValue**: Average revenue per subscription
  - **mrr**: Monthly Recurring Revenue (projected annual / 12)

---

## 4. Get Recent Transactions

### Endpoint
```
GET /api/admin/subscriptions/transactions
```

### Query Parameters
```javascript
{
  "page": 1,              // Page number (default: 1)
  "limit": 20,            // Results per page (default: 20)
  "period": "month",      // Filter period: 'today', 'week', 'month', 'year', 'all'
  "plan": "all",          // Filter by plan: 'monthly', 'yearly', 'all'
  "status": "all"         // Filter by status: 'active', 'inactive', 'all'
}
```

### Example Request
```bash
# Get recent transactions from this month
curl -X GET "http://localhost:5000/api/admin/subscriptions/transactions?page=1&limit=20&period=month&status=active" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get all monthly plan transactions
curl -X GET "http://localhost:5000/api/admin/subscriptions/transactions?plan=monthly&limit=50" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "transactions": [
      {
        "transactionId": "TXN_507f1f77bcf86cd799439011_1705324200000",
        "customer": {
          "id": "507f1f77bcf86cd799439011",
          "name": "John Doe",
          "email": "john@example.com",
          "profilePhoto": "https://example.com/photos/john.jpg"
        },
        "subscription": {
          "plan": "monthly",
          "planName": "Monthly"
        },
        "payment": {
          "amount": 10,
          "currency": "USD",
          "status": "Active"
        },
        "dates": {
          "startDate": "2024-01-15T10:30:00Z",
          "renewalDate": "2024-02-15T10:30:00Z",
          "endDate": null
        },
        "stripeDetails": {
          "customerId": "cus_XXXXXXXXX",
          "subscriptionId": "sub_XXXXXXXXX"
        },
        "paymentMethod": "Stripe",
        "status": "Active"
      },
      {
        "transactionId": "TXN_507f1f77bcf86cd799439012_1718846520000",
        "customer": {
          "id": "507f1f77bcf86cd799439012",
          "name": "Jane Smith",
          "email": "jane@example.com",
          "profilePhoto": "https://example.com/photos/jane.jpg"
        },
        "subscription": {
          "plan": "yearly",
          "planName": "Yearly"
        },
        "payment": {
          "amount": 100,
          "currency": "USD",
          "status": "Active"
        },
        "dates": {
          "startDate": "2024-06-20T14:22:00Z",
          "renewalDate": "2025-06-20T14:22:00Z",
          "endDate": null
        },
        "stripeDetails": {
          "customerId": "cus_YYYYYYYYY",
          "subscriptionId": "sub_YYYYYYYYY"
        },
        "paymentMethod": "Stripe",
        "status": "Active"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 65,
      "pages": 4
    },
    "filters": {
      "period": "all",
      "plan": "all",
      "status": "all"
    }
  }
}
```

### Transaction Object Fields
- **transactionId**: Unique transaction identifier (format: TXN_userId_timestamp)
- **customer**:
  - **id**: MongoDB user ID
  - **name**: Customer name
  - **email**: Customer email address
  - **profilePhoto**: URL to profile photo (null if not set)
- **subscription**:
  - **plan**: Plan type ('monthly' or 'yearly')
  - **planName**: Display name for plan
- **payment**:
  - **amount**: Payment amount in dollars ($10 for monthly, $100 for yearly)
  - **currency**: Currency type (USD)
  - **status**: Payment status ('Active' or 'Inactive')
- **dates**:
  - **startDate**: Subscription start date
  - **renewalDate**: Next renewal/billing date
  - **endDate**: Subscription end date (null if active)
- **stripeDetails**:
  - **customerId**: Stripe customer ID
  - **subscriptionId**: Stripe subscription ID
- **paymentMethod**: Payment method ('Stripe' or 'Local')
- **status**: Overall subscription status ('Active' or 'Cancelled')

---

## 5. Get Transaction Details

### Endpoint
```
GET /api/admin/subscriptions/transactions/:transactionId
```

### URL Parameters
```javascript
{
  "transactionId": "TXN_507f1f77bcf86cd799439011_1705324200000"  // From transaction list
}
```

### Example Request
```bash
curl -X GET "http://localhost:5000/api/admin/subscriptions/transactions/TXN_507f1f77bcf86cd799439011_1705324200000" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "transactionId": "TXN_507f1f77bcf86cd799439011_1705324200000",
    "customer": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "profilePhoto": "https://example.com/photos/john.jpg",
      "memberSince": "2023-12-01T08:00:00Z"
    },
    "subscription": {
      "plan": "monthly",
      "planName": "Monthly"
    },
    "payment": {
      "amount": 10,
      "currency": "USD",
      "status": "Active"
    },
    "dates": {
      "startDate": "2024-01-15T10:30:00Z",
      "renewalDate": "2024-02-15T10:30:00Z",
      "endDate": null,
      "daysUntilRenewal": 15
    },
    "stripeDetails": {
      "customerId": "cus_XXXXXXXXX",
      "subscriptionId": "sub_XXXXXXXXX"
    },
    "paymentMethod": "Stripe Card",
    "status": "Active"
  }
}
```

### Additional Fields
- **memberSince**: Date user joined the platform
- **daysUntilRenewal**: Number of days until next billing date

---

## 6. Update Subscription

### Endpoint
```
PUT /api/admin/subscriptions/:userId
```

### URL Parameters
```javascript
{
  "userId": "507f1f77bcf86cd799439011"  // MongoDB user ID
}
```

### Request Body
```javascript
{
  "plan": "yearly",                    // 'free', 'monthly', 'yearly'
  "isActive": true,                    // true or false
  "endDate": "2025-01-15T10:30:00Z"   // Optional: ISO date string
}
```

### Example Request
```bash
curl -X PUT "http://localhost:5000/api/admin/subscriptions/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "yearly",
    "isActive": true
  }'
```

### Response (200 OK)
```json
{
  "status": "success",
  "message": "Subscription updated successfully",
  "data": {
    "plan": "yearly",
    "isActive": true,
    "startDate": "2024-01-15T10:30:00Z",
    "endDate": "2025-01-15T10:30:00Z",
    "stripeCustomerId": "cus_XXXXXXXXX",
    "stripeSubscriptionId": "sub_XXXXXXXXX"
  }
}
```

---

## 7. Get Payments

### Endpoint
```
GET /api/admin/payments
```

### Query Parameters
```javascript
{
  "limit": 50,            // Number of payments to retrieve
  "startingAfter": "id"   // For pagination, ID to start after
}
```

### Example Request
```bash
curl -X GET "http://localhost:5000/api/admin/payments?limit=50" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Response (200 OK)
```json
{
  "status": "success",
  "data": [
    {
      "id": "pi_XXXXXXXXX",
      "amount": 10,
      "currency": "usd",
      "status": "succeeded",
      "customer": "john@example.com",
      "created": "2024-01-15T10:30:00Z",
      "description": "monthly subscription"
    },
    {
      "id": "pi_YYYYYYYYY",
      "amount": 100,
      "currency": "usd",
      "status": "succeeded",
      "customer": "jane@example.com",
      "created": "2024-06-20T14:22:00Z",
      "description": "yearly subscription"
    }
  ]
}
```

---

## 8. Get Revenue Stats

### Endpoint
```
GET /api/admin/revenue
```

### Query Parameters
```javascript
{
  "period": "month"  // 'day', 'week', 'month', 'year'
}
```

### Example Request
```bash
curl -X GET "http://localhost:5000/api/admin/revenue?period=month" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "period": "month",
    "revenue": {
      "monthly": 420,
      "yearly": 2000,
      "total": 2420
    },
    "subscriptions": {
      "free": { "total": 150, "active": 145 },
      "monthly": { "total": 42, "active": 42 },
      "yearly": { "total": 20, "active": 20 }
    }
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Invalid transaction ID format"
}
```

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "status": "error",
  "message": "Not authorized. Admin access required."
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "User not found" or "Transaction not found"
}
```

### 500 Server Error
```json
{
  "status": "error",
  "message": "Internal server error"
}
```

---

## Implementation Examples

### Using JavaScript/Axios

```javascript
// Get total subscriptions
const getTotalSubscriptions = async (token) => {
  try {
    const response = await axios.get(
      'http://localhost:5000/api/admin/subscriptions/stats/total',
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('Total Subscriptions:', response.data.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};

// Get monthly revenue
const getMonthlyRevenue = async (token, month = 1, year = 2024) => {
  try {
    const response = await axios.get(
      `http://localhost:5000/api/admin/subscriptions/stats/revenue?month=${month}&year=${year}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('Monthly Revenue:', response.data.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};

// Get recent transactions
const getRecentTransactions = async (token, page = 1, period = 'month') => {
  try {
    const response = await axios.get(
      `http://localhost:5000/api/admin/subscriptions/transactions?page=${page}&period=${period}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('Transactions:', response.data.data.transactions);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};

// Get transaction details
const getTransactionDetail = async (token, transactionId) => {
  try {
    const response = await axios.get(
      `http://localhost:5000/api/admin/subscriptions/transactions/${transactionId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('Transaction Detail:', response.data.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};

// Update subscription
const updateSubscription = async (token, userId, plan) => {
  try {
    const response = await axios.put(
      `http://localhost:5000/api/admin/subscriptions/${userId}`,
      {
        plan: plan,
        isActive: true
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('Subscription updated:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};
```

### Using cURL

```bash
# Get total subscriptions
curl -X GET http://localhost:5000/api/admin/subscriptions/stats/total \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get monthly revenue
curl -X GET "http://localhost:5000/api/admin/subscriptions/stats/revenue?month=1&year=2024" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get recent transactions (filtered)
curl -X GET "http://localhost:5000/api/admin/subscriptions/transactions?period=month&status=active" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get transaction details
curl -X GET "http://localhost:5000/api/admin/subscriptions/transactions/TXN_507f1f77bcf86cd799439011_1705324200000" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Update subscription
curl -X PUT "http://localhost:5000/api/admin/subscriptions/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "yearly", "isActive": true}'
```

---

## Integration Workflow

### 1. Dashboard Overview
```javascript
// Load dashboard data
async function loadDashboard(token) {
  const [total, revenue, transactions] = await Promise.all([
    fetch('/api/admin/subscriptions/stats/total', { headers: { Authorization: token } }).then(r => r.json()),
    fetch('/api/admin/subscriptions/stats/revenue', { headers: { Authorization: token } }).then(r => r.json()),
    fetch('/api/admin/subscriptions/transactions', { headers: { Authorization: token } }).then(r => r.json())
  ]);
  
  return { total, revenue, transactions };
}
```

### 2. Subscription Management
```javascript
// Get subscriptions with filters
async function getSubscriptions(token, filters) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/admin/subscriptions?${params}`, {
    headers: { Authorization: token }
  });
  return response.json();
}

// Update a user's subscription
async function updateUserSubscription(token, userId, plan) {
  const response = await fetch(`/api/admin/subscriptions/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ plan, isActive: true })
  });
  return response.json();
}
```

### 3. Revenue Analytics
```javascript
// Get revenue for specific month
async function getMonthRevenue(token, month, year) {
  const response = await fetch(
    `/api/admin/subscriptions/stats/revenue?month=${month}&year=${year}`,
    { headers: { Authorization: token } }
  );
  return response.json();
}
```

---

## Success Messages

| Code | Message | Meaning |
|------|---------|---------|
| 200 | Operation successful | Request completed successfully |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request successful with no content |
| 400 | Bad Request | Invalid parameters or request format |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | User lacks required admin permissions |
| 404 | Not Found | Resource not found |
| 500 | Server Error | Internal server error |

---

## Rate Limiting

- No specific rate limits currently implemented
- Recommended: Add rate limiting (e.g., 100 requests/minute for admin)

## Pagination

- Default limit: 20 results per page
- Maximum limit: 100 results per page
- Use `page` and `limit` query parameters

## Sorting

- Results are sorted by:
  - Subscriptions: By `endDate` (descending), then `createdAt` (descending)
  - Transactions: By `startDate` (descending)
  - Payments: By creation date (most recent first)

---

## Database Schema Reference

### User Subscription Object
```javascript
{
  subscription: {
    plan: String,                    // 'free', 'monthly', 'yearly'
    isActive: Boolean,               // true or false
    startDate: Date,                 // Subscription start
    endDate: Date,                   // Subscription end (optional)
    stripeCustomerId: String,        // Stripe customer ID
    stripeSubscriptionId: String     // Stripe subscription ID
  }
}
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Currency is always USD unless specified otherwise
- Transaction IDs are generated as: `TXN_{userId}_{timestamp}`
- Profile photos are optional; returns `null` if not set
- Stripe integration is optional; local calculations are used as fallback
- Admin panel requires valid JWT token with admin role
