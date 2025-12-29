const Ticket = require('../models/Ticket');
const TicketTier = require('../models/TicketTier');
const Event = require('../models/Event');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const QRGenerator = require('../utils/qrGenerator');
const MpesaService = require('../config/mpesa');
const EmailService = require('../utils/email');
const { v4: uuidv4 } = require('uuid');

class TicketController {
  async initiatePurchase(req, res, next) {
    try {
      const { eventId, tierId, buyerName, buyerPhone, phone } = req.body;

      // Validate event
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      // Validate ticket tier
      const ticketTier = await TicketTier.findById(tierId);
      if (!ticketTier || ticketTier.eventId.toString() !== eventId) {
        return res.status(404).json({
          success: false,
          message: 'Ticket tier not found'
        });
      }

      // Check ticket availability
      if (!ticketTier.isAvailable()) {
        return res.status(400).json({
          success: false,
          message: 'No tickets available for this tier'
        });
      }

      // Calculate amounts
      const ticketPrice = ticketTier.price;
      const platformFee = 20; // KES 20 per ticket
      const hostFee = 15; // KES 15 per ticket
      const totalAmount = ticketPrice + platformFee;
      const netAmount = ticketPrice - hostFee;

      // Generate ticket data
      const ticketId = new Ticket()._id; // Generate ID for QR
      const qrData = QRGenerator.generateQRData(ticketId, eventId, buyerPhone);
      const qrBuffer = await QRGenerator.generateQRCode(qrData);

      // Create temporary ticket (pending payment)
      const ticket = await Ticket.create({
        eventId,
        tierId,
        buyerName,
        buyerPhone,
        qrCode: qrBuffer.toString('base64'),
        qrCodeData: qrData,
        totalAmount,
        platformFee,
        hostFee,
        netAmount,
        paymentStatus: 'PENDING'
      });

      // Initiate M-Pesa payment
      const mpesaResponse = await MpesaService.initiateSTKPush(
        phone,
        totalAmount,
        `TICKET-${ticket._id.toString().substring(0, 8).toUpperCase()}`,
        `Ticket for ${event.name}`
      );

      // Update ticket with checkout request ID
      ticket.checkoutRequestID = mpesaResponse.CheckoutRequestID;
      await ticket.save();

      // Create transaction record
      await Transaction.create({
        ticketId: ticket._id,
        eventId,
        amount: totalAmount,
        paymentMethod: 'MPESA',
        phoneNumber: phone,
        status: 'PENDING',
        metadata: mpesaResponse
      });

      res.json({
        success: true,
        checkoutRequestID: mpesaResponse.CheckoutRequestID,
        message: 'Payment initiated successfully',
        ticket: {
          id: ticket._id,
          amount: totalAmount,
          status: 'PENDING'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getTicket(req, res, next) {
    try {
      const { ticketId } = req.params;

      const ticket = await Ticket.findById(ticketId)
        .populate('eventId', 'name startDate location.address')
        .populate('tierId', 'name price');

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      // Only allow ticket owner or event host to view
      const isOwner = ticket.buyerPhone === req.user?.phone;
      const isHost = req.user && 
                     ticket.eventId.hostId && 
                     ticket.eventId.hostId.toString() === req.user._id.toString();

      if (!isOwner && !isHost) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this ticket'
        });
      }

      res.json({
        success: true,
        ticket
      });
    } catch (error) {
      next(error);
    }
  }

  async getTicketByQRData(req, res, next) {
    try {
      const { qrData } = req.params;

      const ticket = await Ticket.findOne({ qrCodeData: qrData })
        .populate('eventId', 'name startDate endDate location.address')
        .populate('tierId', 'name price');

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      res.json({
        success: true,
        ticket
      });
    } catch (error) {
      next(error);
    }
  }

  async downloadQRCode(req, res, next) {
    try {
      const { ticketId } = req.params;

      const ticket = await Ticket.findById(ticketId);
      
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      // Check if user is the ticket owner
      if (ticket.buyerPhone !== req.user?.phone && 
          (!req.user || ticket.eventId.toString() !== req.user._id.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to download this QR code'
        });
      }

      // Convert base64 QR code to buffer
      const qrBuffer = Buffer.from(ticket.qrCode, 'base64');

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename=ticket-${ticketId}.png`);
      res.send(qrBuffer);
    } catch (error) {
      next(error);
    }
  }

  async getUserTickets(req, res, next) {
    try {
      const phone = req.user.phone;

      const tickets = await Ticket.find({ buyerPhone: phone })
        .populate('eventId', 'name bannerUrl startDate location.address')
        .populate('tierId', 'name price')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        tickets
      });
    } catch (error) {
      next(error);
    }
  }

  async getEventTickets(req, res, next) {
    try {
      const { eventId } = req.params;
      const user = req.user;

      // Verify event exists and user is host
      const event = await Event.findById(eventId);
      if (!event || event.hostId.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view tickets for this event'
        });
      }

      const tickets = await Ticket.find({ eventId })
        .populate('tierId', 'name price')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        tickets
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TicketController();