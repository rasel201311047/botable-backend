const Content = require('../../modules/content/content.model');
const ContactMessage = require('../../modules/content/contactMessage.model');
const FAQ = require('../../modules/content/faq.model');
const logger = require('../../utils/logger');

class AdminContentController {
  /**
   * @desc    Create or Update Terms & Conditions
   * @route   POST /api/admin/content/terms
   * @access  Private/Admin
   */
  static async setTerms(req, res, next) {
    try {
      const { title, content } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          status: 'error',
          message: 'Title and content are required',
        });
      }

      let terms = await Content.findOne({ type: 'terms' });

      if (terms) {
        // Update existing
        terms.title = title;
        terms.content = content;
        terms.version += 1;
        terms.lastUpdatedBy = req.user.id;
        terms.updatedAt = Date.now();
        await terms.save();
      } else {
        // Create new
        terms = await Content.create({
          type: 'terms',
          title,
          content,
          lastUpdatedBy: req.user.id,
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Terms & Conditions saved successfully',
        data: { content: terms },
      });
    } catch (error) {
      logger.error(`Set terms error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Create or Update Privacy Policy
   * @route   POST /api/admin/content/privacy
   * @access  Private/Admin
   */
  static async setPrivacy(req, res, next) {
    try {
      const { title, content } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          status: 'error',
          message: 'Title and content are required',
        });
      }

      let privacy = await Content.findOne({ type: 'privacy' });

      if (privacy) {
        // Update existing
        privacy.title = title;
        privacy.content = content;
        privacy.version += 1;
        privacy.lastUpdatedBy = req.user.id;
        privacy.updatedAt = Date.now();
        await privacy.save();
      } else {
        // Create new
        privacy = await Content.create({
          type: 'privacy',
          title,
          content,
          lastUpdatedBy: req.user.id,
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Privacy Policy saved successfully',
        data: { content: privacy },
      });
    } catch (error) {
      logger.error(`Set privacy error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Create a new FAQ
   * @route   POST /api/admin/faqs
   * @access  Private/Admin
   */
  static async createFaq(req, res, next) {
    try {
      const { question, answer, category, order } = req.body;

      if (!question || !answer) {
        return res.status(400).json({
          status: 'error',
          message: 'Question and answer are required',
        });
      }

      const faq = await FAQ.create({
        question: question.trim(),
        answer: answer.trim(),
        category: category ? category.trim() : 'General',
        order: order || 0,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      });

      const populatedFaq = await FAQ.findById(faq._id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      res.status(201).json({
        status: 'success',
        message: 'FAQ created successfully',
        data: { faq: populatedFaq },
      });
    } catch (error) {
      logger.error(`Create FAQ error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get all FAQs (admin view)
   * @route   GET /api/admin/faqs
   * @access  Private/Admin
   */
  static async getAllFaqs(req, res, next) {
    try {
      const { category, isActive } = req.query;

      const query = {};
      if (category) query.category = category;
      if (isActive !== undefined) query.isActive = isActive === 'true';

      const faqs = await FAQ.find(query)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort({ category: 1, order: 1 });

      // Group by category
      const groupedFaqs = faqs.reduce((acc, faq) => {
        const cat = faq.category || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(faq);
        return acc;
      }, {});

      res.status(200).json({
        status: 'success',
        data: {
          faqs,
          groupedByCategory: groupedFaqs,
          total: faqs.length,
        },
      });
    } catch (error) {
      logger.error(`Get all FAQs error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get single FAQ by ID (admin view)
   * @route   GET /api/admin/faqs/:id
   * @access  Private/Admin
   */
  static async getFaqById(req, res, next) {
    try {
      const faq = await FAQ.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!faq) {
        return res.status(404).json({
          status: 'error',
          message: 'FAQ not found',
        });
      }

      res.status(200).json({
        status: 'success',
        data: { faq },
      });
    } catch (error) {
      logger.error(`Get FAQ by ID error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Update FAQ
   * @route   PUT /api/admin/faqs/:id
   * @access  Private/Admin
   */
  static async updateFaq(req, res, next) {
    try {
      const { question, answer, category, order, isActive } = req.body;

      const faq = await FAQ.findById(req.params.id);

      if (!faq) {
        return res.status(404).json({
          status: 'error',
          message: 'FAQ not found',
        });
      }

      // Update fields
      if (question !== undefined) faq.question = question.trim();
      if (answer !== undefined) faq.answer = answer.trim();
      if (category !== undefined) faq.category = category.trim();
      if (order !== undefined) faq.order = order;
      if (isActive !== undefined) faq.isActive = isActive;
      faq.updatedBy = req.user.id;

      await faq.save();

      const updatedFaq = await FAQ.findById(faq._id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      res.status(200).json({
        status: 'success',
        message: 'FAQ updated successfully',
        data: { faq: updatedFaq },
      });
    } catch (error) {
      logger.error(`Update FAQ error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Delete FAQ
   * @route   DELETE /api/admin/faqs/:id
   * @access  Private/Admin
   */
  static async deleteFaq(req, res, next) {
    try {
      const faq = await FAQ.findById(req.params.id);

      if (!faq) {
        return res.status(404).json({
          status: 'error',
          message: 'FAQ not found',
        });
      }

      await faq.deleteOne();

      res.status(200).json({
        status: 'success',
        message: 'FAQ deleted successfully',
      });
    } catch (error) {
      logger.error(`Delete FAQ error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get FAQ categories
   * @route   GET /api/admin/faqs/categories/list
   * @access  Private/Admin
   */
  static async getFaqCategories(req, res, next) {
    try {
      const categories = await FAQ.distinct('category');

      res.status(200).json({
        status: 'success',
        data: { categories },
      });
    } catch (error) {
      logger.error(`Get FAQ categories error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Bulk update FAQ order
   * @route   PATCH /api/admin/faqs/reorder
   * @access  Private/Admin
   */
  static async reorderFaqs(req, res, next) {
    try {
      const { faqs } = req.body; // Array of { id, order }

      if (!Array.isArray(faqs) || faqs.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'FAQs array is required',
        });
      }

      const updatePromises = faqs.map(item =>
        FAQ.findByIdAndUpdate(
          item.id,
          { order: item.order, updatedBy: req.user.id },
          { returnDocument: 'after' },
        ),
      );

      await Promise.all(updatePromises);

      res.status(200).json({
        status: 'success',
        message: 'FAQs reordered successfully',
      });
    } catch (error) {
      logger.error(`Reorder FAQs error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get all content (for admin view)
   * @route   GET /api/admin/content
   * @access  Private/Admin
   */
  static async getAllContent(req, res, next) {
    try {
      const contents = await Content.find().populate('lastUpdatedBy', 'name email').sort({ type: 1 });

      res.status(200).json({
        status: 'success',
        data: { contents },
      });
    } catch (error) {
      logger.error(`Get all content error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get all contact messages
   * @route   GET /api/admin/contacts
   * @access  Private/Admin
   */
  static async getAllContacts(req, res, next) {
    try {
      const { status, priority, page = 1, limit = 20 } = req.query;

      const query = {};
      if (status) query.status = status;
      if (priority) query.priority = priority;

      const skip = (page - 1) * limit;

      const [messages, total] = await Promise.all([
        ContactMessage.find(query)
          .populate('userId', 'name email profilePhoto')
          .populate('resolvedBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        ContactMessage.countDocuments(query),
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          messages,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error(`Get all contacts error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get single contact message details
   * @route   GET /api/admin/contacts/:id
   * @access  Private/Admin
   */
  static async getContactById(req, res, next) {
    try {
      const message = await ContactMessage.findById(req.params.id)
        .populate('userId', 'name email profilePhoto phone')
        .populate('resolvedBy', 'name email');

      if (!message) {
        return res.status(404).json({
          status: 'error',
          message: 'Contact message not found',
        });
      }

      // Auto-mark as read when viewed by admin
      if (message.status === 'pending') {
        message.status = 'read';
        await message.save();
      }

      res.status(200).json({
        status: 'success',
        data: { message },
      });
    } catch (error) {
      logger.error(`Get contact by ID error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Update contact message status
   * @route   PATCH /api/admin/contacts/:id
   * @access  Private/Admin
   */
  static async updateContactStatus(req, res, next) {
    try {
      const { status, priority, adminNotes } = req.body;

      const message = await ContactMessage.findById(req.params.id);

      if (!message) {
        return res.status(404).json({
          status: 'error',
          message: 'Contact message not found',
        });
      }

      // Update fields
      if (status) {
        message.status = status;
        if (status === 'resolved') {
          message.resolvedBy = req.user.id;
          message.resolvedAt = Date.now();
        }
      }
      if (priority) message.priority = priority;
      if (adminNotes !== undefined) message.adminNotes = adminNotes;

      await message.save();

      const updatedMessage = await ContactMessage.findById(message._id)
        .populate('userId', 'name email')
        .populate('resolvedBy', 'name email');

      res.status(200).json({
        status: 'success',
        message: 'Contact message updated successfully',
        data: { message: updatedMessage },
      });
    } catch (error) {
      logger.error(`Update contact status error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Delete contact message
   * @route   DELETE /api/admin/contacts/:id
   * @access  Private/Admin
   */
  static async deleteContact(req, res, next) {
    try {
      const message = await ContactMessage.findById(req.params.id);

      if (!message) {
        return res.status(404).json({
          status: 'error',
          message: 'Contact message not found',
        });
      }

      await message.deleteOne();

      res.status(200).json({
        status: 'success',
        message: 'Contact message deleted successfully',
      });
    } catch (error) {
      logger.error(`Delete contact error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get contact statistics
   * @route   GET /api/admin/contacts/stats
   * @access  Private/Admin
   */
  static async getContactStats(req, res, next) {
    try {
      const [totalMessages, pendingMessages, resolvedMessages, stats] = await Promise.all([
        ContactMessage.countDocuments(),
        ContactMessage.countDocuments({ status: 'pending' }),
        ContactMessage.countDocuments({ status: 'resolved' }),
        ContactMessage.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          total: totalMessages,
          pending: pendingMessages,
          resolved: resolvedMessages,
          byStatus: stats,
        },
      });
    } catch (error) {
      logger.error(`Get contact stats error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = AdminContentController;
