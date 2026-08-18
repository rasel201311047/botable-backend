# 🚨 QUICK FIX: Stripe Price ID Error

## You're seeing this error:
```
Error: No such price: 'price_0FEDCBA9876543210'
```

## Why?
You used an **EXAMPLE** price ID from the documentation. That's not a real price ID!

## ✅ Solution (3 Steps):

### Step 1: Get YOUR Actual Stripe Price IDs
1. Open: **https://dashboard.stripe.com/test/products**
2. Click **"Add product"** or select existing product
3. Add pricing:
   - Add price: **$10/month** → Click "Save"
   - Add another price: **$100/year** → Click "Save"
4. **COPY the actual price IDs** (click on each price to see its ID)
   - They look like: `price_1QxYz2ABcd3EFgh4IJkl`
   - Write them down!

### Step 2: Run the Setup Script
```bash
node scripts/setup-stripe-prices.js
```

This will guide you to enter your actual price IDs.

### Step 3: Verify
```bash
curl http://localhost:5000/api/subscription/plans
```

You should see YOUR actual price IDs in the response.

---

## 🎯 Manual Method (Alternative)

If you prefer to do it manually:

```bash
# 1. Get your subscription plan IDs
curl -X GET http://localhost:5000/api/admin/subscription-plans \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 2. Update monthly plan (replace {PLAN_ID} and use YOUR actual price ID)
curl -X PUT http://localhost:5000/api/admin/subscription-plans/{MONTHLY_PLAN_ID}/stripe-price \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stripePriceId": "price_YOUR_ACTUAL_MONTHLY_ID"}'

# 3. Update yearly plan (replace {PLAN_ID} and use YOUR actual price ID)
curl -X PUT http://localhost:5000/api/admin/subscription-plans/{YEARLY_PLAN_ID}/stripe-price \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stripePriceId": "price_YOUR_ACTUAL_YEARLY_ID"}'
```

---

## ⚠️ Common Mistakes

### ❌ DON'T DO THIS:
- Using `price_1ABCDE1234567890` (example from docs)
- Using `price_0FEDCBA9876543210` (example from docs)
- Using `price_monthly` or `price_yearly` (placeholders)
- Copying any price ID from documentation

### ✅ DO THIS:
- Go to YOUR Stripe Dashboard
- Get YOUR actual price IDs
- Use those real IDs

---

## 📱 Need Help?

1. **Not sure if your price ID is real?**
   - Real price IDs are 28+ characters long
   - They're unique to YOUR Stripe account
   - You can only find them in YOUR dashboard

2. **Don't have a Stripe account?**
   - Sign up at https://stripe.com
   - Use test mode for development

3. **Can't find your price IDs?**
   - Go to: https://dashboard.stripe.com/test/products
   - Click on your product
   - Click on a price to see its ID
   - Copy the ID that starts with `price_`

---

## ✅ Success Check

After setup, this should work without errors:
```bash
curl -X POST http://localhost:5000/api/subscription/checkout \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan": "monthly"}'
```

If you still see errors, the price ID doesn't exist in your Stripe account!
