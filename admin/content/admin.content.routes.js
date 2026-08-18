const express = require('express');
const router = express.Router();
const AdminContentController = require('./admin.content.controller');
const { protect, admin } = require('../../middlewares/auth.middleware');

// Protect all routes and restrict to admin
router.use(protect);
router.use(admin);

// Content Management Routes
router.post('/content/terms', AdminContentController.setTerms);
router.post('/content/privacy', AdminContentController.setPrivacy);
router.get('/content', AdminContentController.getAllContent);

// FAQ Management Routes (Multiple FAQs)
router.get('/faqs/categories/list', AdminContentController.getFaqCategories);
router.patch('/faqs/reorder', AdminContentController.reorderFaqs);
router.post('/faqs', AdminContentController.createFaq);
router.get('/faqs', AdminContentController.getAllFaqs);
router.get('/faqs/:id', AdminContentController.getFaqById);
router.put('/faqs/:id', AdminContentController.updateFaq);
router.delete('/faqs/:id', AdminContentController.deleteFaq);

// Contact Messages Management Routes
router.get('/contacts/stats', AdminContentController.getContactStats);
router.get('/contacts', AdminContentController.getAllContacts);
router.get('/contacts/:id', AdminContentController.getContactById);
router.patch('/contacts/:id', AdminContentController.updateContactStatus);
router.delete('/contacts/:id', AdminContentController.deleteContact);

module.exports = router;
