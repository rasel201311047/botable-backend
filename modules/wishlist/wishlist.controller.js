const Wishlist = require('./wishlist.model');
const validator = require('validator');
const logger = require('../../utils/logger');

class WishlistController {
  /**
   * @desc    Join wishlist / waitlist
   * @route   POST /api/wishlist
   * @access  Public
   */
  static async joinWishlist(req, res, next) {
    try {
      const rawEmail = req.body.email;
      const source = req.body.source || 'landing_page';

      if (!rawEmail || typeof rawEmail !== 'string') {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide a valid email address',
        });
      }

      const email = rawEmail.trim().toLowerCase();

      if (!validator.isEmail(email)) {
        return res.status(400).json({
          status: 'error',
          message: 'Please provide a valid email address',
        });
      }

      // Check if already in wishlist
      let entry = await Wishlist.findOne({ email });
      if (entry) {
        return res.status(200).json({
          status: 'success',
          message: 'Your email has already been listed in our wishlist!',
          data: entry,
        });
      }

      entry = await Wishlist.create({ email, source });

      res.status(201).json({
        status: 'success',
        message: 'Your email has been listed successfully!',
        data: entry,
      });
    } catch (error) {
      logger.error(`Wishlist join error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get all wishlist entries with pagination and search
   * @route   GET /api/admin/wishlist
   * @access  Private/Admin
   */
  static async getWishlist(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
      const search = (req.query.search || '').trim();

      const query = {};
      if (search) {
        query.email = { $regex: search, $options: 'i' };
      }

      const skip = (page - 1) * limit;

      const [items, total, totalAll] = await Promise.all([
        Wishlist.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Wishlist.countDocuments(query),
        Wishlist.countDocuments(),
      ]);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const joinedToday = await Wishlist.countDocuments({ createdAt: { $gte: todayStart } });

      res.status(200).json({
        status: 'success',
        data: {
          items,
          pagination: {
            total,
            page,
            pages: Math.ceil(total / limit) || 1,
            limit,
          },
          stats: {
            totalCount: totalAll,
            joinedToday,
          },
        },
      });
    } catch (error) {
      logger.error(`Get wishlist error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Export all wishlist emails as CSV
   * @route   GET /api/admin/wishlist/export
   * @access  Private/Admin
   */
  static async exportWishlistCsv(req, res, next) {
    try {
      const search = (req.query.search || '').trim();
      const query = {};
      if (search) {
        query.email = { $regex: search, $options: 'i' };
      }

      const items = await Wishlist.find(query).sort({ createdAt: -1 }).lean();

      // Generate CSV content
      const headers = ['Email', 'Source', 'Joined Date (UTC)', 'Joined Date (Local)'];
      const rows = items.map((item) => {
        const d = new Date(item.createdAt);
        const iso = d.toISOString();
        const local = d.toLocaleString();
        return `"${item.email.replace(/"/g, '""')}","${(item.source || 'landing_page').replace(/"/g, '""')}","${iso}","${local}"`;
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="bootble_wishlist.csv"');
      res.status(200).send(csvContent);
    } catch (error) {
      logger.error(`Export wishlist CSV error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Delete wishlist entry
   * @route   DELETE /api/admin/wishlist/:id
   * @access  Private/Admin
   */
  static async deleteWishlistEntry(req, res, next) {
    try {
      const { id } = req.params;
      const entry = await Wishlist.findByIdAndDelete(id);

      if (!entry) {
        return res.status(404).json({
          status: 'error',
          message: 'Wishlist entry not found',
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Wishlist entry deleted successfully',
      });
    } catch (error) {
      logger.error(`Delete wishlist entry error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = WishlistController;
