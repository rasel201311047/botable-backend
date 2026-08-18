# Content Management API Documentation

This document provides complete API documentation for the Content Management System including Terms & Conditions, Privacy Policy, FAQs, and Contact Support features.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [User Endpoints](#user-endpoints)
   - [Get Terms & Conditions](#1-get-terms--conditions)
   - [Get Privacy Policy](#2-get-privacy-policy)
   - [Get FAQs](#3-get-faqs)
   - [Submit Contact Support](#4-submit-contact-support)
   - [Get My Contact Messages](#5-get-my-contact-messages)
4. [Admin Endpoints](#admin-endpoints)
   - [Create/Update Terms](#1-createupdate-terms--conditions)
   - [Create/Update Privacy](#2-createupdate-privacy-policy)
   - [Create/Update FAQs](#3-createupdate-faqs)
   - [Get All Content](#4-get-all-content)
   - [Get All Contact Messages](#5-get-all-contact-messages)
   - [Get Contact Statistics](#6-get-contact-statistics)
   - [Get Contact by ID](#7-get-contact-by-id)
   - [Update Contact Status](#8-update-contact-status)
   - [Delete Contact Message](#9-delete-contact-message)

---

## Overview

The Content Management System allows:
- **Admins** to create and update Terms & Conditions, Privacy Policy, and FAQs
- **Users** to view these content pages
- **Users** to submit support messages via contact form
- **Admins** to view and manage all contact messages

---

## Authentication

### User Endpoints
- **Public**: `/api/content/*` endpoints (Terms, Privacy, FAQs)
- **Optional Auth**: `/api/contact-support` (works with or without authentication)
- **Required Auth**: `/api/my-contacts` (requires authentication)

### Admin Endpoints
All admin endpoints require:
- **Authentication**: Bearer token in Authorization header
- **Role**: Admin role

**Header Format:**
```
Authorization: Bearer <your_admin_token>
```

---

## User Endpoints

### 1. Get Terms & Conditions

**Endpoint:** `GET {{BaseURL}}/content/terms`

**Access:** Public (no authentication required)

**Description:** Retrieve the current Terms & Conditions content.

#### Request Example

```http
GET {{BaseURL}}/content/terms
Content-Type: application/json
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "content": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "type": "terms",
      "title": "Terms & Conditions",
      "content": "<h1>Terms and Conditions</h1><p>Welcome to Bootble...</p>",
      "version": 3,
      "isActive": true,
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-02-10T14:20:00.000Z"
    }
  }
}
```

#### Error Response (404 Not Found)

```json
{
  "status": "error",
  "message": "Terms & Conditions not found"
}
```

---

### 2. Get Privacy Policy

**Endpoint:** `GET {{BaseURL}}/content/privacy`

**Access:** Public (no authentication required)

**Description:** Retrieve the current Privacy Policy content.

#### Request Example

```http
GET {{BaseURL}}/content/privacy
Content-Type: application/json
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "content": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j2",
      "type": "privacy",
      "title": "Privacy Policy",
      "content": "<h1>Privacy Policy</h1><p>Your privacy is important to us...</p>",
      "version": 2,
      "isActive": true,
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-02-05T09:15:00.000Z"
    }
  }
}
```

---

### 3. Get FAQs

**Endpoint:** `GET {{BaseURL}}/content/faqs`

**Access:** Public (no authentication required)

**Description:** Retrieve the current FAQs content.

#### Request Example

```http
GET {{BaseURL}}/content/faqs
Content-Type: application/json
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "content": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j3",
      "type": "faqs",
      "title": "Frequently Asked Questions",
      "content": "<h2>General Questions</h2><h3>What is Bootble?</h3><p>Bootble is...</p>",
      "version": 5,
      "isActive": true,
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-02-18T11:00:00.000Z"
    }
  }
}
```

---

### 4. Submit Contact Support

**Endpoint:** `POST {{BaseURL}}/contact-support`

**Access:** Public (authentication optional - if authenticated, userId is attached)

**Description:** Submit a support message to admin.

#### Request Headers

```
Content-Type: application/json
Authorization: Bearer <token> (optional)
```

#### Request Body

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "subject": "Issue with workout logging",
  "message": "I'm experiencing difficulties logging my workouts. When I try to save a workout, the app shows an error message saying 'Failed to save workout'. Can you please help?"
}
```

#### Field Descriptions

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| name | String | Yes | 100 chars | User's full name |
| email | String | Yes | - | Valid email address |
| subject | String | Yes | 200 chars | Message subject/title |
| message | String | Yes | 2000 chars | Detailed message content |

#### Success Response (201 Created)

```json
{
  "status": "success",
  "message": "Your message has been sent successfully. We will get back to you soon.",
  "data": {
    "messageId": "65f1a2b3c4d5e6f7g8h9i0j4",
    "createdAt": "2026-02-18T12:30:00.000Z"
  }
}
```

#### Error Response (400 Bad Request)

```json
{
  "status": "error",
  "message": "All fields are required (name, email, subject, message)"
}
```

#### Example Use Cases

**Case 1: Unauthenticated User**
```json
{
  "name": "Jane Smith",
  "email": "jane.smith@example.com",
  "subject": "Question about subscription plans",
  "message": "I would like to know the difference between monthly and yearly subscription plans. Do yearly plans offer any discounts?"
}
```

**Case 2: Authenticated User (auto-attaches userId)**
```http
POST {{BaseURL}}/contact-support
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "Mike Johnson",
  "email": "mike.johnson@example.com",
  "subject": "Feature request",
  "message": "It would be great if the app could sync with my smartwatch to automatically log workouts."
}
```

---

### 5. Get My Contact Messages

**Endpoint:** `GET {{BaseURL}}/my-contacts`

**Access:** Private (requires authentication)

**Description:** Retrieve all contact messages submitted by the authenticated user.

#### Request Headers

```
Authorization: Bearer <your_token>
```

#### Request Example

```http
GET {{BaseURL}}/my-contacts
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j4",
        "userId": "65e9876543210fedcba98765",
        "name": "Mike Johnson",
        "email": "mike.johnson@example.com",
        "subject": "Feature request",
        "message": "It would be great if the app could sync with my smartwatch to automatically log workouts.",
        "status": "resolved",
        "priority": "medium",
        "createdAt": "2026-02-18T12:30:00.000Z",
        "updatedAt": "2026-02-18T15:45:00.000Z"
      },
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j5",
        "userId": "65e9876543210fedcba98765",
        "name": "Mike Johnson",
        "email": "mike.johnson@example.com",
        "subject": "Payment issue",
        "message": "My subscription payment failed. Can you help me resolve this?",
        "status": "pending",
        "priority": "high",
        "createdAt": "2026-02-17T09:15:00.000Z",
        "updatedAt": "2026-02-17T09:15:00.000Z"
      }
    ]
  }
}
```

---

## Admin Endpoints

All admin endpoints require admin authentication.

### 1. Create/Update Terms & Conditions

**Endpoint:** `POST {{BaseURL}}/admin/content/terms`

**Access:** Private/Admin

**Description:** Create new or update existing Terms & Conditions.

#### Request Headers

```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "title": "Terms & Conditions",
  "content": "<h1>Terms and Conditions</h1><h2>1. Acceptance of Terms</h2><p>By accessing and using Bootble, you accept and agree to be bound by the terms and provisions of this agreement.</p><h2>2. Use License</h2><p>Permission is granted to temporarily download one copy of the materials on Bootble for personal, non-commercial transitory viewing only.</p><h2>3. User Responsibilities</h2><ul><li>Maintain the confidentiality of your account</li><li>Provide accurate information</li><li>Comply with all applicable laws</li></ul><h2>4. Subscription Terms</h2><p>Monthly and yearly subscriptions are available. Subscriptions automatically renew unless cancelled.</p><h2>5. Privacy</h2><p>Your use of Bootble is also governed by our Privacy Policy.</p><p>Last updated: February 18, 2026</p>"
}
```

#### Field Descriptions

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| title | String | Yes | 200 chars | Title of the content |
| content | String | Yes | - | Full content (HTML supported) |

#### Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Terms & Conditions saved successfully",
  "data": {
    "content": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "type": "terms",
      "title": "Terms & Conditions",
      "content": "<h1>Terms and Conditions</h1>...",
      "version": 4,
      "isActive": true,
      "lastUpdatedBy": "65e9876543210fedcba98766",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-02-18T13:00:00.000Z"
    }
  }
}
```

#### Error Response (400 Bad Request)

```json
{
  "status": "error",
  "message": "Title and content are required"
}
```

---

### 2. Create/Update Privacy Policy

**Endpoint:** `POST {{BaseURL}}/admin/content/privacy`

**Access:** Private/Admin

**Description:** Create new or update existing Privacy Policy.

#### Request Headers

```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "title": "Privacy Policy",
  "content": "<h1>Privacy Policy</h1><h2>Information We Collect</h2><p>We collect information you provide directly to us, including:</p><ul><li>Name and email address</li><li>Health and fitness data (workouts, meals, sleep)</li><li>Payment information (processed securely via Stripe)</li></ul><h2>How We Use Your Information</h2><p>We use the information we collect to:</p><ul><li>Provide, maintain, and improve our services</li><li>Personalize your fitness experience</li><li>Send you technical notices and support messages</li></ul><h2>Data Security</h2><p>We implement appropriate security measures to protect your personal information.</p><h2>Your Rights</h2><p>You have the right to access, update, or delete your personal information at any time.</p><p>Last updated: February 18, 2026</p>"
}
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Privacy Policy saved successfully",
  "data": {
    "content": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j2",
      "type": "privacy",
      "title": "Privacy Policy",
      "content": "<h1>Privacy Policy</h1>...",
      "version": 3,
      "isActive": true,
      "lastUpdatedBy": "65e9876543210fedcba98766",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-02-18T13:05:00.000Z"
    }
  }
}
```

---

### 3. Create/Update FAQs

**Endpoint:** `POST {{BaseURL}}/admin/content/faqs`

**Access:** Private/Admin

**Description:** Create new or update existing FAQs.

#### Request Headers

```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "title": "Frequently Asked Questions",
  "content": "<h1>Frequently Asked Questions</h1><h2>General Questions</h2><h3>What is Bootble?</h3><p>Bootble is a comprehensive fitness app designed specifically for shift workers, offering personalized workout plans, nutrition tracking, and recovery management.</p><h3>How much does it cost?</h3><p>We offer a free plan with basic features, plus premium monthly ($9.99/month) and yearly ($89.99/year) subscriptions.</p><h2>Account & Subscription</h2><h3>How do I create an account?</h3><p>Download the app and sign up using your email address. Complete the onboarding process to personalize your experience.</p><h3>Can I cancel my subscription?</h3><p>Yes, you can cancel anytime from your account settings. Your access continues until the end of the billing period.</p><h2>Features</h2><h3>What features are included in the free plan?</h3><p>The free plan includes basic workout logging, meal tracking, and sleep monitoring.</p><h3>What do I get with a premium subscription?</h3><p>Premium includes personalized AI workout plans, detailed nutrition analysis, recovery insights, and priority support.</p><h2>Technical Support</h2><h3>I forgot my password. What should I do?</h3><p>Use the 'Forgot Password' link on the login screen to reset your password via email.</p><h3>How do I contact support?</h3><p>Use the Contact Support form in the app or email us at support@bootblefitness.com</p>"
}
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "message": "FAQs saved successfully",
  "data": {
    "content": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j3",
      "type": "faqs",
      "title": "Frequently Asked Questions",
      "content": "<h1>Frequently Asked Questions</h1>...",
      "version": 6,
      "isActive": true,
      "lastUpdatedBy": "65e9876543210fedcba98766",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-02-18T13:10:00.000Z"
    }
  }
}
```

---

### 4. Get All Content

**Endpoint:** `GET {{BaseURL}}/admin/content`

**Access:** Private/Admin

**Description:** Get all content items (Terms, Privacy, FAQs) with admin details.

#### Request Headers

```
Authorization: Bearer <admin_token>
```

#### Request Example

```http
GET {{BaseURL}}/admin/content
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "contents": [
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j3",
        "type": "faqs",
        "title": "Frequently Asked Questions",
        "content": "<h1>Frequently Asked Questions</h1>...",
        "version": 6,
        "isActive": true,
        "lastUpdatedBy": {
          "_id": "65e9876543210fedcba98766",
          "name": "Admin User",
          "email": "admin@bootblefitness.com"
        },
        "createdAt": "2026-01-15T10:30:00.000Z",
        "updatedAt": "2026-02-18T13:10:00.000Z"
      },
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j2",
        "type": "privacy",
        "title": "Privacy Policy",
        "content": "<h1>Privacy Policy</h1>...",
        "version": 3,
        "isActive": true,
        "lastUpdatedBy": {
          "_id": "65e9876543210fedcba98766",
          "name": "Admin User",
          "email": "admin@bootblefitness.com"
        },
        "createdAt": "2026-01-15T10:30:00.000Z",
        "updatedAt": "2026-02-18T13:05:00.000Z"
      },
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "type": "terms",
        "title": "Terms & Conditions",
        "content": "<h1>Terms and Conditions</h1>...",
        "version": 4,
        "isActive": true,
        "lastUpdatedBy": {
          "_id": "65e9876543210fedcba98766",
          "name": "Admin User",
          "email": "admin@bootblefitness.com"
        },
        "createdAt": "2026-01-15T10:30:00.000Z",
        "updatedAt": "2026-02-18T13:00:00.000Z"
      }
    ]
  }
}
```

---

### 5. Get All Contact Messages

**Endpoint:** `GET {{BaseURL}}/admin/contacts`

**Access:** Private/Admin

**Description:** Get all contact support messages with filtering and pagination.

#### Request Headers

```
Authorization: Bearer <admin_token>
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| status | String | No | - | Filter by status: pending, read, resolved, archived |
| priority | String | No | - | Filter by priority: low, medium, high |
| page | Number | No | 1 | Page number |
| limit | Number | No | 20 | Items per page |

#### Request Examples

**Get all messages (default pagination):**
```http
GET {{BaseURL}}/admin/contacts
Authorization: Bearer <admin_token>
```

**Filter by status:**
```http
GET {{BaseURL}}/admin/contacts?status=pending
Authorization: Bearer <admin_token>
```

**Filter by priority with pagination:**
```http
GET {{BaseURL}}/admin/contacts?priority=high&page=1&limit=10
Authorization: Bearer <admin_token>
```

**Multiple filters:**
```http
GET {{BaseURL}}/admin/contacts?status=read&priority=medium&page=2&limit=15
Authorization: Bearer <admin_token>
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j5",
        "userId": {
          "_id": "65e9876543210fedcba98765",
          "name": "Mike Johnson",
          "email": "mike.johnson@example.com",
          "profilePhoto": "https://api.bootblefitness.com/uploads/profile-photos/mike.jpg"
        },
        "name": "Mike Johnson",
        "email": "mike.johnson@example.com",
        "subject": "Payment issue",
        "message": "My subscription payment failed. Can you help me resolve this?",
        "status": "pending",
        "priority": "high",
        "adminNotes": null,
        "resolvedBy": null,
        "resolvedAt": null,
        "createdAt": "2026-02-17T09:15:00.000Z",
        "updatedAt": "2026-02-17T09:15:00.000Z"
      },
      {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j4",
        "userId": {
          "_id": "65e9876543210fedcba98765",
          "name": "Mike Johnson",
          "email": "mike.johnson@example.com",
          "profilePhoto": "https://api.bootblefitness.com/uploads/profile-photos/mike.jpg"
        },
        "name": "Mike Johnson",
        "email": "mike.johnson@example.com",
        "subject": "Feature request",
        "message": "It would be great if the app could sync with my smartwatch.",
        "status": "resolved",
        "priority": "medium",
        "adminNotes": "Feature added to roadmap for Q3 2026",
        "resolvedBy": {
          "_id": "65e9876543210fedcba98766",
          "name": "Admin User",
          "email": "admin@bootblefitness.com"
        },
        "resolvedAt": "2026-02-18T15:45:00.000Z",
        "createdAt": "2026-02-18T12:30:00.000Z",
        "updatedAt": "2026-02-18T15:45:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "pages": 1
    }
  }
}
```

---

### 6. Get Contact Statistics

**Endpoint:** `GET {{BaseURL}}/admin/contacts/stats`

**Access:** Private/Admin

**Description:** Get statistics about contact messages.

#### Request Headers

```
Authorization: Bearer <admin_token>
```

#### Request Example

```http
GET {{BaseURL}}/admin/contacts/stats
Authorization: Bearer <admin_token>
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "total": 47,
    "pending": 12,
    "resolved": 30,
    "byStatus": [
      {
        "_id": "pending",
        "count": 12
      },
      {
        "_id": "read",
        "count": 5
      },
      {
        "_id": "resolved",
        "count": 30
      }
    ]
  }
}
```

---

### 7. Get Contact by ID

**Endpoint:** `GET {{BaseURL}}/admin/contacts/:id`

**Access:** Private/Admin

**Description:** Get detailed information about a specific contact message. Auto-marks message as "read" if status is "pending".

#### Request Headers

```
Authorization: Bearer <admin_token>
```

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | String | Contact message ID |

#### Request Example

```http
GET {{BaseURL}}/admin/contacts/65f1a2b3c4d5e6f7g8h9i0j5
Authorization: Bearer <admin_token>
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "message": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j5",
      "userId": {
        "_id": "65e9876543210fedcba98765",
        "name": "Mike Johnson",
        "email": "mike.johnson@example.com",
        "profilePhoto": "https://api.bootblefitness.com/uploads/profile-photos/mike.jpg",
        "phone": null
      },
      "name": "Mike Johnson",
      "email": "mike.johnson@example.com",
      "subject": "Payment issue",
      "message": "My subscription payment failed when I tried to upgrade to yearly plan. The error message said 'Payment processing error'. I've verified my card details are correct. Can you help me resolve this?",
      "status": "read",
      "priority": "high",
      "adminNotes": "Investigating with Stripe support",
      "resolvedBy": null,
      "resolvedAt": null,
      "createdAt": "2026-02-17T09:15:00.000Z",
      "updatedAt": "2026-02-18T14:00:00.000Z"
    }
  }
}
```

#### Error Response (404 Not Found)

```json
{
  "status": "error",
  "message": "Contact message not found"
}
```

---

### 8. Update Contact Status

**Endpoint:** `PATCH {{BaseURL}}/admin/contacts/:id`

**Access:** Private/Admin

**Description:** Update the status, priority, or admin notes for a contact message.

#### Request Headers

```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | String | Contact message ID |

#### Request Body

```json
{
  "status": "resolved",
  "priority": "medium",
  "adminNotes": "Issue resolved - payment processed successfully after updating billing address"
}
```

#### Field Descriptions

| Field | Type | Required | Options | Description |
|-------|------|----------|---------|-------------|
| status | String | No | pending, read, resolved, archived | Update message status |
| priority | String | No | low, medium, high | Update message priority |
| adminNotes | String | No | Max 1000 chars | Add or update admin notes |

#### Request Examples

**Mark as resolved:**
```json
{
  "status": "resolved",
  "adminNotes": "Feature request added to roadmap for Q3 2026"
}
```

**Update priority only:**
```json
{
  "priority": "high"
}
```

**Add admin notes:**
```json
{
  "adminNotes": "Contacted user via email. Awaiting response."
}
```

**Complete update:**
```json
{
  "status": "resolved",
  "priority": "low",
  "adminNotes": "Issue resolved - user error. Provided instructions via email."
}
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Contact message updated successfully",
  "data": {
    "message": {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j5",
      "userId": {
        "_id": "65e9876543210fedcba98765",
        "name": "Mike Johnson",
        "email": "mike.johnson@example.com"
      },
      "name": "Mike Johnson",
      "email": "mike.johnson@example.com",
      "subject": "Payment issue",
      "message": "My subscription payment failed. Can you help me resolve this?",
      "status": "resolved",
      "priority": "medium",
      "adminNotes": "Issue resolved - payment processed successfully after updating billing address",
      "resolvedBy": {
        "_id": "65e9876543210fedcba98766",
        "name": "Admin User",
        "email": "admin@bootblefitness.com"
      },
      "resolvedAt": "2026-02-18T14:30:00.000Z",
      "createdAt": "2026-02-17T09:15:00.000Z",
      "updatedAt": "2026-02-18T14:30:00.000Z"
    }
  }
}
```

