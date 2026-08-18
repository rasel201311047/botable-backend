# Content Management System - Quick Reference

## 📋 Overview

Complete content management system for Terms & Conditions, Privacy Policy, FAQs, and Contact Support functionality.

---

## 🗂️ Files Created

### Models
- `modules/content/content.model.js` - Content model for terms, privacy, faqs
- `modules/content/contactMessage.model.js` - Contact messages model

### Controllers
- `modules/content/content.controller.js` - User-facing content & contact endpoints
- `admin/content/admin.content.controller.js` - Admin content management

### Routes
- `modules/content/content.routes.js` - User routes
- `admin/content/admin.content.routes.js` - Admin routes

### Documentation
- `CONTENT_MANAGEMENT_API.md` - Complete API documentation with examples

### Modified Files
- `app.js` - Added content routes
- `admin/admin.routes.js` - Added admin content routes

---

## 🔗 API Endpoints Summary

### User Endpoints (Public/Private)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/content/terms` | Public | Get Terms & Conditions |
| GET | `/api/content/privacy` | Public | Get Privacy Policy |
| GET | `/api/content/faqs` | Public | Get FAQs |
| POST | `/api/contact-support` | Public* | Submit support message |
| GET | `/api/my-contacts` | Private | Get my contact messages |

*Auth optional - attaches userId if authenticated

### Admin Endpoints (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/content/terms` | Create/Update Terms |
| POST | `/api/admin/content/privacy` | Create/Update Privacy |
| POST | `/api/admin/content/faqs` | Create/Update FAQs |
| GET | `/api/admin/content` | Get all content |
| GET | `/api/admin/contacts/stats` | Contact statistics |
| GET | `/api/admin/contacts` | Get all contacts (with filters) |
| GET | `/api/admin/contacts/:id` | Get contact by ID |
| PATCH | `/api/admin/contacts/:id` | Update contact status |
| DELETE | `/api/admin/contacts/:id` | Delete contact |

---

## 🚀 Quick Start Testing

### 1. Create Content (Admin)

```bash
# Terms & Conditions
POST {{BaseURL}}/admin/content/terms
Authorization: Bearer <admin_token>

{
  "title": "Terms & Conditions",
  "content": "<h1>Terms and Conditions</h1><p>Content here...</p>"
}
```

### 2. View Content (Public)

```bash
# Anyone can view
GET {{BaseURL}}/content/terms
GET {{BaseURL}}/content/privacy
GET {{BaseURL}}/content/faqs
```

### 3. Submit Contact (Anyone)

```bash
POST {{BaseURL}}/contact-support

{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Need help",
  "message": "I have a question about..."
}
```

### 4. Manage Contacts (Admin)

```bash
# Get all pending messages
GET {{BaseURL}}/admin/contacts?status=pending
Authorization: Bearer <admin_token>

# Update status
PATCH {{BaseURL}}/admin/contacts/:id
Authorization: Bearer <admin_token>

{
  "status": "resolved",
  "adminNotes": "Issue resolved"
}
```

---

## 📊 Data Models

### Content
- **type**: terms | privacy | faqs (unique)
- **title**: String (max 200)
- **content**: String (HTML supported)
- **version**: Number (auto-increments)
- **isActive**: Boolean
- **lastUpdatedBy**: User reference

### ContactMessage
- **userId**: User reference (optional)
- **name**: String (max 100)
- **email**: String (validated)
- **subject**: String (max 200)
- **message**: String (max 2000)
- **status**: pending | read | resolved | archived
- **priority**: low | medium | high
- **adminNotes**: String (max 1000, admin only)
- **resolvedBy**: User reference
- **resolvedAt**: Date

---

## 🔍 Query Parameters

### Get Contacts (Admin)
- `status` - Filter by status (pending, read, resolved, archived)
- `priority` - Filter by priority (low, medium, high)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

**Example:**
```
GET /api/admin/contacts?status=pending&priority=high&page=1&limit=10
```

---

## ✅ Features

