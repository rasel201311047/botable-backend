# 📊 Subscription Flow Diagram & Architecture

## Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUBSCRIPTION CHECKOUT FLOW                       │
└─────────────────────────────────────────────────────────────────────────┘

STEP 1: User Selects Plan
┌──────────────────────┐
│  Subscription Page   │
│  (Plans Component)   │
│  ┌────────────────┐  │
│  │ Free   $0     │  │  User clicks
│  │ Monthly $10   │──┼──> "Get Plan"
│  │ Yearly $100   │  │
│  └────────────────┘  │
└──────────────────────┘
         │
         │ POST /api/subscription/checkout
         │ Body: { plan: "monthly" }
         │
         ▼
┌──────────────────────┐
│   BACKEND SERVER     │
│ (Node.js/Express)    │
│ ┌────────────────┐   │
│ │ Controller     │   │
│ │ Service        │   │
│ │ Stripe Config  │   │
│ └────────────────┘   │
└──────────────────────┘
         │
         │ Create checkout session
         │ Returns: { sessionId, url }
         │
         ▼
┌──────────────────────┐
│    STRIPE SERVERS    │
│ (Payment Processing) │
│ ┌────────────────┐   │
│ │ Checkout Page  │   │
│ │ Payment Form   │   │
│ │ Card Processing│   │
│ └────────────────┘   │
└──────────────────────┘
         │
         │ User enters card details
         │ 4242 4242 4242 4242 (test)
         │ Completes payment ✅
         │
         ▼
┌──────────────────────────────────────────────┐
│ STEP 2: Stripe Redirects to Success URL     │
│                                              │
│ Redirect to:                                │
│ http://localhost:3000/subscription/success  │
│ ?session_id=cs_test_a1jyaA...             │
└──────────────────────────────────────────────┘
         │
         │ Frontend loads success page
         │
         ▼
┌──────────────────────────────────────┐
│    STEP 3: YOU IMPLEMENT THIS        │  ⬅️ THIS IS WHAT YOU BUILD
│                                      │
│  ┌────────────────────────────────┐ │
│  │ 1. Extract session_id from URL │ │
│  │ 2. Show loading spinner        │ │
│  │ 3. Call backend verify endpoint│ │
│  │ 4. Display subscription details│ │
│  │ 5. Auto-redirect to dashboard  │ │
│  └────────────────────────────────┘ │
│                                      │
│  GET /api/subscription/             │
│  verify-session/{sessionId}          │
│                                      │
└──────────────────────────────────────┘
         │
         │ Call with auth token
         │
         ▼
┌──────────────────────────────────────┐
│      BACKEND VERIFICATION            │
│                                      │
│  1. Retrieve checkout session        │
│  2. Verify payment_status = "paid"   │
│  3. Get subscription details         │
│  4. Find plan by price ID            │
│  5. Update user in database:         │
│     - subscription.plan = "monthly"  │
│     - subscription.isActive = true   │
│     - subscription.startDate = now   │
│     - subscription.endDate = +30 days│
│  6. Return success response          │
│                                      │
│  Response: {                         │
│    status: "success",                │
│    data: {                           │
│      plan: "monthly",                │
│      isActive: true,                 │
│      startDate: "2026-01-26...",    │
│      endDate: "2026-02-26..."       │
│    }                                 │
│  }                                   │
│                                      │
└──────────────────────────────────────┘
         │
         │ Response to frontend
         │
         ▼
┌──────────────────────────────────────┐
│  STEP 4: DISPLAY SUCCESS (FRONTEND)  │
│                                      │
│      ✅ SUBSCRIPTION ACTIVATED!     │
│                                      │
│  Plan: MONTHLY                       │
│  Start: Jan 26, 2026                │
│  Renewal: Feb 26, 2026              │
│                                      │
│  "Redirecting in 3 seconds..."       │
│  [Go to Dashboard Now]               │
│                                      │
└──────────────────────────────────────┘
         │
         │ Auto-redirect or click button
         │
         ▼
