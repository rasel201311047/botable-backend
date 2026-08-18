const User = require('../../modules/user/user.model');
const { stripe } = require('../../config/stripe');
const logger = require('../../utils/logger');

class AdminSubscriptionsController {
  /**
   * @desc    Get all subscriptions with comprehensive filters
   * @route   GET /api/admin/subscriptions
   * @access  Private/Admin
   */
  static async getSubscriptions(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        plan,
        status,
        search,
        period,
        year
      } = req.query;

      // Build query - Only show users with paid subscriptions
      const query = {
        'subscription.plan': { $in: ['monthly', 'yearly'] }
      };
      
      // Filter by plan
      if (plan && plan !== 'all') {
        query['subscription.plan'] = plan;
      }
      
      // Filter by status
      if (status && status !== 'all') {
        if (status === 'active') {
          query['subscription.isActive'] = true;
        } else if (status === 'inactive' || status === 'cancelled') {
          query['subscription.isActive'] = false;
        } else if (status === 'pending' || status === 'rejected') {
          query['subscription.status'] = status;
        }
      }
      
      // Search by name, email, or phone
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } }
        ];
      }

      // Date filter based on period
      if (period || year) {
        const now = new Date();
        const targetYear = year ? parseInt(year) : now.getFullYear();
        let dateFilter = {};

        switch (period) {
          case 'today':
            dateFilter = { 
              $gte: new Date(now.setHours(0, 0, 0, 0)),
              $lte: new Date(now.setHours(23, 59, 59, 999))
            };
            break;
          case 'week':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - 7);
            dateFilter = { $gte: weekStart };
            break;
          case 'month':
            const monthStart = new Date(targetYear, now.getMonth(), 1);
            const monthEnd = new Date(targetYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
            dateFilter = { $gte: monthStart, $lte: monthEnd };
            break;
          case 'year':
            const yearStart = new Date(targetYear, 0, 1);
            const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59, 999);
            dateFilter = { $gte: yearStart, $lte: yearEnd };
            break;
          default:
            if (year) {
              const yearStart = new Date(targetYear, 0, 1);
              const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59, 999);
              dateFilter = { $gte: yearStart, $lte: yearEnd };
            }
        }

        if (Object.keys(dateFilter).length > 0) {
          query['subscription.startDate'] = dateFilter;
        }
      }

      const skip = (page - 1) * limit;

      const users = await User.find(query)
        .select('name email phoneNumber profilePhoto subscription createdAt height weight location')
        .sort({ 'subscription.startDate': -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await User.countDocuments(query);

      // Format subscriptions with comprehensive information
      const subscriptions = users.map(user => {
        const planPrice = user.subscription.plan === 'monthly' ? 10 : 100;
        const renewalDate = new Date(user.subscription.startDate);
        
        if (user.subscription.plan === 'monthly') {
          renewalDate.setMonth(renewalDate.getMonth() + 1);
        } else {
          renewalDate.setFullYear(renewalDate.getFullYear() + 1);
        }

        return {
          userId: user._id,
          // User Info
          username: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber || 'N/A',
          profilePhoto: user.profilePhoto || null,
          
          // Physical Info
          height: user.height || 'N/A',
          weight: user.weight || 'N/A',
          location: user.location || { city: 'N/A', country: 'N/A' },
          
          // Subscription Info
          planName: user.subscription.plan === 'monthly' ? 'Monthly' : 'Yearly',
          plan: user.subscription.plan,
          subscriptionAmount: planPrice,
          
          // Dates
          subscriptionDate: user.subscription.startDate,
          startDate: user.subscription.startDate,
          endDate: user.subscription.endDate || renewalDate,
          renewalDate: renewalDate,
          joinDate: user.createdAt,
          
          // Status & Payment
          status: user.subscription.status || (user.subscription.isActive ? 'active' : 'inactive'),
          isActive: user.subscription.isActive,
          paymentMethod: user.subscription.stripeCustomerId ? 'Stripe' : 'Local',
          
          // Stripe Info
          stripeCustomerId: user.subscription.stripeCustomerId || null,
          stripeSubscriptionId: user.subscription.stripeSubscriptionId || null
        };
      });

      // Get subscription statistics
      const stats = await AdminSubscriptionsController.getSubscriptionStatsDetailed(query);

      res.status(200).json({
        status: 'success',
        data: {
          subscriptions,
          stats,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          },
          filters: {
            plan: plan || 'all',
            status: status || 'all',
            period: period || 'all',
            year: year || new Date().getFullYear()
          }
        }
      });
    } catch (error) {
      logger.error(`Admin get subscriptions error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get payment history
   * @route   GET /api/admin/payments
   * @access  Private/Admin
   */
  static async getPayments(req, res, next) {
    try {
      const { limit = 50, startingAfter } = req.query;

      let payments = [];
      
      if (process.env.STRIPE_SECRET_KEY) {
        try {
          const stripePayments = await stripe.paymentIntents.list({
            limit: parseInt(limit),
            starting_after: startingAfter
          });

          payments = stripePayments.data.map(payment => ({
            id: payment.id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: payment.status,
            customer: payment.customer,
            created: new Date(payment.created * 1000),
            description: payment.description
          }));
        } catch (stripeError) {
          logger.error(`Stripe payments error: ${stripeError.message}`);
          // Continue with empty payments array
        }
      }

      // Get local subscription data as fallback
      if (payments.length === 0) {
        const paidSubscriptions = await User.find({
          'subscription.plan': { $in: ['monthly', 'yearly'] },
          'subscription.isActive': true
        })
        .select('name email subscription')
        .sort({ 'subscription.startDate': -1 })
        .limit(parseInt(limit))
        .lean();

        payments = paidSubscriptions.map(user => ({
          id: `local_${user._id}`,
          amount: user.subscription.plan === 'monthly' ? 10 : 100,
          currency: 'usd',
          status: 'succeeded',
          customer: user.email,
          created: user.subscription.startDate,
          description: `${user.subscription.plan} subscription`
        }));
      }

      res.status(200).json({
        status: 'success',
        data: payments
      });
    } catch (error) {
      logger.error(`Admin get payments error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Update user subscription manually (including status changes)
   * @route   PUT /api/admin/subscriptions/:userId
   * @access  Private/Admin
   */
  static async updateSubscription(req, res, next) {
    try {
      const { userId } = req.params;
      const { plan, isActive, endDate, status } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      // Update subscription fields
      if (plan) user.subscription.plan = plan;
      if (isActive !== undefined) user.subscription.isActive = isActive;
      if (endDate) user.subscription.endDate = new Date(endDate);
      if (status) user.subscription.status = status;

      await user.save();

      res.status(200).json({
        status: 'success',
        message: 'Subscription updated successfully',
        data: {
          userId: user._id,
          subscription: user.subscription
        }
      });
    } catch (error) {
      logger.error(`Admin update subscription error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get revenue statistics with year-wise filtering and monthly breakdown
   * @route   GET /api/admin/revenue?year=2026
   * @access  Private/Admin
   */
  static async getRevenueStats(req, res, next) {
    try {
      const { year } = req.query;
      const targetYear = parseInt(year) || new Date().getFullYear();

      // Build monthly revenue for the entire year
      const monthlyRevenue = [];
      let yearTotal = 0;

      for (let month = 1; month <= 12; month++) {
        const startDate = new Date(targetYear, month - 1, 1);
        const endDate = new Date(targetYear, month, 0, 23, 59, 59, 999);

        // Get new subscriptions started in this month
        const monthlyNewSubs = await User.countDocuments({
          'subscription.plan': 'monthly',
          'subscription.startDate': { $gte: startDate, $lte: endDate }
        });

        const yearlyNewSubs = await User.countDocuments({
          'subscription.plan': 'yearly',
          'subscription.startDate': { $gte: startDate, $lte: endDate }
        });

        // Get active subscriptions during this month (for MRR calculation)
        const monthlyActiveSubs = await User.countDocuments({
          'subscription.plan': 'monthly',
          'subscription.isActive': true,
          'subscription.startDate': { $lte: endDate }
        });

        const yearlyActiveSubs = await User.countDocuments({
          'subscription.plan': 'yearly',
          'subscription.isActive': true,
          'subscription.startDate': { $lte: endDate }
        });

        const revenueForMonth = (monthlyNewSubs * 10) + (yearlyNewSubs * 100);
        const mrr = (monthlyActiveSubs * 10) + (yearlyActiveSubs * 100 / 12);

        yearTotal += revenueForMonth;

        monthlyRevenue.push({
          month: month,
          monthName: new Date(targetYear, month - 1).toLocaleString('en-US', { month: 'long' }),
          year: targetYear,
          revenue: revenueForMonth,
          mrr: Math.round(mrr * 100) / 100,
          breakdown: {
            monthly: {
              newSubscriptions: monthlyNewSubs,
              revenue: monthlyNewSubs * 10
            },
            yearly: {
              newSubscriptions: yearlyNewSubs,
              revenue: yearlyNewSubs * 100
            }
          },
          activeSubscriptions: {
            monthly: monthlyActiveSubs,
            yearly: yearlyActiveSubs,
            total: monthlyActiveSubs + yearlyActiveSubs
          }
        });
      }

      // Calculate year totals
      const yearStartDate = new Date(targetYear, 0, 1);
      const yearEndDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);

      const totalMonthlyNewSubs = await User.countDocuments({
        'subscription.plan': 'monthly',
        'subscription.startDate': { $gte: yearStartDate, $lte: yearEndDate }
      });

      const totalYearlyNewSubs = await User.countDocuments({
        'subscription.plan': 'yearly',
        'subscription.startDate': { $gte: yearStartDate, $lte: yearEndDate }
      });

      // Get current active subscriptions
      const currentMonthlyActive = await User.countDocuments({
        'subscription.plan': 'monthly',
        'subscription.isActive': true
      });

      const currentYearlyActive = await User.countDocuments({
        'subscription.plan': 'yearly',
        'subscription.isActive': true
      });

      const currentMRR = (currentMonthlyActive * 10) + (currentYearlyActive * 100 / 12);
      const currentARR = currentMRR * 12;

      res.status(200).json({
        status: 'success',
        data: {
          year: targetYear,
          summary: {
            totalRevenue: yearTotal,
            currentMRR: Math.round(currentMRR * 100) / 100,
            currentARR: Math.round(currentARR * 100) / 100,
            totalNewSubscriptions: totalMonthlyNewSubs + totalYearlyNewSubs,
            breakdown: {
              monthly: {
                newSubscriptions: totalMonthlyNewSubs,
                revenue: totalMonthlyNewSubs * 10,
                currentActive: currentMonthlyActive
              },
              yearly: {
                newSubscriptions: totalYearlyNewSubs,
                revenue: totalYearlyNewSubs * 100,
                currentActive: currentYearlyActive
              }
            }
          },
          monthlyBreakdown: monthlyRevenue,
          chartData: {
            labels: monthlyRevenue.map(m => m.monthName),
            datasets: [
              {
                label: 'Revenue',
                data: monthlyRevenue.map(m => m.revenue)
              },
              {
                label: 'MRR',
                data: monthlyRevenue.map(m => m.mrr)
              }
            ]
          }
        }
      });
    } catch (error) {
      logger.error(`Admin get revenue stats error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get total subscriptions count with breakdown
   * @route   GET /api/admin/subscriptions/stats/total
   * @access  Private/Admin
   */
  static async getTotalSubscriptions(req, res, next) {
    try {
      const stats = await AdminSubscriptionsController.getSubscriptionStats();

      // Calculate totals
      const totalUsers = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
      const totalActive = Object.values(stats).reduce((sum, s) => sum + s.active, 0);
      const totalPaid = stats.monthly.total + stats.yearly.total;

      res.status(200).json({
        status: 'success',
        data: {
          summary: {
            totalUsers,
            totalActive,
            totalPaid,
            conversionRate: ((totalPaid / totalUsers) * 100).toFixed(2) + '%'
          },
          breakdown: {
            free: stats.free,
            monthly: stats.monthly,
            yearly: stats.yearly
          }
        }
      });
    } catch (error) {
      logger.error(`Get total subscriptions error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get monthly revenue and detailed analytics
   * @route   GET /api/admin/subscriptions/stats/revenue
   * @access  Private/Admin
   */
  static async getMonthlyRevenue(req, res, next) {
    try {
      const { month, year } = req.query;
      
      const now = new Date();
      const targetYear = parseInt(year) || now.getFullYear();
      const targetMonth = parseInt(month) || now.getMonth() + 1;

      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

      // Get active subscriptions
      const monthlySubs = await User.countDocuments({
        'subscription.plan': 'monthly',
        'subscription.isActive': true,
        'subscription.startDate': { $lte: endDate }
      });

      const yearlySubs = await User.countDocuments({
        'subscription.plan': 'yearly',
        'subscription.isActive': true,
        'subscription.startDate': { $lte: endDate }
      });

      const monthlyRevenue = monthlySubs * 10;
      const yearlyRevenue = yearlySubs * 100;
      const totalRevenue = monthlyRevenue + yearlyRevenue;

      // Get transactions from Stripe if available
      let stripeRevenue = null;
      if (process.env.STRIPE_SECRET_KEY) {
        try {
          const charges = await stripe.charges.list({
            limit: 100,
            created: {
              gte: Math.floor(startDate.getTime() / 1000),
              lte: Math.floor(endDate.getTime() / 1000)
            }
          });

          stripeRevenue = {
            totalCharges: charges.data.length,
            totalAmount: (charges.data.reduce((sum, charge) => sum + charge.amount, 0) / 100).toFixed(2),
            succeededCharges: charges.data.filter(c => c.status === 'succeeded').length,
            failedCharges: charges.data.filter(c => c.status === 'failed').length
          };
        } catch (stripeError) {
          logger.error(`Stripe revenue fetch error: ${stripeError.message}`);
        }
      }

      res.status(200).json({
        status: 'success',
        data: {
          period: `${targetMonth}/${targetYear}`,
          calculatedRevenue: {
            monthlySubscriptions: {
              count: monthlySubs,
              amount: monthlyRevenue
            },
            yearlySubscriptions: {
              count: yearlySubs,
              amount: yearlyRevenue
            },
            total: totalRevenue
          },
          stripeRevenue,
          metrics: {
            averageSubscriptionValue: totalRevenue / (monthlySubs + yearlySubs) || 0,
            mrr: monthlyRevenue + (yearlyRevenue / 12)
          }
        }
      });
    } catch (error) {
      logger.error(`Get monthly revenue error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get recent transactions with full customer details
   * @route   GET /api/admin/subscriptions/transactions
   * @access  Private/Admin
   */
  static async getRecentTransactions(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        period = 'all',
        plan,
        status = 'all'
      } = req.query;

      const skip = (page - 1) * limit;

      // Build date filter
      let dateFilter = {};
      const now = new Date();

      switch (period) {
        case 'today':
          dateFilter = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
          break;
        case 'week':
          dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
          break;
        case 'month':
          dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
          break;
        case 'year':
          dateFilter = { $gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) };
          break;
      }

      // Build query
      const query = {
        'subscription.plan': { $in: ['monthly', 'yearly'] }
      };

      if (plan && plan !== 'all') {
        query['subscription.plan'] = plan;
      }

      if (period !== 'all') {
        query['subscription.startDate'] = dateFilter;
      }

      // Build status filter
      if (status !== 'all') {
        if (status === 'active') {
          query['subscription.isActive'] = true;
        } else if (status === 'inactive') {
          query['subscription.isActive'] = false;
        }
      }

      // Get transactions
      const transactions = await User.find(query)
        .select('name email profilePhoto subscription')
        .sort({ 'subscription.startDate': -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await User.countDocuments(query);

      // Format transaction details
      const formattedTransactions = transactions.map(user => {
        const planPrice = user.subscription.plan === 'monthly' ? 10 : 100;
        const renewalDate = new Date(user.subscription.startDate);
        
        if (user.subscription.plan === 'monthly') {
          renewalDate.setMonth(renewalDate.getMonth() + 1);
        } else {
          renewalDate.setFullYear(renewalDate.getFullYear() + 1);
        }

        return {
          transactionId: `TXN_${user._id}_${user.subscription.startDate.getTime()}`,
          customer: {
            id: user._id,
            name: user.name,
            email: user.email,
            profilePhoto: user.profilePhoto || null
          },
          subscription: {
            plan: user.subscription.plan,
            planName: user.subscription.plan === 'monthly' ? 'Monthly' : 'Yearly'
          },
          payment: {
            amount: planPrice,
            currency: 'USD',
            status: user.subscription.isActive ? 'Active' : 'Inactive'
          },
          dates: {
            startDate: user.subscription.startDate,
            renewalDate: renewalDate,
            endDate: user.subscription.endDate || null
          },
          stripeDetails: {
            customerId: user.subscription.stripeCustomerId || 'N/A',
            subscriptionId: user.subscription.stripeSubscriptionId || 'N/A'
          },
          paymentMethod: user.subscription.stripeCustomerId ? 'Stripe' : 'Local',
          status: user.subscription.isActive ? 'Active' : 'Cancelled'
        };
      });

      res.status(200).json({
        status: 'success',
        data: {
          transactions: formattedTransactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          },
          filters: {
            period,
            plan: plan || 'all',
            status
          }
        }
      });
    } catch (error) {
      logger.error(`Get recent transactions error: ${error.message}`);
      next(error);
    }
  }

  /**
   * @desc    Get detailed transaction by ID
   * @route   GET /api/admin/subscriptions/transactions/:transactionId
   * @access  Private/Admin
   */
  static async getTransactionDetail(req, res, next) {
    try {
      const { transactionId } = req.params;

      // Extract userId from transaction ID
      const match = transactionId.match(/TXN_([a-f0-9]{24})_/);
      if (!match) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid transaction ID format'
        });
      }

      const userId = match[1];
      const user = await User.findById(userId)
        .select('name email profilePhoto subscription createdAt')
        .lean();

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Transaction not found'
        });
      }

      const planPrice = user.subscription.plan === 'monthly' ? 10 : 100;
      const renewalDate = new Date(user.subscription.startDate);
      
      if (user.subscription.plan === 'monthly') {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
      } else {
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      }

      res.status(200).json({
        status: 'success',
        data: {
          transactionId,
          customer: {
            id: user._id,
            name: user.name,
            email: user.email,
            profilePhoto: user.profilePhoto || null,
            memberSince: user.createdAt
          },
          subscription: {
            plan: user.subscription.plan,
            planName: user.subscription.plan === 'monthly' ? 'Monthly' : 'Yearly'
          },
          payment: {
            amount: planPrice,
            currency: 'USD',
            status: user.subscription.isActive ? 'Active' : 'Inactive'
          },
          dates: {
            startDate: user.subscription.startDate,
            renewalDate: renewalDate,
            endDate: user.subscription.endDate || null,
            daysUntilRenewal: Math.ceil((renewalDate - new Date()) / (1000 * 60 * 60 * 24))
          },
          stripeDetails: {
            customerId: user.subscription.stripeCustomerId || 'N/A',
            subscriptionId: user.subscription.stripeSubscriptionId || 'N/A'
          },
          paymentMethod: user.subscription.stripeCustomerId ? 'Stripe Card' : 'Local Payment',
          status: user.subscription.isActive ? 'Active' : 'Cancelled'
        }
      });
    } catch (error) {
      logger.error(`Get transaction detail error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get subscription statistics
   */
  static async getSubscriptionStats(startDate, endDate) {
    try {
      const matchStage = {};
      
      if (startDate && endDate) {
        matchStage.createdAt = { $gte: startDate, $lte: endDate };
      }

      const stats = await User.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 },
            active: {
              $sum: {
                $cond: [{ $eq: ['$subscription.isActive', true] }, 1, 0]
              }
            }
          }
        }
      ]);

      const formattedStats = {
        free: { total: 0, active: 0 },
        monthly: { total: 0, active: 0 },
        yearly: { total: 0, active: 0 }
      };

      stats.forEach(stat => {
        if (stat._id && formattedStats.hasOwnProperty(stat._id)) {
          formattedStats[stat._id] = {
            total: stat.count,
            active: stat.active
          };
        } else if (!stat._id) {
          formattedStats.free.total += stat.count;
          formattedStats.free.active += stat.active;
        }
      });

      return formattedStats;
    } catch (error) {
      logger.error(`Get subscription stats error: ${error.message}`);
      return { free: { total: 0, active: 0 }, monthly: { total: 0, active: 0 }, yearly: { total: 0, active: 0 } };
    }
  }

  /**
   * Get detailed subscription statistics for filtered queries
   */
  static async getSubscriptionStatsDetailed(query) {
    try {
      const totalSubscribers = await User.countDocuments(query);
      
      const activeSubscribers = await User.countDocuments({
        ...query,
        'subscription.isActive': true
      });

      const inactiveSubscribers = await User.countDocuments({
        ...query,
        'subscription.isActive': false
      });

      const monthlySubscribers = await User.countDocuments({
        ...query,
        'subscription.plan': 'monthly'
      });

      const yearlySubscribers = await User.countDocuments({
        ...query,
        'subscription.plan': 'yearly'
      });

      const totalRevenue = (monthlySubscribers * 10) + (yearlySubscribers * 100);

      return {
        totalSubscribers,
        activeSubscribers,
        inactiveSubscribers,
        monthlySubscribers,
        yearlySubscribers,
        totalRevenue,
        averageRevenuePerUser: totalSubscribers > 0 ? Math.round((totalRevenue / totalSubscribers) * 100) / 100 : 0
      };
    } catch (error) {
      logger.error(`Get detailed subscription stats error: ${error.message}`);
      return {
        totalSubscribers: 0,
        activeSubscribers: 0,
        inactiveSubscribers: 0,
        monthlySubscribers: 0,
        yearlySubscribers: 0,
        totalRevenue: 0,
        averageRevenuePerUser: 0
      };
    }
  }
}

module.exports = AdminSubscriptionsController;