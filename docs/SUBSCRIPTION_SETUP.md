# Subscription Setup Instructions

## Overview

This guide explains how to configure Stripe subscription pricing for your Bootble application.

## Database-Driven Approach

The subscription system now uses MongoDB to store subscription plans and their associated Stripe price IDs.
This allows you to update pricing without restarting the server.

## Step 1: Initial Setup

When the application starts, it automatically initializes three subscription plans in the database:

- **Free**: $0 - Free plan with basic features
- **Monthly**: $10 - Monthly subscription
- **Yearly**: $100 - Yearly subscription

## Step 2: Get YOUR Stripe Price IDs

⚠️ **IMPORTANT: You MUST use your actual Stripe price IDs from YOUR Stripe account. The examples below are NOT
real and will NOT work!**

### How to Get Your Real Price IDs:

1. **Log in to your Stripe Dashboard**: https://dashboard.stripe.com
2. Navigate to **Products** in the left sidebar
3. **Create a new product** if you haven't already:
    - Click "Add product"
    - Name: "Bootble Subscription"
    - Description: Your app description
4. **Add pricing tiers**:
    - Click "Add another price"
    - For Monthly: Set $10/month, click "Save"
    - Add another: Set $100/year, click "Save"
5. **Copy the ACTUAL price IDs**:
    - Click on each price
    - Copy the ID that starts with `price_` (it will be unique to your account)
    - Example format (yours will be different): `price_1QRst2Xyz3ABCdef4GHI`

### Example (DO NOT USE THESE - THEY ARE NOT REAL!):

- ❌ Monthly Price ID: `price_1ABCDE1234567890` (THIS IS FAKE)
- ❌ Yearly Price ID: `price_0FEDCBA9876543210` (THIS IS FAKE)

### Your Actual Price IDs will look like:

- ✅ Monthly Price ID: `price_1QRst2Xyz3ABCdef4GHI` (YOUR REAL ID)
- ✅ Yearly Price ID: `price_1JKlm3Nop4QRStuv5Wxy` (YOUR REAL ID)

## Step 3: Update Subscription Plans with Stripe Price IDs

### Option A: Using Admin API (Recommended)

#### Get all subscription plans:

```bash
curl -X GET http://localhost:5000/api/admin/subscription-plans \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Update monthly plan with Stripe price ID:

```bash
curl -X PUT http://localhost:5000/api/admin/subscription-plans/{PLAN_ID}/stripe-price \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stripePriceId": "price_1ABCDE1234567890"}'
```

#### Update yearly plan with Stripe price ID:

```bash
curl -X PUT http://localhost:5000/api/admin/subscription-plans/{PLAN_ID}/stripe-price \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stripePriceId": "price_0FEDCBA9876543210"}'
```

### Option B: Direct Database Update

You can also update the plans directly in MongoDB:

```javascript
db.subscriptionplans.updateOne({ name: 'monthly' }, { $set: { stripePriceId: 'price_1ABCDE1234567890' } });

db.subscriptionplans.updateOne({ name: 'yearly' }, { $set: { stripePriceId: 'price_0FEDCBA9876543210' } });
```

## Step 4: Verify Configuration

1. Call the plans endpoint to verify Stripe price IDs are set:

```bash
curl http://localhost:5000/api/subscription/plans
```

2. You should see the response with populated `stripePriceId` values:

```json
{
  "status": "success",
  "data": {
    "free": {
      "name": "Free",
      "price": 0,
      "stripePriceId": null,
      "features": [...]
    },
    "monthly": {
      "name": "Monthly",
      "price": 10,
      "stripePriceId": "price_1ABCDE1234567890",
      "features": [...]
    },
    "yearly": {
      "name": "Yearly",
      "price": 100,
      "stripePriceId": "price_0FEDCBA9876543210",
      "features": [...]
    }
  }
}
```

## Step 5: Test Checkout

Once Stripe price IDs are configured:

1. Create a checkout session:

```bash
curl -X POST http://localhost:5000/api/subscription/checkout \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "monthly"}'
```

## Troubleshooting

### Error: "No such price: 'price_0FEDCBA9876543210'" (or similar)

**This is the most common error!**

**Problem**: You used the example price ID from this documentation instead of your actual Stripe price ID.

**Solution**:

1. The example IDs in this documentation (`price_1ABCDE...`, `price_0FEDCBA...`) are **fake placeholders**
2. You MUST go to your Stripe Dashboard and get YOUR actual price IDs
3. Your price IDs will be completely different from the examples
4. Update the database with your real price IDs using the admin API

**Steps to fix**:

```bash
# 1. Go to https://dashboard.stripe.com/products
# 2. Find your product and copy the ACTUAL price IDs
# 3. Update your database with the REAL IDs:

curl -X PUT http://localhost:5000/api/admin/subscription-plans/{PLAN_ID}/stripe-price \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stripePriceId": "YOUR_ACTUAL_PRICE_ID_FROM_STRIPE"}'
```

### Error: "No such price: 'price_yearly'" or null

- The Stripe price ID is not configured in the database
- Update the plan with your Stripe price ID from your dashboard

### Error: "Stripe not configured"

- Ensure `STRIPE_SECRET_KEY` is set in your `.env` file
- The API requires this for Stripe operations

### Subscription plan not found

- Ensure the database is properly initialized
- Check MongoDB connection

## Environment Variables Required

```
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_PUBLIC_KEY=pk_test_YOUR_PUBLIC_KEY
APP_URL=http://localhost:3000
```

## Admin Endpoints

### GET /api/admin/subscription-plans

Get all subscription plans with their Stripe price IDs

### GET /api/admin/subscription-plans/:id

Get a specific subscription plan

### PUT /api/admin/subscription-plans/:id/stripe-price

Update Stripe price ID for a plan

**Request body:**

```json
{
    "stripePriceId": "price_1ABCDE1234567890"
}
```

### PUT /api/admin/subscription-plans/:id

Update all properties of a subscription plan

**Request body:**

```json
{
    "stripePriceId": "price_1ABCDE1234567890",
    "price": 10,
    "currency": "usd",
    "interval": "month",
    "features": ["Feature 1", "Feature 2"],
    "isActive": true
}
```

## Notes

- The system now validates that Stripe price IDs are configured before attempting checkout
- Clear error messages guide you to configure missing Stripe price IDs
- All plans are stored in MongoDB and can be updated in real-time
