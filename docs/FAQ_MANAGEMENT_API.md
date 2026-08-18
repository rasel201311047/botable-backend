# FAQ Management API - Multiple FAQs System

## 🎯 Overview

The FAQ system has been updated to support **multiple individual FAQ items** that can be managed separately. Each FAQ has:
- Question and Answer
- Category for grouping
- Order for sorting
- Active/Inactive status
- Creation and update tracking

---

## 📊 Database Model

### FAQ Schema

```javascript
{
  question: String (required, max 500 chars),
  answer: String (required, max 5000 chars),
  category: String (required, max 100 chars, default: 'General'),
  order: Number (default: 0),
  isActive: Boolean (default: true),
  createdBy: ObjectId (User ref),
  updatedBy: ObjectId (User ref),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ category: 1, order: 1 }`
- `{ isActive: 1, order: 1 }`

---

## 🔗 API Endpoints

### User Endpoints (Public)

#### 1. Get All FAQs

**Endpoint:** `GET {{BaseURL}}/content/faqs`

**Access:** Public (no authentication required)

**Description:** Get all active FAQs, grouped by category.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | String | No | Filter by specific category |

**Request Examples:**

```http
# Get all FAQs
GET {{BaseURL}}/content/faqs

# Get FAQs by category
GET {{BaseURL}}/content/faqs?category=General
```

**Success Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "faqs": [
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "question": "What is Bootble?",
        "answer": "Bootble is a comprehensive fitness app designed specifically for shift workers, offering personalized workout plans, nutrition tracking, and recovery management.",
        "category": "General",
        "order": 1,
        "isActive": true,
        "createdAt": "2026-02-18T10:00:00.000Z",
        "updatedAt": "2026-02-18T10:00:00.000Z"
      },
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j2",
        "question": "How much does it cost?",
        "answer": "We offer a free plan with basic features, plus premium monthly ($9.99/month) and yearly ($89.99/year) subscriptions.",
        "category": "General",
        "order": 2,
        "isActive": true,
        "createdAt": "2026-02-18T10:05:00.000Z",
        "updatedAt": "2026-02-18T10:05:00.000Z"
      },
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j3",
        "question": "Can I cancel my subscription?",
        "answer": "Yes, you can cancel anytime from your account settings. Your access continues until the end of the billing period.",
        "category": "Subscription",
        "order": 1,
        "isActive": true,
        "createdAt": "2026-02-18T10:10:00.000Z",
        "updatedAt": "2026-02-18T10:10:00.000Z"
      }
    ],
    "groupedByCategory": {
      "General": [
        { /* FAQ object */ },
        { /* FAQ object */ }
      ],
      "Subscription": [
        { /* FAQ object */ }
      ]
    },
    "total": 3
  }
}
```

---

### Admin Endpoints (Admin Only)

#### 2. Create FAQ

**Endpoint:** `POST {{BaseURL}}/admin/faqs`

**Access:** Private/Admin

**Description:** Create a new FAQ item.

**Request Headers:**

```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "question": "What is Bootble?",
  "answer": "Bootble is a comprehensive fitness app designed specifically for shift workers, offering personalized workout plans, nutrition tracking, and recovery management.",
  "category": "General",
  "order": 1
}
```

**Field Descriptions:**

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| question | String | Yes | 500 chars | The FAQ question |
| answer | String | Yes | 5000 chars | The FAQ answer |
| category | String | No | 100 chars | Category for grouping (default: 'General') |
| order | Number | No | - | Sort order within category (default: 0) |

**Success Response (201 Created):**

```json
{
  "status": "success",
  "message": "FAQ created successfully",
  "data": {
    "faq": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "question": "What is Bootble?",
      "answer": "Bootble is a comprehensive fitness app...",
      "category": "General",
      "order": 1,
      "isActive": true,
      "createdBy": {
        "_id": "65e9876543210fedcba98766",
        "name": "Admin User",
        "email": "admin@bootblefitness.com"
      },
      "updatedBy": {
        "_id": "65e9876543210fedcba98766",
        "name": "Admin User",
        "email": "admin@bootblefitness.com"
      },
      "createdAt": "2026-02-18T10:00:00.000Z",
      "updatedAt": "2026-02-18T10:00:00.000Z"
    }
  }
}
```

**Example Use Cases:**

**General Question:**
```json
{
  "question": "How do I create an account?",
  "answer": "Download the app and sign up using your email address. Complete the onboarding process to personalize your experience.",
  "category": "Getting Started",
  "order": 1
}
```

**Subscription Question:**
```json
{
  "question": "What's included in the premium subscription?",
  "answer": "Premium includes personalized AI workout plans, detailed nutrition analysis, recovery insights, and priority support.",
  "category": "Subscription",
  "order": 2
}
```

**Technical Question:**
```json
{
  "question": "I forgot my password. What should I do?",
  "answer": "Use the 'Forgot Password' link on the login screen to reset your password via email. Check your spam folder if you don't see the email within 5 minutes.",
  "category": "Technical Support",
  "order": 1
}
```

---

#### 3. Get All FAQs (Admin View)

**Endpoint:** `GET {{BaseURL}}/admin/faqs`

**Access:** Private/Admin

**Description:** Get all FAQs including inactive ones, with creator/updater details.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | String | No | Filter by category |
| isActive | String | No | Filter by active status ('true' or 'false') |

**Request Examples:**

```http
# Get all FAQs
GET {{BaseURL}}/admin/faqs
Authorization: Bearer <admin_token>

# Get only active FAQs
GET {{BaseURL}}/admin/faqs?isActive=true
Authorization: Bearer <admin_token>

# Get FAQs by category
GET {{BaseURL}}/admin/faqs?category=General
Authorization: Bearer <admin_token>
```

**Success Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "faqs": [
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "question": "What is Bootble?",
        "answer": "Bootble is a comprehensive fitness app...",
        "category": "General",
        "order": 1,
        "isActive": true,
        "createdBy": {
          "_id": "65e9876543210fedcba98766",
          "name": "Admin User",
          "email": "admin@bootblefitness.com"
        },
        "updatedBy": {
          "_id": "65e9876543210fedcba98766",
          "name": "Admin User",
          "email": "admin@bootblefitness.com"
        },
        "createdAt": "2026-02-18T10:00:00.000Z",
        "updatedAt": "2026-02-18T10:00:00.000Z"
      }
    ],
    "groupedByCategory": {
      "General": [ /* FAQs */ ],
      "Subscription": [ /* FAQs */ ]
    },
    "total": 15
  }
}
```

---

#### 4. Get FAQ by ID

**Endpoint:** `GET {{BaseURL}}/admin/faqs/:id`

**Access:** Private/Admin

**Description:** Get a single FAQ by ID with full details.

**Request Example:**

```http
GET {{BaseURL}}/admin/faqs/65f1a2b3c4d5e6f7g8h9i0j1
Authorization: Bearer <admin_token>
```

**Success Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "faq": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "question": "What is Bootble?",
      "answer": "Bootble is a comprehensive fitness app...",
      "category": "General",
      "order": 1,
      "isActive": true,
      "createdBy": {
        "_id": "65e9876543210fedcba98766",
        "name": "Admin User",
        "email": "admin@bootblefitness.com"
      },
      "updatedBy": {
        "_id": "65e9876543210fedcba98766",
        "name": "Admin User",
        "email": "admin@bootblefitness.com"
      },
      "createdAt": "2026-02-18T10:00:00.000Z",
      "updatedAt": "2026-02-18T10:00:00.000Z"
    }
  }
}
```

---

#### 5. Update FAQ

**Endpoint:** `PUT {{BaseURL}}/admin/faqs/:id`

**Access:** Private/Admin

**Description:** Update an existing FAQ.

**Request Body:**

```json
{
  "question": "What is Bootble App?",
  "answer": "Updated answer with more details...",
  "category": "General",
  "order": 1,
  "isActive": true
}
```

**Note:** All fields are optional. Only provided fields will be updated.

**Request Examples:**

**Update question and answer:**
```json
{
  "question": "How much does Bootble cost?",
  "answer": "We offer a free plan with basic features. Premium plans start at $9.99/month or save with our yearly plan at $89.99/year."
}
```

**Change category and order:**
```json
{
  "category": "Pricing",
  "order": 3
}
```

**Deactivate FAQ:**
```json
{
  "isActive": false
}
```

**Success Response (200 OK):**

```json
{
  "status": "success",
  "message": "FAQ updated successfully",
  "data": {
    "faq": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "question": "What is Bootble App?",
      "answer": "Updated answer...",
      "category": "General",
      "order": 1,
      "isActive": true,
      "createdBy": { /* ... */ },
      "updatedBy": {
        "_id": "65e9876543210fedcba98766",
        "name": "Admin User",
        "email": "admin@bootblefitness.com"
      },
      "createdAt": "2026-02-18T10:00:00.000Z",
      "updatedAt": "2026-02-18T14:35:00.000Z"
    }
  }
}
```

---

#### 6. Delete FAQ

**Endpoint:** `DELETE {{BaseURL}}/admin/faqs/:id`

**Access:** Private/Admin

**Description:** Permanently delete a FAQ.

**Request Example:**

```http
DELETE {{BaseURL}}/admin/faqs/65f1a2b3c4d5e6f7g8h9i0j1
Authorization: Bearer <admin_token>
```

**Success Response (200 OK):**

```json
{
  "status": "success",
  "message": "FAQ deleted successfully"
}
```

---

#### 7. Get FAQ Categories

**Endpoint:** `GET {{BaseURL}}/admin/faqs/categories/list`

**Access:** Private/Admin

**Description:** Get a list of all unique FAQ categories.

**Request Example:**

```http
GET {{BaseURL}}/admin/faqs/categories/list
Authorization: Bearer <admin_token>
```

**Success Response (200 OK):**

```json
{
  "status": "success",
  "data": {
    "categories": [
      "General",
      "Getting Started",
      "Subscription",
      "Technical Support",
      "Features",
      "Billing"
    ]
  }
}
```

---

#### 8. Reorder FAQs

**Endpoint:** `PATCH {{BaseURL}}/admin/faqs/reorder`

**Access:** Private/Admin

**Description:** Bulk update the order of multiple FAQs at once.

**Request Body:**

```json
{
  "faqs": [
    { "id": "65f1a2b3c4d5e6f7g8h9i0j1", "order": 1 },
    { "id": "65f1a2b3c4d5e6f7g8h9i0j2", "order": 2 },
    { "id": "65f1a2b3c4d5e6f7g8h9i0j3", "order": 3 }
  ]
}
```

**Request Example:**

```http
PATCH {{BaseURL}}/admin/faqs/reorder
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "faqs": [
    { "id": "65f1a2b3c4d5e6f7g8h9i0j1", "order": 3 },
    { "id": "65f1a2b3c4d5e6f7g8h9i0j2", "order": 1 },
    { "id": "65f1a2b3c4d5e6f7g8h9i0j3", "order": 2 }
  ]
}
```

**Success Response (200 OK):**

```json
{
  "status": "success",
  "message": "FAQs reordered successfully"
}
```

---

## 📝 Complete Testing Scenarios

### Scenario 1: Create Multiple FAQs

```http
# Create FAQ 1
POST {{BaseURL}}/admin/faqs
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "question": "What is Bootble?",
  "answer": "Bootble is a comprehensive fitness app designed specifically for shift workers.",
  "category": "General",
  "order": 1
}
```

```http
# Create FAQ 2
POST {{BaseURL}}/admin/faqs
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "question": "How much does it cost?",
  "answer": "We offer a free plan with basic features, plus premium monthly ($9.99/month) and yearly ($89.99/year) subscriptions.",
  "category": "General",
  "order": 2
}
```

```http
# Create FAQ 3 (different category)
POST {{BaseURL}}/admin/faqs
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "question": "Can I cancel my subscription?",
  "answer": "Yes, you can cancel anytime from your account settings.",
  "category": "Subscription",
  "order": 1
}
```

---

### Scenario 2: View FAQs (User)

```http
# Get all FAQs (public)
GET {{BaseURL}}/content/faqs

