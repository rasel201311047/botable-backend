# Content Management System - Testing Guide

## 🧪 How to Test Your Implementation

This guide will walk you through testing all the new content management features.

---

## 🚀 Quick Start

### Step 1: Ensure Server is Running

```powershell
# If server is not running, start it
node index.js
```

### Step 2: Get Admin Token

```http
POST {{BaseURL}}/admin/login
Content-Type: application/json

{
  "email": "your_admin@example.com",
  "password": "your_admin_password"
}
```

Save the token from the response.

---

## 📝 Test Scenarios

### Scenario 1: Admin Creates Terms & Conditions

**Request:**
```http
POST http://localhost:5000/api/admin/content/terms
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "title": "Terms & Conditions - Bootble",
  "content": "<h1>Terms and Conditions</h1><h2>1. Acceptance of Terms</h2><p>By accessing and using Bootble, you accept and agree to be bound by the terms and provisions of this agreement.</p><h2>2. Use License</h2><p>Permission is granted to temporarily download one copy of the materials on Bootble for personal, non-commercial transitory viewing only.</p><h2>3. User Responsibilities</h2><ul><li>Maintain the confidentiality of your account</li><li>Provide accurate information</li><li>Comply with all applicable laws</li></ul><p>Last updated: February 18, 2026</p>"
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "message": "Terms & Conditions saved successfully",
  "data": {
    "content": {
      "_id": "...",
      "type": "terms",
      "title": "Terms & Conditions - Bootble",
      "content": "...",
      "version": 1,
      "isActive": true,
      "lastUpdatedBy": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

---

### Scenario 2: Admin Creates Privacy Policy

**Request:**
```http
POST http://localhost:5000/api/admin/content/privacy
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "title": "Privacy Policy",
  "content": "<h1>Privacy Policy</h1><h2>Information We Collect</h2><p>We collect information you provide directly to us, including:</p><ul><li>Name and email address</li><li>Health and fitness data (workouts, meals, sleep)</li><li>Payment information (processed securely via Stripe)</li></ul><h2>How We Use Your Information</h2><p>We use the information we collect to provide, maintain, and improve our services.</p><h2>Data Security</h2><p>We implement appropriate security measures to protect your personal information.</p><p>Last updated: February 18, 2026</p>"
}
```

---

### Scenario 3: Admin Creates FAQs

**Request:**
```http
POST http://localhost:5000/api/admin/content/faqs
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "title": "Frequently Asked Questions",
  "content": "<h1>Frequently Asked Questions</h1><h2>General Questions</h2><h3>What is Bootble?</h3><p>Bootble is a comprehensive fitness app designed specifically for shift workers.</p><h3>How much does it cost?</h3><p>We offer a free plan with basic features, plus premium monthly ($9.99/month) and yearly ($89.99/year) subscriptions.</p><h2>Account & Subscription</h2><h3>Can I cancel my subscription?</h3><p>Yes, you can cancel anytime from your account settings.</p>"
}
```

---

### Scenario 4: User Views Terms (Public - No Auth)

**Request:**
```http
GET http://localhost:5000/api/content/terms
```

**Expected Response (200):**
```json
{
  "status": "success",
  "data": {
    "content": {
      "_id": "...",
      "type": "terms",
      "title": "Terms & Conditions - Bootble",
      "content": "<h1>Terms and Conditions</h1>...",
      "version": 1,
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

---

### Scenario 5: User Views Privacy (Public - No Auth)

**Request:**
```http
GET http://localhost:5000/api/content/privacy
```

---

### Scenario 6: User Views FAQs (Public - No Auth)

**Request:**
```http
GET http://localhost:5000/api/content/faqs
```

---

### Scenario 7: Unauthenticated User Submits Contact

**Request:**
```http
POST http://localhost:5000/api/contact-support
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "subject": "Issue with workout logging",
  "message": "I'm experiencing difficulties logging my workouts. When I try to save a workout, the app shows an error message. Can you please help?"
}
```

**Expected Response (201):**
```json
{
  "status": "success",
  "message": "Your message has been sent successfully. We will get back to you soon.",
  "data": {
    "messageId": "...",
    "createdAt": "..."
  }
}
```

---

### Scenario 8: Authenticated User Submits Contact

**Request:**
```http
POST http://localhost:5000/api/contact-support
Authorization: Bearer YOUR_USER_TOKEN
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane.smith@example.com",
  "subject": "Feature request - Smartwatch sync",
  "message": "It would be great if the app could sync with my Apple Watch to automatically log workouts and heart rate data."
}
```

---

### Scenario 9: User Views Their Own Messages

**Request:**
```http
GET http://localhost:5000/api/my-contacts
Authorization: Bearer YOUR_USER_TOKEN
```

**Expected Response (200):**
```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "_id": "...",
        "userId": "...",
        "name": "Jane Smith",
        "email": "jane.smith@example.com",
        "subject": "Feature request - Smartwatch sync",
        "message": "...",
        "status": "pending",
        "priority": "medium",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
}
```

---

### Scenario 10: Admin Views All Content

**Request:**
```http
GET http://localhost:5000/api/admin/content
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Expected Response (200):**
```json
{
  "status": "success",
  "data": {
    "contents": [
      {
        "_id": "...",
        "type": "terms",
        "title": "Terms & Conditions - Bootble",
        "content": "...",
        "version": 1,
        "isActive": true,
        "lastUpdatedBy": {
          "_id": "...",
          "name": "Admin User",
          "email": "admin@bootblefitness.com"
        },
        "createdAt": "...",
        "updatedAt": "..."
      }
      // ... privacy and faqs
    ]
  }
}
```

---

### Scenario 11: Admin Views Contact Statistics

**Request:**
```http
GET http://localhost:5000/api/admin/contacts/stats
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Expected Response (200):**
```json
{
  "status": "success",
  "data": {
    "total": 2,
    "pending": 2,
    "resolved": 0,
    "byStatus": [
      {
        "_id": "pending",
        "count": 2
      }
    ]
  }
}
```

---

### Scenario 12: Admin Views All Contacts

**Request:**
```http
GET http://localhost:5000/api/admin/contacts
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Expected Response (200):**
```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "_id": "...",
        "userId": {
          "_id": "...",
          "name": "Jane Smith",
          "email": "jane.smith@example.com",
          "profilePhoto": "..."
        },
        "name": "Jane Smith",
        "email": "jane.smith@example.com",
        "subject": "Feature request - Smartwatch sync",
        "message": "...",
        "status": "pending",
        "priority": "medium",
        "adminNotes": null,
        "resolvedBy": null,
        "resolvedAt": null,
        "createdAt": "...",
        "updatedAt": "..."
      },
      {
        "_id": "...",
        "userId": null,
        "name": "John Doe",
        "email": "john.doe@example.com",
        "subject": "Issue with workout logging",
        "message": "...",
        "status": "pending",
        "priority": "medium",
        "adminNotes": null,
        "resolvedBy": null,
        "resolvedAt": null,
        "createdAt": "...",
        "updatedAt": "..."
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

### Scenario 13: Admin Filters Pending Messages

**Request:**
```http
GET http://localhost:5000/api/admin/contacts?status=pending
Authorization: Bearer YOUR_ADMIN_TOKEN
```

---

### Scenario 14: Admin Views Single Contact

**Request:**
```http
GET http://localhost:5000/api/admin/contacts/MESSAGE_ID
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Note:** Replace `MESSAGE_ID` with actual ID from previous response.

**Expected:** Status automatically changes from "pending" to "read"

---

### Scenario 15: Admin Updates Contact Status

**Request:**
```http
PATCH http://localhost:5000/api/admin/contacts/MESSAGE_ID
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "status": "resolved",
  "priority": "low",
  "adminNotes": "Issue resolved. User was using an outdated app version. Advised to update from app store."
}
```

**Expected Response (200):**
```json
{
  "status": "success",
  "message": "Contact message updated successfully",
  "data": {
    "message": {
      "_id": "...",
      "userId": null,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "subject": "Issue with workout logging",
      "message": "...",
      "status": "resolved",
      "priority": "low",
      "adminNotes": "Issue resolved. User was using an outdated app version. Advised to update from app store.",
      "resolvedBy": {
        "_id": "...",
        "name": "Admin User",
        "email": "admin@bootblefitness.com"
      },
      "resolvedAt": "2026-02-18T15:30:00.000Z",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

---

### Scenario 16: Admin Deletes Contact

**Request:**
```http
DELETE http://localhost:5000/api/admin/contacts/MESSAGE_ID
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Expected Response (200):**
```json
{
  "status": "success",
  "message": "Contact message deleted successfully"
}
```

---

### Scenario 17: Admin Updates Terms (Version Increment)

**Request:**
```http
POST http://localhost:5000/api/admin/content/terms
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "title": "Terms & Conditions - Bootble",
  "content": "<h1>Terms and Conditions</h1><h2>1. Acceptance of Terms</h2><p>UPDATED CONTENT - By accessing and using Bootble, you accept and agree to be bound by the terms and provisions of this agreement.</p>"
}
```

**Expected:** Version number should increment from 1 to 2

---

## 🔍 Testing with Postman

### Step 1: Import Postman Environment

Create a new environment with these variables:

```json
{
  "BaseURL": "http://localhost:5000/api",
  "adminToken": "",
  "userToken": ""
}
```

### Step 2: Create Postman Collection

1. Create folder: "Content Management"
2. Create folder: "User Endpoints"
3. Create folder: "Admin Endpoints"
4. Import requests from above scenarios

### Step 3: Test Flow

1. Admin Login → Save token
2. Create Terms → Verify success
3. Create Privacy → Verify success
4. Create FAQs → Verify success
5. View Terms (no auth) → Verify public access
6. Submit Contact (no auth) → Verify stored
7. Submit Contact (with auth) → Verify userId attached
8. Admin view contacts → Verify both messages visible
9. Admin update status → Verify version tracking
10. User view own messages → Verify admin notes hidden

---

## ✅ Expected Results Checklist

After running all tests, you should have:

- [ ] 3 content items in database (terms, privacy, faqs)
- [ ] Content accessible to public (no auth required)
- [ ] At least 2 contact messages in database
- [ ] One message with userId (authenticated)
- [ ] One message without userId (unauthenticated)
- [ ] Admin can view all messages
- [ ] Status changes reflected in database
- [ ] Version numbers increment on updates
- [ ] resolvedBy and resolvedAt set when status = resolved
- [ ] Admin notes visible only to admin
- [ ] Pagination working for large datasets
- [ ] Filters working (status, priority)

---

## 🐛 Troubleshooting

### Issue: 401 Unauthorized
**Solution:** Ensure you're using a valid admin token for admin endpoints

### Issue: 404 Content Not Found
**Solution:** Create the content first using admin endpoints

### Issue: 400 Validation Error
**Solution:** Check all required fields are provided (name, email, subject, message)

### Issue: 403 Forbidden
**Solution:** Ensure the user has admin role for admin endpoints

---

## 📊 Monitor Database Changes

### View Content Collection
```javascript
// In MongoDB shell or Compass
use your_database_name
db.contents.find().pretty()
```

### View Contact Messages Collection
```javascript
db.contactmessages.find().pretty()
```

### Check Indexes
```javascript
db.contents.getIndexes()
db.contactmessages.getIndexes()
```

---

## 🎯 Performance Testing

### Test Pagination
```http
GET http://localhost:5000/api/admin/contacts?page=1&limit=5
GET http://localhost:5000/api/admin/contacts?page=2&limit=5
```

### Test Filters
```http
GET http://localhost:5000/api/admin/contacts?status=pending&priority=high
```

### Test with Large Dataset
Create 50+ contact messages and test:
- Query performance
- Pagination
- Filters
- Statistics

---

## 📚 Additional Resources

- **Complete API Docs:** `CONTENT_MANAGEMENT_API.md`
- **Quick Reference:** `CONTENT_MANAGEMENT_QUICK_REF.md`
- **Implementation Summary:** `CONTENT_MANAGEMENT_IMPLEMENTATION_SUMMARY.md`

---

## 🎉 Success Criteria

Your implementation is working correctly if:

1. ✅ Admin can create all 3 content types
2. ✅ Users can view all content without authentication
3. ✅ Users can submit contact forms (with or without auth)
4. ✅ All messages stored in database
5. ✅ Admin can view all messages with full details
6. ✅ Admin can filter by status and priority
7. ✅ Admin can update message status
8. ✅ Version tracking works for content updates
9. ✅ No errors in console
10. ✅ All endpoints return expected responses

---

**Happy Testing! 🚀**

If you encounter any issues, check the error logs and refer to the documentation files.
