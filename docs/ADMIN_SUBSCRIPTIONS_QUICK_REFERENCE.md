# Admin Subscriptions - Quick Reference Guide

## 📚 All New Endpoints

### Dashboard Stats
```
GET /api/admin/subscriptions/stats/total
→ Returns: Total users, active users, paid count, conversion rate, breakdown by plan
```

```
GET /api/admin/subscriptions/stats/revenue?month=1&year=2024
→ Returns: Monthly revenue, subscription counts, MRR, average subscription value
```

### Transactions
```
GET /api/admin/subscriptions/transactions?page=1&limit=20&period=month&status=active
→ Returns: List of transactions with customer name, email, photo, plan, amount, dates, status

Query Parameters:
  - page: Page number (default: 1)
  - limit: Results per page (default: 20)
  - period: 'today', 'week', 'month', 'year', 'all'
  - plan: 'monthly', 'yearly', 'all'
  - status: 'active', 'inactive', 'all'
```

```
GET /api/admin/subscriptions/transactions/:transactionId
→ Returns: Detailed transaction info including days until renewal
```

---

## 🎯 What Each Endpoint Returns

### 1. Total Subscriptions (`/stats/total`)
```javascript
{
  totalUsers: 215,              // Total users in system
  totalActive: 207,             // Active users
  totalPaid: 65,                // Paid subscribers (monthly + yearly)
  conversionRate: "30.23%",     // Paid/Total percentage
  
  breakdown: {
    free: { total: 150, active: 145 },
    monthly: { total: 45, active: 42 },
    yearly: { total: 20, active: 20 }
  }
}
```

### 2. Monthly Revenue (`/stats/revenue`)
```javascript
{
  period: "1/2024",
  
  calculatedRevenue: {
    monthlySubscriptions: { count: 42, amount: 420 },
    yearlySubscriptions: { count: 20, amount: 2000 },
    total: 2420
  },
  
  stripeRevenue: {
    totalCharges: 62,
    totalAmount: "2420.00",
    succeededCharges: 62,
    failedCharges: 0
  },
  
  metrics: {
    averageSubscriptionValue: 37.23,
    mrr: 385  // Monthly Recurring Revenue
  }
}
```

### 3. Recent Transactions (`/transactions`)
```javascript
{
  transactions: [
    {
      transactionId: "TXN_507f...811_1705324200000",
      
      customer: {
        id: "507f1f77bcf86cd799439011",
        name: "John Doe",
        email: "john@example.com",
        profilePhoto: "https://..."
      },
      
      subscription: {
        plan: "monthly",           // 'monthly' or 'yearly'
        planName: "Monthly"
      },
      
      payment: {
        amount: 10,                // $10 monthly, $100 yearly
        currency: "USD",
        status: "Active"           // 'Active' or 'Inactive'
      },
      
      dates: {
        startDate: "2024-01-15T10:30:00Z",
        renewalDate: "2024-02-15T10:30:00Z",
        endDate: null
      },
      
      stripeDetails: {
        customerId: "cus_XXXXXXXXX",
        subscriptionId: "sub_XXXXXXXXX"
      },
      
      paymentMethod: "Stripe",    // 'Stripe' or 'Local'
      status: "Active"            // 'Active' or 'Cancelled'
    }
  ],
  
  pagination: {
    page: 1,
    limit: 20,
    total: 65,
    pages: 4
  }
}
```

### 4. Transaction Details (`/transactions/:id`)
```javascript
{
  transactionId: "TXN_507f...811_1705324200000",
  
  customer: {
    id: "507f...",
    name: "John Doe",
    email: "john@example.com",
    profilePhoto: "https://...",
    memberSince: "2023-12-01T08:00:00Z"
  },
  
  subscription: {
    plan: "monthly",
    planName: "Monthly"
  },
  
  payment: {
    amount: 10,
    currency: "USD",
    status: "Active"
  },
  
  dates: {
    startDate: "2024-01-15T10:30:00Z",
    renewalDate: "2024-02-15T10:30:00Z",
    endDate: null,
    daysUntilRenewal: 15  // ← Additional field here
  },
  
  stripeDetails: {
    customerId: "cus_XXXXXXXXX",
    subscriptionId: "sub_XXXXXXXXX"
  },
  
  paymentMethod: "Stripe Card",
  status: "Active"
}
```

---

## 💻 Code Examples

### JavaScript - Get Dashboard Data
```javascript
const token = localStorage.getItem('adminToken');

// Get all dashboard data at once
const [total, revenue, transactions] = await Promise.all([
  fetch('/api/admin/subscriptions/stats/total', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json()),
  
  fetch('/api/admin/subscriptions/stats/revenue', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json()),
  
  fetch('/api/admin/subscriptions/transactions?limit=10', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json())
]);

console.log('Total Subscriptions:', total.data.summary);
console.log('Monthly Revenue:', revenue.data.calculatedRevenue.total);
console.log('Recent Transactions:', transactions.data.transactions);
```

### JavaScript - Filter Transactions
```javascript
// Get active subscriptions from this month
const response = await fetch(
  '/api/admin/subscriptions/transactions?period=month&status=active',
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await response.json();
console.log(data.data.transactions);
```

### JavaScript - Get Transaction Details
```javascript
const transactionId = "TXN_507f1f77bcf86cd799439011_1705324200000";
const response = await fetch(
  `/api/admin/subscriptions/transactions/${transactionId}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await response.json();