### Admin Features
✅ Create/update Terms & Conditions  
✅ Create/update Privacy Policy  
✅ Create/update FAQs  
✅ View all content with version history  
✅ View all contact messages  
✅ Filter contacts by status/priority  
✅ Pagination support  
✅ Contact statistics dashboard  
✅ Update message status (pending→read→resolved→archived)  
✅ Set message priority  
✅ Add admin notes  
✅ Auto-track who resolved messages  
✅ Delete contact messages  

### User Features
✅ View Terms & Conditions  
✅ View Privacy Policy  
✅ View FAQs  
✅ Submit support messages (authenticated or not)  
✅ View own contact history (if authenticated)  
✅ Automatic userId attachment for logged-in users  

### System Features
✅ Version control for content  
✅ HTML content support  
✅ Auto-mark messages as "read" when viewed by admin  
✅ Secure authentication (admin only for management)  
✅ Input validation and sanitization  
✅ Indexed queries for performance  
✅ Pagination for large datasets  
✅ Proper error handling  

---

## 🔐 Security

- Admin endpoints protected by `protect` + `admin` middleware
- User contact history only visible to message owner
- Admin notes hidden from users
- Input validation on all fields
- XSS protection via middleware
- NoSQL injection protection

---

## 📝 Validation Rules

### Content
- title: Required, max 200 chars
- content: Required, no limit
- type: Must be 'terms', 'privacy', or 'faqs'

### Contact Message
- name: Required, max 100 chars
- email: Required, valid email format
- subject: Required, max 200 chars
- message: Required, max 2000 chars
- status: Must be pending/read/resolved/archived
- priority: Must be low/medium/high
- adminNotes: Optional, max 1000 chars

---

## 🎯 Best Practices

1. **Content Versioning**: Version auto-increments on updates
2. **Message Workflow**: pending → read → resolved → archived
3. **Priority Setting**: 
   - High: Payment, security, account access issues
   - Medium: Feature requests, general questions
   - Low: Minor suggestions, informational
4. **Admin Notes**: Use for internal tracking
5. **Regular Cleanup**: Archive old resolved messages

---

## 🧪 Testing Checklist

### User Tests
- [ ] View terms (public)
- [ ] View privacy (public)
- [ ] View FAQs (public)
- [ ] Submit contact (unauthenticated)
- [ ] Submit contact (authenticated)
- [ ] View my messages (authenticated)

### Admin Tests
- [ ] Create/update terms
- [ ] Create/update privacy
- [ ] Create/update FAQs
- [ ] View all content
- [ ] View all contacts
- [ ] Filter by status
- [ ] Filter by priority
- [ ] Get statistics
- [ ] View single contact
- [ ] Update contact status
- [ ] Add admin notes
- [ ] Delete contact

---

## 🛠️ Customization Options

### Email Notifications
To enable email notifications when users submit contact forms:

1. Open `modules/content/content.controller.js`
2. Find the `submitContact` method
3. Uncomment: `// await sendEmailToAdmin(contactMessage);`
4. Implement the email function using your email service

### Custom Statuses
To add custom contact statuses:

1. Edit `modules/content/contactMessage.model.js`
2. Add to status enum: `['pending', 'read', 'resolved', 'archived', 'your_status']`

### Auto-Assignment
To auto-assign high-priority messages to specific admins:

1. Modify `admin/content/admin.content.controller.js`
2. Add logic in `getAllContacts` or `getContactById`

---

## 📚 Full Documentation

See `CONTENT_MANAGEMENT_API.md` for:
- Complete endpoint documentation
- Request/response examples
- Error handling
- Postman collection setup
- Workflow examples
- Advanced usage patterns

---

## 🔄 Database Schema

```javascript
// Content Collection
{
  _id: ObjectId,
  type: String (unique: terms/privacy/faqs),
  title: String,
  content: String,
  version: Number,
  isActive: Boolean,
  lastUpdatedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// ContactMessages Collection
{
  _id: ObjectId,
  userId: ObjectId (optional),
  name: String,
  email: String,
  subject: String,
  message: String,
  status: String,
  priority: String,
  adminNotes: String,
  resolvedBy: ObjectId,
  resolvedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- Content: `{ type: 1, isActive: 1 }`
- ContactMessages: `{ status: 1, createdAt: -1 }`
- ContactMessages: `{ email: 1 }`
- ContactMessages: `{ userId: 1 }`

---

**Last Updated:** February 18, 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready
