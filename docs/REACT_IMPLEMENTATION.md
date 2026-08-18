# Complete React Implementation Example

This file contains a complete working example of subscription checkout and success handling in React.

## Project Structure

```
src/
├── components/
│   ├── SubscriptionPlans.jsx
│   ├── CheckoutButton.jsx
│   └── SubscriptionSuccess.jsx
├── pages/
│   └── SubscriptionPage.jsx
├── services/
│   └── subscriptionService.js
├── hooks/
│   └── useSubscription.js
└── styles/
    ├── SubscriptionPlans.css
    └── SubscriptionSuccess.css
```

---

## 1. Subscription Service (API calls)

**File: `src/services/subscriptionService.js`**

```javascript
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const subscriptionService = {
  // Get all subscription plans
  getPlans: async () => {
    const response = await axios.get(`${API_URL}/api/subscription/plans`);
    return response.data;
  },

  // Get user's current subscription
  getUserSubscription: async (token) => {
    const response = await axios.get(`${API_URL}/api/subscription`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  },

  // Create checkout session
  createCheckoutSession: async (plan, token) => {
    const response = await axios.post(
      `${API_URL}/api/subscription/checkout`,
      { plan },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  },

  // Verify checkout session (after Stripe redirect)
  verifyCheckoutSession: async (sessionId, token) => {
    const response = await axios.get(
      `${API_URL}/api/subscription/verify-session/${sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  },

  // Check if user has premium access
  checkPremiumAccess: async (token) => {
    const response = await axios.get(
      `${API_URL}/api/subscription/check-access`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  },

  // Create portal session (for managing subscription)
  createPortalSession: async (token) => {
    const response = await axios.post(
      `${API_URL}/api/subscription/portal`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  },

  // Cancel subscription
  cancelSubscription: async (token) => {
    const response = await axios.post(
      `${API_URL}/api/subscription/cancel`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    return response.data;
  }
};

export default subscriptionService;
```

---

## 2. Custom Hook (useSubscription)

**File: `src/hooks/useSubscription.js`**

```javascript
import { useState, useEffect } from 'react';
import subscriptionService from '../services/subscriptionService';

export const useSubscription = (token) => {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch plans on mount
  useEffect(() => {
    fetchPlans();
  }, []);

  // Fetch user subscription when token changes
  useEffect(() => {
    if (token) {
      fetchUserSubscription();
    }
  }, [token]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await subscriptionService.getPlans();
      setPlans(data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load plans');
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSubscription = async () => {
    try {
      const data = await subscriptionService.getUserSubscription(token);
      setSubscription(data.data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
    }
  };

  const initiateCheckout = async (plan) => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriptionService.createCheckoutSession(plan, token);
      
      if (response.data.url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.url;
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create checkout session');
      console.error('Error creating checkout:', err);
    } finally {
      setLoading(false);
    }
  };

  const verifySession = async (sessionId) => {
    try {
      setLoading(true);
      const response = await subscriptionService.verifyCheckoutSession(sessionId, token);
      setSubscription(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify session');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    plans,
    subscription,
    loading,
    error,
    fetchPlans,
    fetchUserSubscription,
    initiateCheckout,
    verifySession
  };
};
```

---

## 3. Plans Component

**File: `src/components/SubscriptionPlans.jsx`**

```javascript
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import CheckoutButton from './CheckoutButton';
import '../styles/SubscriptionPlans.css';

const SubscriptionPlans = () => {
  const { user, token } = useAuth();
  const { plans, subscription, loading, error, initiateCheckout } = useSubscription(token);

  if (loading) {
    return <div className="subscription-loading">Loading plans...</div>;
  }

  if (error) {
    return <div className="subscription-error">Error: {error}</div>;
  }

  return (
    <div className="subscription-container">
      <div className="header">
        <h1>Choose Your Plan</h1>
        <p>Upgrade to unlock premium features</p>
      </div>

      <div className="plans-grid">
        {Object.entries(plans).map(([key, plan]) => (
          <div key={key} className="plan-card">
            <div className="plan-badge">{plan.name}</div>
            
            <div className="plan-price">
              ${plan.price}
              {plan.interval && <span className="interval">/{plan.interval}</span>}
            </div>

            <div className="plan-features">
              <h3>Features:</h3>
              <ul>
                {plan.features?.map((feature, idx) => (
                  <li key={idx}>
                    <span className="checkmark">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="plan-action">
              {key === 'free' ? (
                <button className="btn-primary" disabled>
                  Current Plan
                </button>
              ) : subscription?.plan === key ? (
                <button className="btn-secondary" disabled>
                  Active Plan
                </button>
              ) : (
                <CheckoutButton
                  plan={key}
                  onCheckout={() => initiateCheckout(key)}
                  loading={loading}
                >
                  Get {plan.name}
                </CheckoutButton>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionPlans;
```

---

## 4. Checkout Button Component

**File: `src/components/CheckoutButton.jsx`**

```javascript
import React, { useState } from 'react';

const CheckoutButton = ({ plan, onCheckout, loading, children }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    try {
      setIsLoading(true);
      await onCheckout();
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className="btn-primary btn-checkout"
      onClick={handleClick}
      disabled={loading || isLoading}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
};

export default CheckoutButton;
```

---

## 5. Success Component (Most Important!)

**File: `src/components/SubscriptionSuccess.jsx`**

```javascript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import '../styles/SubscriptionSuccess.css';

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { verifySession } = useSubscription(token);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const handleVerification = async () => {
      try {
        // Extract session_id from URL
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id');

        if (!sessionId) {
          setError('No session ID found in URL');
          setLoading(false);
          return;
        }

        if (!token) {
          setError('Not authenticated. Please log in again.');
          setLoading(false);
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        // Verify the session with backend
        const data = await verifySession(sessionId);
        setSubscription(data);
        setLoading(false);

        // Start countdown
        startCountdown();
      } catch (err) {
        console.error('Verification error:', err);
        setError(err.message || 'Failed to verify subscription');
        setLoading(false);
      }
    };

    handleVerification();
  }, [token, verifySession, navigate]);

  const startCountdown = () => {
    let counter = 3;
    const interval = setInterval(() => {
      counter--;
      setCountdown(counter);
      
      if (counter === 0) {
        clearInterval(interval);
        navigate('/dashboard');
      }
    }, 1000);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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
        <button onClick={() => navigate('/subscription')} className="btn-primary">
          Back to Subscription Plans
        </button>
      </div>
    );
  }

  return (
    <div className="success-container">
      <div className="success-icon">✅</div>
      <h2>Subscription Activated!</h2>

      <div className="subscription-details">
        <div className="detail-row">
          <span className="label">Plan:</span>
          <span className="value">{subscription?.plan?.toUpperCase()}</span>
        </div>
        <div className="detail-row">
          <span className="label">Start Date:</span>
          <span className="value">{formatDate(subscription?.startDate)}</span>
        </div>
        <div className="detail-row">
          <span className="label">Renewal Date:</span>
          <span className="value">{formatDate(subscription?.endDate)}</span>
        </div>
      </div>

      <div className="success-message">
        <h3>Thank you for subscribing!</h3>
        <p>Your subscription is now active.</p>
        <p>You can now access all premium features of Bootble.</p>
        <p className="countdown">
          Redirecting to dashboard in <strong>{countdown}</strong> seconds...
        </p>
      </div>

      <button
        onClick={() => navigate('/dashboard')}
        className="btn-primary btn-large"
      >
        Go to Dashboard Now
      </button>
    </div>
  );
};

export default SubscriptionSuccess;
```

---

## 6. Styling

**File: `src/styles/SubscriptionPlans.css`**

```css
.subscription-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.header {
  text-align: center;
  margin-bottom: 50px;
}

.header h1 {
  font-size: 40px;
  color: #333;
  margin-bottom: 10px;
}

.header p {
  font-size: 18px;
  color: #666;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
  margin-top: 40px;
}

.plan-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  padding: 30px;
  transition: all 0.3s ease;
  position: relative;
}

.plan-card:hover {
  border-color: #667eea;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.1);
  transform: translateY(-5px);
}

.plan-badge {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 15px;
  text-transform: uppercase;
}

.plan-price {
  font-size: 40px;
  font-weight: bold;
  color: #333;
  margin: 20px 0;
}

.plan-price .interval {
  font-size: 14px;
  color: #666;
  margin-left: 5px;
}

.plan-features h3 {
  font-size: 16px;
  margin-bottom: 15px;
  color: #333;
}

.plan-features ul {
  list-style: none;
  padding: 0;
}

.plan-features li {
  padding: 8px 0;
  color: #666;
  display: flex;
  align-items: center;
}

.checkmark {
  color: #4CAF50;
  margin-right: 10px;
  font-weight: bold;
}

.plan-action {
  margin-top: 30px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  width: 100%;
  padding: 12px;
  background: #f0f0f0;
  color: #666;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  font-weight: bold;
  cursor: not-allowed;
}

.subscription-loading,
.subscription-error {
  text-align: center;
  padding: 40px;
  font-size: 18px;
}

.subscription-error {
  color: #f5576c;
}
```

**File: `src/styles/SubscriptionSuccess.css`**

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

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #e0e0e0;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .label {
  font-weight: bold;
  color: #666;
}

.detail-row .value {
  color: #667eea;
  font-weight: bold;
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
  font-size: 20px;
}

.success-message p {
  color: #666;
  margin: 10px 0;
  line-height: 1.6;
}

.countdown {
  font-size: 14px;
  color: #667eea;
}

.btn-large {
  width: 300px;
  padding: 15px;
  font-size: 18px;
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

.success-container.loading h2,
.success-container.loading p {
  color: white;
}

.success-container.error {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.success-container.error h2 {
  color: white;
}

.success-container.error p {
  color: white;
  font-size: 16px;
}

.success-container.error .btn-primary {
  width: 300px;
}
```

---

## 7. Router Setup

**File: `src/App.jsx`**

```javascript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SubscriptionPlans from './components/SubscriptionPlans';
import SubscriptionSuccess from './components/SubscriptionSuccess';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/subscription" element={<SubscriptionPlans />} />
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
```

---

## Usage Flow

1. **User visits subscription page** → Sees available plans
2. **User clicks "Get Plan"** → Redirected to Stripe checkout
3. **User completes payment** → Stripe redirects to `/subscription/success?session_id=...`
4. **Success page loads** → Verifies session with backend
5. **Backend updates user subscription** → Stores in database
6. **Show success message** → Auto-redirects to dashboard

---

## Testing

```bash
# 1. Start the backend server
npm run dev

# 2. Start the React app
npm start

# 3. Navigate to http://localhost:3000/subscription

# 4. Click on a plan → redirects to Stripe
# 5. Use test card: 4242 4242 4242 4242
# 6. Complete payment
# 7. Auto-redirected to success page
```