---

### 9. Delete Contact Message

**Endpoint:** `DELETE {{BaseURL}}/admin/contacts/:id`

**Access:** Private/Admin

**Description:** Permanently delete a contact message.

#### Request Headers

```
Authorization: Bearer <admin_token>
```

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | String | Contact message ID |

#### Request Example

```http
DELETE {{BaseURL}}/admin/contacts/65f1a2b3c4d5e6f7g8h9i0j5
Authorization: Bearer <admin_token>
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Contact message deleted successfully"
}
```

#### Error Response (404 Not Found)

```json
{
  "status": "error",
  "message": "Contact message not found"
}
```

---

## Complete Postman Collection Setup

### Environment Variables

Create a Postman environment with these variables:

```json
{
  "BaseURL": "http://localhost:5000/api",
  "adminToken": "your_admin_jwt_token",
  "userToken": "your_user_jwt_token"
}
```

### Workflow Examples

#### Admin Workflow: Managing Content

1. **Login as Admin** → Get admin token
2. **Create Terms & Conditions** → POST `/admin/content/terms`
3. **Create Privacy Policy** → POST `/admin/content/privacy`
4. **Create FAQs** → POST `/admin/content/faqs`
5. **View All Content** → GET `/admin/content`

#### Admin Workflow: Managing Support Messages