┌──────────────────────────────────────┐
│         DASHBOARD PAGE               │
│    (User now has subscription) ✅    │
└──────────────────────────────────────┘
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BOOTABLE FITNESS SYSTEM                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐              ┌──────────────────┐
│                  │              │                  │
│  FRONTEND        │  ◄──HTTP───► │    BACKEND       │
│  (React/Vue)     │              │  (Node.js)       │
│                  │              │                  │
│ ┌──────────────┐ │              │ ┌──────────────┐ │
│ │ Plans Page   │ │              │ │ Controllers  │ │
│ │ Checkout     │ │              │ │ Services     │ │
│ │ Success Page │ │              │ │ Models       │ │
│ │ Dashboard    │ │              │ │ Routes       │ │
│ └──────────────┘ │              │ └──────────────┘ │
│                  │              │                  │
└──────────────────┘              └────────┬─────────┘
                                          │
                                          │ Uses
                                          │
                    ┌─────────────────────┴────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
             ┌──────────────┐      ┌──────────────┐   ┌──────────────┐
             │  MongoDB     │      │  Stripe API  │   │    SMTP      │
             │  (Database)  │      │  (Payments)  │   │   (Email)    │
             │              │      │              │   │              │
             │ - Users      │      │ - Sessions   │   │ - Receipts   │
             │ - Plans      │      │ - Customers  │   │ - Invoices   │
             │ - Subs       │      │ - Subs       │   │              │
             └──────────────┘      └──────────────┘   └──────────────┘
```

---

## URL Flow Diagram

```
CHECKOUT FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User at: http://localhost:3000/subscription
                    │
                    │ Clicks "Get Monthly"
                    │
                    ▼
Frontend calls POST to:
http://localhost:5000/api/subscription/checkout
                    │
                    │ Returns { sessionId: "cs_test_...", url: "https://checkout.stripe.com/..." }
                    │
                    ▼
Frontend redirects to Stripe URL
                    │
                    ▼ User pays
                    │
Stripe completes checkout
                    │
                    │ Redirects to:
                    │
                    ▼
http://localhost:3000/subscription/success?session_id=cs_test_a1jyaA...
                    │
                    │ [YOUR FRONTEND CODE]
                    │
                    ▼
Frontend calls GET to:
http://localhost:5000/api/subscription/verify-session/cs_test_a1jyaA...
(with Auth header)
                    │
                    │ [BACKEND VERIFICATION]
                    │
                    ▼
Backend calls Stripe API to verify
                    │
                    │ ✅ Payment confirmed
                    │
                    ▼
Backend updates database
                    │
                    │ Returns { status: "success", data: {...} }
                    │
                    ▼
Frontend displays success message
                    │
                    │ Auto-redirect
                    │
                    ▼
http://localhost:3000/dashboard
```

---

## Database Schema

```
┌─────────────────────────────────────────────┐
│          USERS COLLECTION                   │
├─────────────────────────────────────────────┤
│ _id: ObjectId                               │
│ name: String                                │
│ email: String (unique)                      │
│ password: String (hashed)                   │
│ ...                                         │
│ subscription: {                             │
│   plan: "free" | "monthly" | "yearly"      │
│   isActive: Boolean                         │
│   startDate: Date                           │
│   endDate: Date                             │
│   stripeCustomerId: String                  │
│   stripeSubscriptionId: String              │
│ }                                           │
│ ...                                         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│     SUBSCRIPTION PLANS COLLECTION           │
├─────────────────────────────────────────────┤
│ _id: ObjectId                               │
│ name: "free" | "monthly" | "yearly"         │
│ displayName: "Free" | "Monthly" | "Yearly"  │
│ price: Number (0, 10, 100)                  │
│ currency: "usd"                             │
│ interval: null | "month" | "year"           │
│ stripePriceId: String (from Stripe)         │
│ features: [String]                          │
│ isActive: Boolean                           │
│ createdAt: Date                             │
│ updatedAt: Date                             │
└─────────────────────────────────────────────┘
```

---

## API Endpoints

```
PUBLIC ENDPOINTS
════════════════════════════════════════════════

GET /api/subscription/plans
├─ No auth required
├─ Returns: { free, monthly, yearly }
└─ Used by: Subscription page


PROTECTED ENDPOINTS (require auth token)
════════════════════════════════════════════════

GET /api/subscription
├─ Get user's current subscription
├─ Returns: { plan, isActive, startDate, endDate, ... }
└─ Used by: Dashboard, Profile page

POST /api/subscription/checkout
├─ Create Stripe checkout session
├─ Body: { plan: "monthly" }
├─ Returns: { sessionId, url }
└─ Used by: Plans page (when user clicks plan)

GET /api/subscription/verify-session/:sessionId ⭐ YOU USE THIS
├─ Verify checkout session after Stripe redirect
├─ Params: sessionId (from URL)
├─ Returns: { plan, isActive, startDate, endDate, ... }
└─ Used by: Success page [THIS IS WHAT YOU BUILD]

GET /api/subscription/check-access
├─ Check if user has premium access
├─ Returns: { hasPremiumAccess: boolean }
└─ Used by: Protected features check


ADMIN ENDPOINTS
════════════════════════════════════════════════

