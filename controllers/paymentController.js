const Ticket = require('../models/Ticket');
const Transaction = require('../models/Transaction');
const Event = require('../models/Event');
const TicketTier = require('../models/TicketTier');
const User = require('../models/User');
const MpesaService = require('../config/mpesa');
const EmailService = require('../utils/email');
const { getRedisClient } = require('../config/redis');

class PaymentController {
  async handlePaymentCallback(req, res, next) {
    try {
      const callbackData = req.body;
      
      // Extract callback data
      const stkCallback = callbackData.Body.stkCallback;
      const checkoutRequestID = stkCallback.CheckoutRequestID;
      const resultCode = stkCallback.ResultCode;
      const callbackMetadata = stkCallback.CallbackMetadata;

      // Find ticket by checkout request ID
      const ticket = await Ticket.findOne({ checkoutRequestID });
      
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found for this payment'
        });
      }

      // Find transaction
      const transaction = await Transaction.findOne({ 
        ticketId: ticket._id,
        status: 'PENDING'
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      // Update based on result code
      if (resultCode === 0) {
        // Payment successful
        ticket.paymentStatus = 'SUCCESS';
        transaction.status = 'SUCCESS';

        // Extract M-Pesa details
        if (callbackMetadata && callbackMetadata.Item) {
          const items = callbackMetadata.Item;
          items.forEach(item => {
            if (item.Name === 'MpesaReceiptNumber') {
              ticket.mpesaReceiptNumber = item.Value;
              transaction.mpesaReceiptNumber = item.Value;
            }
            if (item.Name === 'PhoneNumber') {
              transaction.phoneNumber = item.Value;
            }
            if (item.Name === 'TransactionDate') {
              const dateStr = item.Value.toString();
              const year = dateStr.substring(0, 4);
              const month = dateStr.substring(4, 6);
              const day = dateStr.substring(6, 8);
              const hour = dateStr.substring(8, 10);
              const minute = dateStr.substring(10, 12);
              const second = dateStr.substring(12, 14);
              
              const transactionDate = new Date(
                `${year}-${month}-${day}T${hour}:${minute}:${second}`
              );
              
              ticket.transactionDate = transactionDate;
              transaction.transactionDate = transactionDate;
            }
          });
        }

        // Reserve ticket
        const ticketTier = await TicketTier.findById(ticket.tierId);
        if (ticketTier) {
          await ticketTier.reserveTicket();
        }

        // Update event stats
        await Event.findByIdAndUpdate(ticket.eventId, {
          $inc: {
            totalTicketsSold: 1,
            totalRevenue: ticket.totalAmount - 20 // Subtract platform fee
          }
        });

        // Update host balance (only after event ends)
        const event = await Event.findById(ticket.eventId);
        const host = await User.findById(event.hostId);
        
        if (host) {
          host.balance += ticket.netAmount;
          await host.save();
        }

        // Send email notification
        const eventDetails = await Event.findById(ticket.eventId)
          .select('name startDate location.address');
          
        if (eventDetails) {
          const qrBuffer = Buffer.from(ticket.qrCode, 'base64');
          await EmailService.sendTicketEmail(
            ticket.buyerPhone + '@example.com', // In production, get email from user
            {
              buyerName: ticket.buyerName,
              eventName: eventDetails.name,
              eventDate: eventDetails.startDate,
              eventLocation: eventDetails.location.address,
              ticketTier: ticketTier?.name || 'General',
              amount: ticket.totalAmount
            },
            qrBuffer
          );
        }

        // Clear cache
        if (getRedisClient()) {
          await getRedisClient().del(`event:${ticket.eventId}`);
          await getRedisClient().del(`events:host:${event.hostId}`);
        }

      } else {
        // Payment failed
        ticket.paymentStatus = 'FAILED';
        transaction.status = 'FAILED';
      }

      await ticket.save();
      await transaction.save();

      // Update transaction metadata
      transaction.metadata = callbackData;
      await transaction.save();

      // Send response to M-Pesa
      res.json({
        ResultCode: 0,
        ResultDesc: "Callback processed successfully"
      });

    } catch (error) {
      console.error('Error processing payment callback:', error);
      res.json({
        ResultCode: 1,
        ResultDesc: "Error processing callback"
      });
    }
  }

  async checkPaymentStatus(req, res, next) {
    try {
      const { checkoutRequestID } = req.params;

      // Check with M-Pesa
      const statusResponse = await MpesaService.checkTransactionStatus(checkoutRequestID);

      // Find ticket and transaction
      const ticket = await Ticket.findOne({ checkoutRequestID });
      const transaction = await Transaction.findOne({ 
        ticketId: ticket?._id 
      });

      res.json({
        success: true,
        mpesaStatus: statusResponse,
        ticket: ticket ? {
          id: ticket._id,
          status: ticket.paymentStatus,
          amount: ticket.totalAmount
        } : null,
        transaction: transaction ? {
          id: transaction._id,
          status: transaction.status,
          mpesaReceiptNumber: transaction.mpesaReceiptNumber
        } : null
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransactionHistory(req, res, next) {
    try {
      const user = req.user;

      let transactions;
      if (user.isHost) {
        // Get transactions for host's events
        const events = await Event.find({ hostId: user._id }).select('_id');
        const eventIds = events.map(event => event._id);
        
        transactions = await Transaction.find({ eventId: { $in: eventIds } })
          .populate('ticketId', 'buyerName buyerPhone')
          .populate('eventId', 'name')
          .sort({ createdAt: -1 });
      } else {
        // Get transactions for buyer
        const tickets = await Ticket.find({ buyerPhone: user.phone }).select('_id');
        const ticketIds = tickets.map(ticket => ticket._id);
        
        transactions = await Transaction.find({ ticketId: { $in: ticketIds } })
          .populate('ticketId', 'buyerName buyerPhone')
          .populate('eventId', 'name')
          .sort({ createdAt: -1 });
      }

      res.json({
        success: true,
        transactions
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();