# Get FAQs by category
GET {{BaseURL}}/content/faqs?category=General
```

---

### Scenario 3: Manage FAQs (Admin)

```http
# Get all FAQs
GET {{BaseURL}}/admin/faqs
Authorization: Bearer <admin_token>

# Get categories
GET {{BaseURL}}/admin/faqs/categories/list
Authorization: Bearer <admin_token>

# Update FAQ
PUT {{BaseURL}}/admin/faqs/FAQ_ID
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "answer": "Updated answer with more details..."
}

# Delete FAQ
DELETE {{BaseURL}}/admin/faqs/FAQ_ID
Authorization: Bearer <admin_token>
```

---

## 🎯 Use Cases

### Use Case 1: Building FAQ Page

```javascript
// Frontend: Fetch and display FAQs
const response = await fetch('{{BaseURL}}/content/faqs');
const data = await response.json();

// Display grouped by category
Object.entries(data.data.groupedByCategory).forEach(([category, faqs]) => {
  console.log(`Category: ${category}`);
  faqs.forEach(faq => {
    console.log(`Q: ${faq.question}`);
    console.log(`A: ${faq.answer}`);
  });
});
```

### Use Case 2: Admin Dashboard

```javascript
// Get all FAQs with admin details
const response = await fetch('{{BaseURL}}/admin/faqs', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});

// Create new FAQ
const createResponse = await fetch('{{BaseURL}}/admin/faqs', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    question: 'New question?',
    answer: 'Answer here...',
    category: 'General',
    order: 1
  })
});
```

---

## 🔍 Category Examples

### Recommended Categories

1. **General** - Basic information about the app
2. **Getting Started** - Onboarding and setup questions
3. **Subscription** - Billing and payment questions
4. **Features** - Specific feature explanations
5. **Technical Support** - Troubleshooting and technical issues
6. **Account** - Profile and account management
7. **Privacy & Security** - Data and security concerns

---

## ✅ Best Practices

1. **Ordering**: Use incremental numbers (1, 2, 3...) for clear sorting
2. **Categories**: Keep category names consistent and descriptive
3. **Questions**: Keep questions concise (under 100 chars recommended)
4. **Answers**: Provide clear, complete answers (200-1000 chars recommended)
5. **Active Status**: Deactivate outdated FAQs instead of deleting them
6. **Updates**: Track who updates FAQs and when for audit purposes

---

## 🚀 Migration from Old System

If you have existing FAQ content in the old single-document format, you can:

1. Extract questions/answers from old content
2. Create individual FAQs using the new API
3. Categorize and order them appropriately
4. Delete or deactivate the old FAQ content document

---

## 📊 Summary

**Endpoints:**
- User: 1 public endpoint (GET FAQs)
- Admin: 7 admin endpoints (Create, Read, Update, Delete, List Categories, Reorder)

**Features:**
- ✅ Multiple individual FAQ items
- ✅ Category grouping
- ✅ Custom ordering
- ✅ Active/Inactive status
- ✅ Creation and update tracking
- ✅ Bulk reordering
- ✅ Category filtering
- ✅ Public access for users
- ✅ Full CRUD for admins

---

**Last Updated:** February 18, 2026  
**Version:** 2.0 (Multiple FAQs System)  
**Status:** ✅ Production Ready
