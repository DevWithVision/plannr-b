const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const QRGenerator = require('../utils/qrGenerator');
const { getRedisClient } = require('../config/redis');

class ScanController {
  async validateTicket(req, res, next) {
    try {
      const { qrData } = req.body;
      const { eventId } = req.volunteer || {};

      // Validate QR data
      const validation = await QRGenerator.validateQRData(qrData);
      
      if (!validation.valid) {
        return res.json({
          success: false,
          valid: false,
          message: validation.reason || 'Invalid QR code'
        });
      }

      const { data } = validation;

      // Check cached validation
      const cachedValidation = await QRGenerator.getCachedTicketValidation(data.ticketId);
      if (cachedValidation) {
        return res.json(cachedValidation);
      }

      // Find ticket
      const ticket = await Ticket.findById(data.ticketId)
        .populate('eventId', 'name startDate endDate');

      if (!ticket) {
        const result = {
          success: false,
          valid: false,
          message: 'Ticket not found'
        };
        await QRGenerator.cacheTicketValidation(data.ticketId, result);
        return res.json(result);
      }

      // Verify event matches
      if (eventId && ticket.eventId._id.toString() !== eventId.toString()) {
        const result = {
          success: false,
          valid: false,
          message: 'Ticket is for a different event'
        };
        await QRGenerator.cacheTicketValidation(data.ticketId, result);
        return res.json(result);
      }

      // Check if ticket is already used
      if (ticket.used) {
        const result = {
          success: false,
          valid: false,
          message: 'Ticket already used',
          usedAt: ticket.usedAt
        };
        await QRGenerator.cacheTicketValidation(data.ticketId, result);
        return res.json(result);
      }

      // Check payment status
      if (ticket.paymentStatus !== 'SUCCESS') {
        const result = {
          success: false,
          valid: false,
          message: 'Ticket payment not completed'
        };
        await QRGenerator.cacheTicketValidation(data.ticketId, result);
        return res.json(result);
      }

      // Check if QR code is active (4 hours before event)
      const eventStart = new Date(ticket.eventId.startDate);
      const fourHoursBefore = new Date(eventStart.getTime() - 4 * 60 * 60 * 1000);
      const now = new Date();

      if (now < fourHoursBefore) {
        const result = {
          success: false,
          valid: false,
          message: 'QR code not active yet. Active 4 hours before event.',
          activeFrom: fourHoursBefore
        };
        await QRGenerator.cacheTicketValidation(data.ticketId, result);
        return res.json(result);
      }

      // Check if event has ended
      const eventEnd = new Date(ticket.eventId.endDate);
      if (now > eventEnd) {
        const result = {
          success: false,
          valid: false,
          message: 'Event has ended'
        };
        await QRGenerator.cacheTicketValidation(data.ticketId, result);
        return res.json(result);
      }

      // All checks passed - ticket is valid
      const result = {
        success: true,
        valid: true,
        message: 'Ticket is valid',
        ticket: {
          id: ticket._id,
          buyerName: ticket.buyerName,
          tierName: ticket.tierId?.name,
          eventName: ticket.eventId.name
        }
      };

      // Cache validation result
      await QRGenerator.cacheTicketValidation(data.ticketId, result);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async markTicketUsed(req, res, next) {
    try {
      const { ticketId } = req.body;

      const ticket = await Ticket.findById(ticketId);
      
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      // Mark ticket as used
      await ticket.markAsUsed();

      // Clear cache
      if (getRedisClient()) {
        await getRedisClient().del(`ticket:valid:${ticketId}`);
      }

      res.json({
        success: true,
        message: 'Ticket marked as used',
        ticket: {
          id: ticket._id,
          used: ticket.used,
          usedAt: ticket.usedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async scanAndValidate(req, res, next) {
    try {
      const { qrData } = req.body;
      const { eventId } = req.volunteer || {};

      // First validate the ticket
      const validation = await QRGenerator.validateQRData(qrData);
      
      if (!validation.valid) {
        return res.json({
          success: false,
          valid: false,
          action: 'scan',
          message: validation.reason || 'Invalid QR code'
        });
      }

      const { data } = validation;

      // Find ticket
      const ticket = await Ticket.findById(data.ticketId)
        .populate('eventId', 'name startDate endDate')
        .populate('tierId', 'name');

      if (!ticket) {
        return res.json({
          success: false,
          valid: false,
          action: 'scan',
          message: 'Ticket not found'
        });
      }

      // Verify event matches volunteer's event
      if (eventId && ticket.eventId._id.toString() !== eventId.toString()) {
        return res.json({
          success: false,
          valid: false,
          action: 'scan',
          message: 'Ticket is for a different event'
        });
      }

      // Check if already used
      if (ticket.used) {
        return res.json({
          success: false,
          valid: false,
          action: 'scan',
          message: 'Ticket already used',
          usedAt: ticket.usedAt,
          ticket: {
            buyerName: ticket.buyerName,
            eventName: ticket.eventId.name
          }
        });
      }

      // Check payment status
      if (ticket.paymentStatus !== 'SUCCESS') {
        return res.json({
          success: false,
          valid: false,
          action: 'scan',
          message: 'Ticket payment not completed'
        });
      }

      // Check if QR is active
      const eventStart = new Date(ticket.eventId.startDate);
      const fourHoursBefore = new Date(eventStart.getTime() - 4 * 60 * 60 * 1000);
      const now = new Date();

      if (now < fourHoursBefore) {
        return res.json({
          success: false,
          valid: false,
          action: 'scan',
          message: 'QR code not active yet',
          activeFrom: fourHoursBefore
        });
      }

      // Check if event has ended
      const eventEnd = new Date(ticket.eventId.endDate);
      if (now > eventEnd) {
        return res.json({
          success: false,
          valid: false,
          action: 'scan',
          message: 'Event has ended'
        });
      }

      // Mark ticket as used
      await ticket.markAsUsed();

      // Clear cache
      if (getRedisClient()) {
        await getRedisClient().del(`ticket:valid:${ticket._id}`);
      }

      res.json({
        success: true,
        valid: true,
        action: 'scan',
        message: 'Ticket validated and marked as used',
        ticket: {
          id: ticket._id,
          buyerName: ticket.buyerName,
          tierName: ticket.tierId?.name,
          eventName: ticket.eventId.name,
          usedAt: ticket.usedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getScanStats(req, res, next) {
    try {
      const { eventId } = req.params;
      const user = req.user;

      // Verify user is host of this event
      const event = await Event.findById(eventId);
      if (!event || event.hostId.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view scan stats for this event'
        });
      }

      // Get all tickets for this event
      const tickets = await Ticket.find({ eventId })
        .select('buyerName used usedAt tierId')
        .populate('tierId', 'name price');

      const totalTickets = tickets.length;
      const usedTickets = tickets.filter(t => t.used).length;
      const unusedTickets = totalTickets - usedTickets;

      // Get usage by tier
      const tierStats = {};
      tickets.forEach(ticket => {
        const tierName = ticket.tierId?.name || 'Unknown';
        if (!tierStats[tierName]) {
          tierStats[tierName] = { total: 0, used: 0 };
        }
        tierStats[tierName].total++;
        if (ticket.used) tierStats[tierName].used++;
      });

      res.json({
        success: true,
        stats: {
          totalTickets,
          usedTickets,
          unusedTickets,
          usageRate: totalTickets > 0 ? (usedTickets / totalTickets * 100).toFixed(2) : 0,
          tierStats,
          recentScans: tickets
            .filter(t => t.used)
            .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
            .slice(0, 20)
            .map(t => ({
              buyerName: t.buyerName,
              tier: t.tierId?.name,
              usedAt: t.usedAt
            }))
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ScanController();