console.log(`Customer: ${data.data.customer.name}`);
console.log(`Days until renewal: ${data.data.dates.daysUntilRenewal}`);
```

### React Component
```jsx
import React, { useState, useEffect } from 'react';

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [transactions, setTransactions] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');

    Promise.all([
      fetch('/api/admin/subscriptions/stats/total',
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.json()),
      
      fetch('/api/admin/subscriptions/stats/revenue',
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.json()),
      
      fetch('/api/admin/subscriptions/transactions',
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.json())
    ]).then(([s, r, t]) => {
      setStats(s.data);
      setRevenue(r.data);
      setTransactions(t.data);
    });
  }, []);

  if (!stats || !revenue || !transactions) return <div>Loading...</div>;

  return (
    <div className="admin-dashboard">
      <div className="card">
        <h2>Subscriptions</h2>
        <p>Total Users: {stats.summary.totalUsers}</p>
        <p>Paid: {stats.summary.totalPaid}</p>
        <p>Conversion: {stats.summary.conversionRate}</p>
      </div>

      <div className="card">
        <h2>Revenue</h2>
        <p>Total: ${revenue.calculatedRevenue.total}</p>
        <p>MRR: ${revenue.metrics.mrr.toFixed(2)}</p>
      </div>

      <div className="card">
        <h2>Recent Transactions</h2>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Renewal</th>
            </tr>
          </thead>
          <tbody>
            {transactions.transactions.map(txn => (
              <tr key={txn.transactionId}>
                <td>{txn.customer.name}</td>
                <td>{txn.subscription.planName}</td>
                <td>${txn.payment.amount}</td>
                <td>{txn.status}</td>
                <td>{new Date(txn.dates.renewalDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### cURL - Test Endpoints
```bash
# Test total subscriptions
curl -X GET http://localhost:5000/api/admin/subscriptions/stats/total \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test monthly revenue
curl -X GET "http://localhost:5000/api/admin/subscriptions/stats/revenue?month=1&year=2024" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test recent transactions
curl -X GET "http://localhost:5000/api/admin/subscriptions/transactions?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test with filters
curl -X GET "http://localhost:5000/api/admin/subscriptions/transactions?period=month&status=active" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test transaction details
curl -X GET "http://localhost:5000/api/admin/subscriptions/transactions/TXN_[ID]_[TIMESTAMP]" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔧 Integration Checklist

- [ ] Test each endpoint with Postman or cURL
- [ ] Verify authentication token is working
- [ ] Check response format matches documentation
- [ ] Create React components to display data
- [ ] Add loading states for API calls
- [ ] Add error handling for failed requests
- [ ] Implement pagination for transaction list
- [ ] Add filter functionality
- [ ] Display charts for revenue trends
- [ ] Set up auto-refresh for dashboard

---

## 📊 Display Ideas

### Total Subscriptions Card
```
┌─────────────────────────────┐
│ Subscriptions Overview       │
├─────────────────────────────┤
│ Total Users:        215     │
│ Active Users:       207     │
│ Paid Subscribers:    65     │
│ Conversion Rate:  30.23%    │
└─────────────────────────────┘
```

### Revenue Card
```
┌─────────────────────────────┐
│ January 2024 Revenue        │
├─────────────────────────────┤
│ Monthly Plans:  $420        │
│ Yearly Plans:  $2000        │
│ Total:         $2420        │
│ MRR:            $385        │
└─────────────────────────────┘
```

### Transactions Table
```
Transaction List
┌─────────────────────────────────────────────────────┐
│ Customer   │ Plan    │ Amount │ Status │ Renewal    │
├─────────────────────────────────────────────────────┤
│ John Doe   │ Monthly │ $10    │ Active │ Feb 15     │
│ Jane Smith │ Yearly  │ $100   │ Active │ Jun 20     │
│ Bob Jones  │ Monthly │ $10    │ Cancel │ -          │
└─────────────────────────────────────────────────────┘
```

---

## 🚨 Error Handling

All endpoints return errors in this format:
```json
{
  "status": "error",
  "message": "Error description"
}
```

Common errors:
- **401**: Missing or invalid authentication token
- **403**: User is not admin
- **404**: Resource not found
- **400**: Invalid query parameters
- **500**: Server error

---

## 📌 Important Notes

1. **Transaction ID Format**: `TXN_{userId}_{timestamp}`
   - Used to uniquely identify transactions
   - Can be extracted to get user ID if needed

2. **Renewal Date Calculation**:
   - Monthly: startDate + 1 month
   - Yearly: startDate + 1 year

3. **Days Until Renewal**:
   - Calculated in seconds: `(renewalDate - now) / 86400`
   - Useful for showing upcoming renewals

4. **Stripe Integration**:
   - Optional - system works with or without Stripe
   - Falls back to local calculation if Stripe unavailable
   - `stripeCustomerId` and `stripeSubscriptionId` are references

5. **Profile Photos**:
   - Optional field - returns `null` if not set
   - Stored as URL string

---

## 📖 Full Documentation

For complete endpoint documentation, refer to: `ADMIN_SUBSCRIPTIONS_API.md`

This file includes:
- Detailed endpoint specifications
- Complete request/response examples
- Query parameter descriptions
- Error codes and messages
- Authentication details
- Integration workflows
