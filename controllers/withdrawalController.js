const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Event = require('../models/Event');

class WithdrawalController {
  async requestWithdrawal(req, res, next) {
    try {
      const user = req.user;
      const { amount, eventId, bankDetails } = req.body;

      // Validate host
      if (!user.isHost) {
        return res.status(403).json({
          success: false,
          message: 'Only hosts can request withdrawals'
        });
      }

      // Check if user has sufficient balance
      if (user.balance < amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance'
        });
      }

      // If event-specific withdrawal, verify event ownership and timing
      if (eventId) {
        const event = await Event.findById(eventId);
        
        if (!event || event.hostId.toString() !== user._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to withdraw from this event'
          });
        }

        // Check if 24 hours have passed since event ended
        const now = new Date();
        const eventEnd = new Date(event.endDate);
        const twentyFourHoursAfterEvent = new Date(eventEnd.getTime() + 24 * 60 * 60 * 1000);

        if (now < twentyFourHoursAfterEvent) {
          return res.status(400).json({
            success: false,
            message: 'Withdrawals can only be requested 24 hours after the event ends',
            availableAt: twentyFourHoursAfterEvent
          });
        }
      }

      // Create withdrawal request
      const withdrawal = await Withdrawal.create({
        hostId: user._id,
        eventId: eventId || null,
        amount,
        status: 'PENDING',
        bankDetails: bankDetails || user.bankDetails
      });

      // Deduct from user's balance (temporarily)
      user.balance -= amount;
      await user.save();

      res.status(201).json({
        success: true,
        withdrawal,
        message: 'Withdrawal request submitted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getWithdrawals(req, res, next) {
    try {
      const user = req.user;
      const { status } = req.query;

      let query = { hostId: user._id };
      if (status) {
        query.status = status;
      }

      const withdrawals = await Withdrawal.find(query)
        .populate('eventId', 'name startDate')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        withdrawals
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllWithdrawals(req, res, next) {
    try {
      // Admin endpoint - check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { status, page = 1, limit = 20 } = req.query;

      let query = {};
      if (status) {
        query.status = status;
      }

      const withdrawals = await Withdrawal.find(query)
        .populate('hostId', 'name email phone')
        .populate('eventId', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Withdrawal.countDocuments(query);

      res.json({
        success: true,
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async processWithdrawal(req, res, next) {
    try {
      const { withdrawalId } = req.params;
      const { status, notes } = req.body;

      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const withdrawal = await Withdrawal.findById(withdrawalId)
        .populate('hostId');

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message: 'Withdrawal not found'
        });
      }

      // If changing from PENDING to COMPLETED, process payment
      if (withdrawal.status === 'PENDING' && status === 'COMPLETED') {
        // Here you would integrate with your payment gateway
        // For now, we'll just mark as completed
        
        withdrawal.status = 'COMPLETED';
        withdrawal.processedAt = new Date();
        withdrawal.notes = notes;

        // Send email notification
        // await EmailService.sendWithdrawalConfirmation(
        //   withdrawal.hostId.email,
        //   withdrawal
        // );

      } else if (status === 'FAILED') {
        // If failed, refund the amount to host's balance
        withdrawal.status = 'FAILED';
        withdrawal.notes = notes;

        const host = await User.findById(withdrawal.hostId);
        if (host) {
          host.balance += withdrawal.amount;
          await host.save();
        }
      } else {
        withdrawal.status = status;
        if (notes) withdrawal.notes = notes;
      }

      await withdrawal.save();

      res.json({
        success: true,
        withdrawal,
        message: `Withdrawal ${status.toLowerCase()} successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  async getWithdrawalStats(req, res, next) {
    try {
      const user = req.user;

      const withdrawals = await Withdrawal.find({ hostId: user._id });

      const totalWithdrawn = withdrawals
        .filter(w => w.status === 'COMPLETED')
        .reduce((sum, w) => sum + w.amount, 0);

      const pendingWithdrawals = withdrawals
        .filter(w => w.status === 'PENDING')
        .reduce((sum, w) => sum + w.amount, 0);

      const failedWithdrawals = withdrawals
        .filter(w => w.status === 'FAILED')
        .reduce((sum, w) => sum + w.amount, 0);

      res.json({
        success: true,
        stats: {
          totalWithdrawn,
          pendingWithdrawals,
          failedWithdrawals,
          totalRequests: withdrawals.length,
          withdrawalHistory: withdrawals.slice(0, 10)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WithdrawalController();