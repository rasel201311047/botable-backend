# 🎉 Stripe Checkout Success Implementation Guide

## Overview
This guide explains how to implement the subscription success page that users are redirected to after completing a Stripe checkout.

---

## Understanding the Success URL

When a user completes checkout on Stripe, they are redirected to your success URL with a `session_id` parameter:

```
http://localhost:3000/subscription/success?session_id=cs_test_a1jyaAIrQ1lqJNZfNJPrPX1vHwp9Y7prEaQvHwMHJppBsRRnNIClyv7J4L
```

### URL Components:
- **Base URL**: `http://localhost:3000/subscription/success`
- **Query Parameter**: `session_id` - Unique Stripe checkout session ID
- **Purpose**: Verify the subscription was successful and update user account

---

## Implementation Steps

### Step 1: Create Backend Endpoint to Verify Session

**File**: `modules/subscription/subscription.controller.js`

```javascript
/**
 * @desc    Handle subscription success after Stripe checkout
 * @route   GET /api/subscription/verify-session/:sessionId
 * @access  Private
 */
static async verifyCheckoutSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        status: 'error',
        message: 'Session ID is required'
      });
    }

    // Call Stripe to verify the session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Checkout session not found'
      });
    }

    // Verify the session belongs to the user
    if (session.metadata.customerId !== req.user.stripeCustomerId) {
      return res.status(403).json({
        status: 'error',
        message: 'This session does not belong to you'
      });
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        status: 'error',
        message: 'Payment was not completed',
        sessionStatus: session.payment_status
      });
    }

    // Get subscription details from Stripe
    const subscriptionId = session.subscription;
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Update user in database
    const user = await User.findById(userId);
    
    // Determine plan from price
    let plan = 'monthly';
    const priceId = stripeSubscription.items.data[0].price.id;
    const subscriptionPlan = await SubscriptionPlan.findOne({ stripePriceId: priceId });
    
    if (subscriptionPlan) {
      plan = subscriptionPlan.name;
    }

    // Update user subscription
    user.subscription.plan = plan;
    user.subscription.isActive = true;
    user.subscription.stripeCustomerId = session.customer;
    user.subscription.stripeSubscriptionId = subscriptionId;
    user.subscription.startDate = new Date();
    user.subscription.endDate = new Date(stripeSubscription.current_period_end * 1000);
    
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Subscription activated successfully',
      data: {
        plan: plan,
        isActive: true,
        startDate: user.subscription.startDate,
        endDate: user.subscription.endDate,
        sessionId: sessionId
      }
    });
  } catch (error) {
    next(error);
  }
}
```

### Step 2: Add Route

**File**: `modules/subscription/subscription.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth.middleware');
const SubscriptionController = require('./subscription.controller');

// ... existing routes ...

// Verify checkout session after Stripe redirect
router.get('/verify-session/:sessionId', protect, SubscriptionController.verifyCheckoutSession);

module.exports = router;
```

---

## Frontend Implementation

### Option 1: React with React Router

**File**: `src/pages/SubscriptionSuccess.jsx`

```javascript
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscription, setSubscription] = useState(null);

  // Get session_id from URL query params
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verifySubscription = async () => {
      try {
        if (!sessionId) {
          setError('No session ID found');
          setLoading(false);
          return;
        }

        // Call backend to verify the session
        const response = await axios.get(
          `/api/subscription/verify-session/${sessionId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('authToken')}`
            }
          }
        );

        if (response.data.status === 'success') {
          setSubscription(response.data.data);
          setLoading(false);

          // Redirect to dashboard after 3 seconds
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        }
      } catch (err) {
        console.error('Verification error:', err);
        setError(err.response?.data?.message || 'Failed to verify subscription');
        setLoading(false);
      }
    };

    verifySubscription();
  }, [sessionId, navigate]);

  if (loading) {
    return (
      <div className="success-container loading">
        <div className="spinner"></div>
        <h2>Verifying your subscription...</h2>
        <p>Please wait while we confirm your payment.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="success-container error">
        <div className="error-icon">❌</div>
        <h2>Verification Failed</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/subscription')}>
          Back to Subscription
        </button>
      </div>
    );
  }

  return (
    <div className="success-container">
      <div className="success-icon">✅</div>
      <h2>Subscription Activated!</h2>
      
      <div className="subscription-details">
        <p className="plan-name">
          <strong>Plan:</strong> {subscription.plan.toUpperCase()}
        </p>
        <p className="start-date">
          <strong>Start Date:</strong> {new Date(subscription.startDate).toLocaleDateString()}
        </p>
        <p className="end-date">
          <strong>Renewal Date:</strong> {new Date(subscription.endDate).toLocaleDateString()}
        </p>
      </div>

      <div className="success-message">
        <h3>Thank you for subscribing!</h3>
        <p>Your subscription is now active. You can access all premium features.</p>
        <p>Redirecting to dashboard in 3 seconds...</p>
      </div>

      <button 
        onClick={() => navigate('/dashboard')}
        className="btn-primary"
      >
        Go to Dashboard Now
      </button>
    </div>
  );
};

export default SubscriptionSuccess;
```

**Styling**: `src/pages/SubscriptionSuccess.css`

```css
.success-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.success-icon {
  font-size: 80px;
  margin-bottom: 20px;
  animation: bounce 1s ease-in-out;
}

.error-icon {
  font-size: 80px;
  margin-bottom: 20px;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

.success-container h2 {
  color: white;
  font-size: 32px;
  margin-bottom: 30px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.subscription-details {
  background: white;
  border-radius: 10px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  min-width: 300px;
}

.subscription-details p {
  margin: 15px 0;
  font-size: 16px;
  color: #333;
}

.plan-name {
  font-size: 20px;
  color: #667eea;
}

.success-message {
  background: white;
  border-radius: 10px;
  padding: 30px;
  text-align: center;
  margin-bottom: 30px;
  max-width: 500px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.success-message h3 {
  color: #333;
  margin-bottom: 15px;
}

.success-message p {
  color: #666;
  margin: 10px 0;
}

.btn-primary {
  background-color: #667eea;
  color: white;
  border: none;
  padding: 12px 40px;
  font-size: 16px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-primary:hover {
  background-color: #764ba2;
}

.success-container.loading {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.success-container.error {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.success-container.error h2 {
  color: white;
}

.success-container.error p {
  color: white;
}

.success-container.error .btn-primary {
  background-color: #f5576c;
}

.success-container.error .btn-primary:hover {
  background-color: #f093fb;
}
```

### Option 2: Vue 3 with Vue Router

**File**: `src/views/SubscriptionSuccess.vue`

```vue
<template>
  <div class="success-container" v-if="!loading">
    <!-- Error State -->
    <div v-if="error" class="error-state">
      <div class="error-icon">❌</div>
      <h2>Verification Failed</h2>
      <p>{{ error }}</p>
      <button @click="goBack" class="btn-primary">
        Back to Subscription
      </button>
    </div>

    <!-- Success State -->
    <div v-else class="success-state">
      <div class="success-icon">✅</div>
      <h2>Subscription Activated!</h2>

      <div class="subscription-details">
        <p class="plan-name">
          <strong>Plan:</strong> {{ subscription.plan.toUpperCase() }}
        </p>
        <p class="start-date">
          <strong>Start Date:</strong> {{ formatDate(subscription.startDate) }}
        </p>
        <p class="end-date">
          <strong>Renewal Date:</strong> {{ formatDate(subscription.endDate) }}
        </p>
      </div>

      <div class="success-message">
        <h3>Thank you for subscribing!</h3>
        <p>Your subscription is now active. You can access all premium features.</p>
        <p>Redirecting to dashboard in {{ countdown }} seconds...</p>
      </div>

      <button 
        @click="goToDashboard"
        class="btn-primary"
      >
        Go to Dashboard Now
      </button>
    </div>
  </div>

  <!-- Loading State -->
  <div v-else class="success-container loading">
    <div class="spinner"></div>
    <h2>Verifying your subscription...</h2>
    <p>Please wait while we confirm your payment.</p>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

export default {
  name: 'SubscriptionSuccess',
  setup() {
    const router = useRouter();
    const loading = ref(true);
    const error = ref(null);
    const subscription = ref(null);
    const countdown = ref(3);

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const getSessionId = () => {
      const params = new URLSearchParams(window.location.search);
      return params.get('session_id');
    };

    const verifySubscription = async () => {
      try {
        const sessionId = getSessionId();

        if (!sessionId) {
          error.value = 'No session ID found';
          loading.value = false;
          return;
        }

        const response = await axios.get(
          `/api/subscription/verify-session/${sessionId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('authToken')}`
            }
          }
        );

        if (response.data.status === 'success') {
          subscription.value = response.data.data;
          loading.value = false;

          // Start countdown
          startCountdown();
        }
      } catch (err) {
        console.error('Verification error:', err);
        error.value = err.response?.data?.message || 'Failed to verify subscription';
        loading.value = false;
      }
    };

    const startCountdown = () => {
      const interval = setInterval(() => {
        countdown.value--;
        if (countdown.value === 0) {
          clearInterval(interval);
          goToDashboard();
        }
      }, 1000);
    };

    const goToDashboard = () => {
      router.push('/dashboard');
    };

    const goBack = () => {
      router.push('/subscription');
    };

    onMounted(() => {
      verifySubscription();
    });

    return {
      loading,
      error,
      subscription,
      countdown,
      formatDate,
      goToDashboard,
      goBack
    };
  }
};
</script>

<style scoped>
.success-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.success-icon {
  font-size: 80px;
  margin-bottom: 20px;
  animation: bounce 1s ease-in-out;
}

.error-icon {
  font-size: 80px;
  margin-bottom: 20px;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

h2 {
  color: white;
  font-size: 32px;
  margin-bottom: 30px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.subscription-details {
  background: white;
  border-radius: 10px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  min-width: 300px;
}

.subscription-details p {
  margin: 15px 0;
  font-size: 16px;
  color: #333;
}

.plan-name {
  font-size: 20px;
  color: #667eea;
}

.success-message {
  background: white;
  border-radius: 10px;
  padding: 30px;
  text-align: center;
  margin-bottom: 30px;
  max-width: 500px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.success-message h3 {
  color: #333;
  margin-bottom: 15px;
}

.success-message p {
  color: #666;
  margin: 10px 0;
}

.btn-primary {
  background-color: #667eea;
  color: white;
  border: none;
  padding: 12px 40px;
  font-size: 16px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-primary:hover {
  background-color: #764ba2;
}

.success-container.loading {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state h2 {
  color: white;
}

.error-state p {
  color: white;
  font-size: 16px;
}
</style>
```

### Option 3: Plain HTML/JavaScript

**File**: `public/subscription-success.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Success - Bootble</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      text-align: center;
      max-width: 500px;
      width: 100%;
    }

    .success-icon {
      font-size: 80px;
      margin-bottom: 20px;
      animation: bounce 1s ease-in-out;
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }

    h2 {
      color: white;
      font-size: 32px;
      margin-bottom: 30px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .card {
      background: white;
      border-radius: 10px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }

    .details-item {
      margin: 15px 0;
      font-size: 16px;
      color: #333;
      text-align: left;
    }

    .details-item strong {
      color: #667eea;
    }

    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading h2 {
      color: white;
    }

    .loading p {
      color: white;
    }

    .success-message {
      color: #666;
      line-height: 1.6;
    }

    .success-message h3 {
      color: #333;
      margin-bottom: 15px;
    }

    .success-message p {
      margin: 10px 0;
    }

    button {
      background-color: #667eea;
      color: white;
      border: none;
      padding: 12px 40px;
      font-size: 16px;
      border-radius: 5px;
      cursor: pointer;
      transition: background-color 0.3s;
    }

    button:hover {
      background-color: #764ba2;
    }

    .error {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .error h2 {
      color: white;
    }

    .error p {
      color: white;
    }

    .error-icon {
      font-size: 80px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container" id="app">
    <!-- Loading state -->
    <div id="loading" class="loading">
      <div class="spinner"></div>
      <h2>Verifying your subscription...</h2>
      <p>Please wait while we confirm your payment.</p>
    </div>
  </div>

  <script>
    // Get session ID from URL
    function getSessionId() {
      const params = new URLSearchParams(window.location.search);
      return params.get('session_id');
    }

    // Format date
    function formatDate(dateString) {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // Show loading state
    function showLoading() {
      const app = document.getElementById('app');
      app.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <h2>Verifying your subscription...</h2>
          <p>Please wait while we confirm your payment.</p>
        </div>
      `;
    }

    // Show success state
    function showSuccess(subscription) {
      const app = document.getElementById('app');
      app.innerHTML = `
        <div class="success-icon">✅</div>
        <h2>Subscription Activated!</h2>
        
        <div class="card">
          <div class="details-item">
            <strong>Plan:</strong> ${subscription.plan.toUpperCase()}
          </div>
          <div class="details-item">
            <strong>Start Date:</strong> ${formatDate(subscription.startDate)}
          </div>
          <div class="details-item">
            <strong>Renewal Date:</strong> ${formatDate(subscription.endDate)}
          </div>
        </div>

        <div class="card success-message">
          <h3>Thank you for subscribing!</h3>
          <p>Your subscription is now active. You can access all premium features.</p>
          <p>Redirecting to dashboard in <span id="countdown">3</span> seconds...</p>
        </div>

        <button onclick="window.location.href='/dashboard'">
          Go to Dashboard Now
        </button>
      `;

      // Start countdown
      let count = 3;
      setInterval(() => {
        count--;
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
          countdownEl.textContent = count;
        }
        if (count === 0) {
          window.location.href = '/dashboard';
        }
      }, 1000);
    }

    // Show error state
    function showError(message) {
      const app = document.getElementById('app');
      app.innerHTML = `
        <div class="error">
          <div class="error-icon">❌</div>
          <h2>Verification Failed</h2>
          <p>${message}</p>
          <button onclick="window.location.href='/subscription'">
            Back to Subscription
          </button>
        </div>
      `;
    }

    // Verify subscription
    async function verifySubscription() {
      try {
        const sessionId = getSessionId();

        if (!sessionId) {
          showError('No session ID found');
          return;
        }

        // Get auth token from localStorage
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
          showError('Not authenticated. Please log in again.');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }

        // Call backend API
        const response = await fetch(`/api/subscription/verify-session/${sessionId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
          showSuccess(data.data);
        } else {
          showError(data.message || 'Failed to verify subscription');
        }
      } catch (error) {
        console.error('Error:', error);
        showError('An error occurred while verifying your subscription');
      }
    }

    // Start verification on page load
    showLoading();
    setTimeout(verifySubscription, 1000);
  </script>
</body>
</html>
```

---

## Router Configuration

### React Router Example

```javascript
// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SubscriptionSuccess from './pages/SubscriptionSuccess';

function App() {
  return (
    <Router>
      <Routes>
        {/* ... other routes ... */}
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
      </Routes>
    </Router>
  );
}

export default App;
```

### Vue Router Example

```javascript
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import SubscriptionSuccess from '../views/SubscriptionSuccess.vue';

const routes = [
  // ... other routes ...
  {
    path: '/subscription/success',
    name: 'SubscriptionSuccess',
    component: SubscriptionSuccess,
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
```

---

## Complete Backend Flow

### File: `modules/subscription/subscription.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth.middleware');
const SubscriptionController = require('./subscription.controller');

// Public routes
router.get('/plans', SubscriptionController.getPlans);

// Protected routes
router.use(protect);

router.get('/', SubscriptionController.getUserSubscription);
router.post('/checkout', SubscriptionController.createCheckoutSession);
router.get('/verify-session/:sessionId', SubscriptionController.verifyCheckoutSession);
router.post('/portal', SubscriptionController.createPortalSession);
router.delete('/cancel', SubscriptionController.cancelSubscription);

module.exports = router;
```

---

## Testing the Flow

### 1. Create Checkout Session
```bash
curl -X POST http://localhost:5000/api/subscription/checkout \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "monthly"}'

# Response:
# {
#   "status": "success",
#   "data": {
#     "sessionId": "cs_test_...",
#     "url": "https://checkout.stripe.com/pay/cs_test_..."
#   }
# }
```

### 2. User Completes Stripe Checkout
- User clicks the checkout URL
- Completes payment on Stripe
- Redirected to: `http://localhost:3000/subscription/success?session_id=cs_test_...`

### 3. Frontend Verifies Session
- Extracts `session_id` from URL
- Calls backend: `GET /api/subscription/verify-session/{sessionId}`
- Backend verifies with Stripe
- Updates user subscription in database
- Returns success response

### 4. Display Success Message
- Show subscription details
- Auto-redirect to dashboard after 3 seconds

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "No session ID found" | URL doesn't have `?session_id=...` | Check Stripe success URL config |
| "Not authenticated" | User not logged in | Redirect to login page |
| "This session does not belong to you" | Session belongs to different user | Security check - prevent unauthorized access |
| "Payment was not completed" | Payment failed or pending | Show error and allow retry |
| "Checkout session not found" | Invalid or expired session ID | Redirect to subscription page |

---

## Security Best Practices

### ✅ DO:
- Always verify auth token before processing
- Validate session_id format
- Verify session belongs to authenticated user
- Verify payment_status is "paid"
- Store sensitive data (subscription IDs) only on backend
- Use HTTPS in production

### ❌ DON'T:
- Trust session_id without verification
- Skip authentication checks
- Store auth tokens in URL
- Expose Stripe subscription IDs on frontend
- Allow users to modify subscription data directly

---

## Environment Variables

Add to `.env`:

```
# Frontend
REACT_APP_API_URL=http://localhost:5000
REACT_APP_APP_URL=http://localhost:3000

# Backend
APP_URL=http://localhost:3000
STRIPE_SUCCESS_URL=http://localhost:3000/subscription/success
STRIPE_CANCEL_URL=http://localhost:3000/subscription/cancel
```

---

## Deployment Considerations

### Production URLs

Change localhost to your domain:

```
# Development
STRIPE_SUCCESS_URL=http://localhost:3000/subscription/success

# Production
STRIPE_SUCCESS_URL=https://yourdomain.com/subscription/success
STRIPE_CANCEL_URL=https://yourdomain.com/subscription/cancel
```

Update in **config/stripe.js** or **subscription.service.js**:

```javascript
const successUrl = `${process.env.APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl = `${process.env.APP_URL}/subscription/cancel`;
```

---

## Summary

### Frontend Flow:
1. ✅ User completes checkout on Stripe
2. ✅ Redirected to `/subscription/success?session_id={id}`
3. ✅ Frontend extracts `session_id` from URL
4. ✅ Calls backend API to verify session
5. ✅ Backend verifies with Stripe
6. ✅ Updates user subscription in database
7. ✅ Display success message with subscription details
8. ✅ Auto-redirect to dashboard

### Key Points:
- Session ID is the **only** parameter from Stripe
- Always verify session on backend
- Never trust frontend-only verification
- Store all subscription data on backend
- Use secure authentication for API calls