GET /api/admin/subscription-plans
├─ Get all plans with Stripe price IDs
└─ Used by: Admin dashboard

PUT /api/admin/subscription-plans/:id/stripe-price
├─ Update Stripe price ID for a plan
├─ Body: { stripePriceId: "price_..." }
└─ Used by: Admin configuration
```

---

## Component Hierarchy (React Example)

```
App
├── Router
│   ├── Route: /subscription → <SubscriptionPlans />
│   │   └── <PlanCard />
│   │       └── <CheckoutButton />
│   │
│   ├── Route: /subscription/success → <SubscriptionSuccess /> ⭐ YOU BUILD THIS
│   │   ├── Extract session_id
│   │   ├── Call API
│   │   ├── <LoadingSpinner />
│   │   ├── <SuccessMessage />
│   │   └── <AutoRedirect />
│   │
│   └── Route: /dashboard → <Dashboard />
│       └── (show subscription status)
```

---

## State Flow (React Hooks)

```
SubscriptionSuccess Component
│
├─ useState(loading) → true initially
├─ useState(error) → null initially
├─ useState(subscription) → null initially
├─ useState(countdown) → 3
│
└─ useEffect(() => {
    1. Get sessionId from URL
    2. Set loading = true
    3. Call /api/subscription/verify-session/...
    4. If success:
       - Set subscription = response.data
       - Set loading = false
       - Start countdown (3, 2, 1, 0 → redirect)
    5. If error:
       - Set error = error.message
       - Set loading = false
   }, [])
```

---

## Error Handling Flow

```
                    ┌─────────────────────┐
                    │ Call backend API    │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
        ✅ SUCCESS      ⚠️ WARNING       ❌ ERROR
                │              │              │
                │              │              │
          Show success    Show warning   Show error
          with details    message       with retry
                │              │              │
                ▼              ▼              ▼
          [2 sec]         [Retry]      [Back Button]
                │              │              │
                ▼              ▼              ▼
          Auto-redirect   Retry API    Back to
          to dashboard    call         subscription
```

---

## Security Layers

```
REQUEST
  │
  ├─ 1️⃣ Check Auth Token ✅
  │  └─ If missing/invalid → 401 Unauthorized
  │
  ├─ 2️⃣ Extract Session ID ✅
  │  └─ If missing → 400 Bad Request
  │
  ├─ 3️⃣ Call Stripe API ✅
  │  └─ If session not found → 404 Not Found
  │
  ├─ 4️⃣ Verify Payment Status ✅
  │  └─ If not paid → 400 Bad Request
  │
  ├─ 5️⃣ Verify User Match ✅
  │  └─ If belongs to different user → 403 Forbidden
  │
  ├─ 6️⃣ Update Database ✅
  │  └─ If error → 500 Server Error
  │
  └─ 7️⃣ Return Success ✅
     └─ 200 Success
```

---

## Timeline Example

```
Time    Frontend Action           Backend Action       Stripe Action
────    ────────────────────      ─────────────────    ─────────────

T0      User at /subscription
        Sees plans
        Clicks "Get Monthly"

T1      POST /checkout →                              
                                  Create session
                                  ←─ Return URL

T2      Redirect to Stripe URL                        Show checkout
                                                      form

T3-T5                                                 User enters
                                                      card & pays
                                                      ✅ Payment OK

T6                                                    Redirect to
                                                      /success?sid=...

T7      Page loads
        Verify session called →
                                  Call Stripe API
                                  Verify payment ✅
                                  Update database ✅
                                  Return success
        ← Response received

T8      Show success message
        Start countdown (3s)

T9      Auto-redirect
        /dashboard loaded ✅

                                  User now has
                                  active subscription!
```

---

## Success Page States

```
LOADING STATE
┌──────────────────────┐
│                      │
│  ⏳ Loading Spinner   │
│                      │
│  "Verifying your     │
│   subscription..."   │
│                      │
└──────────────────────┘


ERROR STATE
┌──────────────────────┐
│                      │
│  ❌ Error            │
│                      │
│  "Payment was not    │
│   completed"         │
│                      │
│  [Back Button]       │
│                      │
└──────────────────────┘


SUCCESS STATE
┌──────────────────────┐
│                      │
│  ✅ Subscription     │
│     Activated!       │
│                      │
│  Plan: MONTHLY       │
│  Start: Jan 26, 26   │
│  Renewal: Feb 26, 26 │
│                      │
│  "Redirecting in 3s" │
│  [Go to Dashboard]   │
│                      │
└──────────────────────┘
```

---

This diagram shows exactly what happens at each step and what you need to implement! 🎯
