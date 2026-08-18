#!/bin/bash
# Subscription Setup and Testing Commands

# ============================================
# PART 1: Get Admin Token
# ============================================
# First, you need to log in as admin to get a token
# Replace credentials with your admin account

ADMIN_TOKEN="your_admin_token_here"
BASE_URL="http://localhost:5000"

# ============================================
# PART 2: List All Subscription Plans
# ============================================
echo "=== Getting all subscription plans ==="
curl -X GET "$BASE_URL/api/admin/subscription-plans" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"

echo -e "\n\n"

# ============================================
# PART 3: Get Individual Plan Details
# ============================================
# Note: Replace {PLAN_ID} with actual MongoDB ID from previous response
echo "=== Getting monthly plan details ==="
curl -X GET "$BASE_URL/api/admin/subscription-plans/{MONTHLY_PLAN_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"

echo -e "\n\n"

# ============================================
# PART 4: Update Monthly Plan with Stripe Price ID
# ============================================
# Get this price ID from your Stripe Dashboard
echo "=== Updating monthly plan with Stripe price ID ==="
curl -X PUT "$BASE_URL/api/admin/subscription-plans/{MONTHLY_PLAN_ID}/stripe-price" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stripePriceId": "price_1ABCDE1234567890"
  }'

echo -e "\n\n"

# ============================================
# PART 5: Update Yearly Plan with Stripe Price ID
# ============================================
echo "=== Updating yearly plan with Stripe price ID ==="
curl -X PUT "$BASE_URL/api/admin/subscription-plans/{YEARLY_PLAN_ID}/stripe-price" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stripePriceId": "price_0FEDCBA9876543210"
  }'

echo -e "\n\n"

# ============================================
# PART 6: Public: Get Subscription Plans
# ============================================
echo "=== Public: Get subscription plans (no auth needed) ==="
curl -X GET "$BASE_URL/api/subscription/plans" \
  -H "Content-Type: application/json"

echo -e "\n\n"

# ============================================
# PART 7: Create Checkout Session (Monthly)
# ============================================
# Replace USER_TOKEN with actual user authentication token
USER_TOKEN="user_token_here"

echo "=== Create checkout session for monthly plan ==="
curl -X POST "$BASE_URL/api/subscription/checkout" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "monthly"
  }'

echo -e "\n\n"

# ============================================
# PART 8: Create Checkout Session (Yearly)
# ============================================
echo "=== Create checkout session for yearly plan ==="
curl -X POST "$BASE_URL/api/subscription/checkout" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "yearly"
  }'

echo -e "\n\n"

# ============================================
# PART 9: Get User Subscription Status
# ============================================
echo "=== Get user subscription status ==="
curl -X GET "$BASE_URL/api/subscription" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json"

echo -e "\n\n"

# ============================================
# TROUBLESHOOTING CHECKS
# ============================================
echo "=== Health Check ==="
curl -X GET "$BASE_URL/api/health"

echo -e "\n\n"