1. **View Contact Statistics** → GET `/admin/contacts/stats`
2. **Get All Pending Messages** → GET `/admin/contacts?status=pending`
3. **Open Specific Message** → GET `/admin/contacts/:id`
4. **Update to Resolved** → PATCH `/admin/contacts/:id`
5. **Filter High Priority** → GET `/admin/contacts?priority=high`

#### User Workflow: Viewing Content & Contacting Support

1. **View Terms & Conditions** → GET `/content/terms`
2. **View Privacy Policy** → GET `/content/privacy`
3. **View FAQs** → GET `/content/faqs`
4. **Submit Support Message** → POST `/contact-support`
5. **View My Messages** → GET `/my-contacts` (requires auth)

---

## Data Models

### Content Model

```javascript
{
  type: 'terms' | 'privacy' | 'faqs',  // Unique
  title: String (max 200 chars),
  content: String (HTML supported),
  version: Number (auto-increments),
  isActive: Boolean (default true),
  lastUpdatedBy: ObjectId (User ref),
  createdAt: Date,
  updatedAt: Date
}
```

### ContactMessage Model

```javascript
{
  userId: ObjectId (User ref, optional),
  name: String (max 100 chars),
  email: String (validated),
  subject: String (max 200 chars),
  message: String (max 2000 chars),
  status: 'pending' | 'read' | 'resolved' | 'archived',
  priority: 'low' | 'medium' | 'high',
  adminNotes: String (max 1000 chars, optional),
  resolvedBy: ObjectId (User ref, optional),
  resolvedAt: Date (optional),
  createdAt: Date,
  updatedAt: Date
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (requires admin role) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Additional Notes

### HTML Content Support

All content fields support HTML formatting. Recommended tags:
- Headings: `<h1>`, `<h2>`, `<h3>`
- Paragraphs: `<p>`
- Lists: `<ul>`, `<ol>`, `<li>`
- Emphasis: `<strong>`, `<em>`
- Links: `<a href="...">`

### Email Notifications (Optional)

You can integrate email notifications for new contact messages by:
1. Importing your email service in `content.controller.js`
2. Uncommenting the email notification line in `submitContact` method
3. Creating an email template for admin notifications

### Best Practices

1. **Version Control**: Content version auto-increments on updates
2. **Message Status**: Pending → Read → Resolved → Archived
3. **Priority Levels**: Set based on urgency (high for payment/security issues)
4. **Admin Notes**: Use for internal tracking and communication
5. **Regular Cleanup**: Archive or delete old resolved messages

---

## Testing Checklist

### User Endpoints
- [ ] Get Terms & Conditions (public)
- [ ] Get Privacy Policy (public)
- [ ] Get FAQs (public)
- [ ] Submit contact message (unauthenticated)
- [ ] Submit contact message (authenticated)
- [ ] Get my contact messages (authenticated)

### Admin Endpoints
- [ ] Create Terms & Conditions
- [ ] Update Terms & Conditions
- [ ] Create Privacy Policy
- [ ] Create FAQs
- [ ] Get all content
- [ ] Get all contact messages
- [ ] Filter contacts by status
- [ ] Filter contacts by priority
- [ ] Get contact statistics
- [ ] Get contact by ID
- [ ] Update contact status
- [ ] Delete contact message

---

**Last Updated:** February 18, 2026  
**API Version:** 1.0  
**Maintained By:** Bootble Development Team
