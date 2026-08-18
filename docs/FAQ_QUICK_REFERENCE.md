# FAQ System - Quick Reference

## 🎯 Overview

The FAQ system now supports **multiple individual FAQ items** with categories, ordering, and full CRUD operations.

---

## 🔗 Quick Endpoint Reference

### User Endpoints (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/content/faqs` | Get all active FAQs |
| GET | `/api/content/faqs?category=General` | Filter by category |

### Admin Endpoints (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/faqs` | Create new FAQ |
| GET | `/api/admin/faqs` | Get all FAQs (admin view) |
| GET | `/api/admin/faqs/:id` | Get FAQ by ID |
| PUT | `/api/admin/faqs/:id` | Update FAQ |
| DELETE | `/api/admin/faqs/:id` | Delete FAQ |
| GET | `/api/admin/faqs/categories/list` | Get all categories |
| PATCH | `/api/admin/faqs/reorder` | Bulk reorder FAQs |

---

## 📊 Data Model

```javascript
{
  question: String (max 500 chars, required),
  answer: String (max 5000 chars, required),
  category: String (max 100 chars, default: 'General'),
  order: Number (default: 0),
  isActive: Boolean (default: true),
  createdBy: ObjectId,
  updatedBy: ObjectId
}
```

---

## 🚀 Quick Examples

### Create FAQ

```json
POST /api/admin/faqs
Authorization: Bearer <admin_token>

{
  "question": "What is Bootble?",
  "answer": "A fitness app for shift workers.",
  "category": "General",
  "order": 1
}
```

### Get All FAQs (Public)

```http
GET /api/content/faqs
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "faqs": [ /* array of FAQs */ ],
    "groupedByCategory": {
      "General": [ /* FAQs */ ],
      "Subscription": [ /* FAQs */ ]
    },
    "total": 10
  }
}
```

### Update FAQ

```json
PUT /api/admin/faqs/:id
Authorization: Bearer <admin_token>

{
  "answer": "Updated answer...",
  "order": 2
}
```

### Reorder FAQs

```json
PATCH /api/admin/faqs/reorder
Authorization: Bearer <admin_token>

{
  "faqs": [
    { "id": "faq_id_1", "order": 1 },
    { "id": "faq_id_2", "order": 2 },
    { "id": "faq_id_3", "order": 3 }
  ]
}
```

---

## 📂 Category Examples

- **General** - Basic app information
- **Getting Started** - Onboarding help
- **Subscription** - Payment & billing
- **Features** - Feature explanations
- **Technical Support** - Troubleshooting
- **Account** - Profile management

---

## ✅ Key Features

- ✅ Multiple individual FAQs
- ✅ Category-based organization
- ✅ Custom ordering within categories
- ✅ Active/Inactive status
- ✅ Full CRUD operations
- ✅ Bulk reordering
- ✅ Automatic grouping by category
- ✅ Public access (users)
- ✅ Admin management
- ✅ Creation/update tracking

---

## 🧪 Testing Checklist

Admin:
- [ ] Create FAQ
- [ ] Get all FAQs
- [ ] Get FAQ by ID
- [ ] Update FAQ
- [ ] Delete FAQ
- [ ] Get categories
- [ ] Reorder FAQs

User:
- [ ] Get all FAQs (public)
- [ ] Filter by category

---

## 📝 Best Practices

1. Use consistent category names
2. Order FAQs logically (1, 2, 3...)
3. Keep questions concise
4. Provide complete answers
5. Deactivate instead of delete (for history)
6. Group related FAQs in same category

---

## 🔄 Changes from Old System

**Before:** Single FAQ document with HTML content  
**After:** Multiple individual FAQ items with categories

**Migration:** Create individual FAQs from old content, then delete old document.

---

**Version:** 2.0  
**Status:** ✅ Ready to Use  
**Full Docs:** See `FAQ_MANAGEMENT_API.md`
