const Event = require('../models/Event');
const TicketTier = require('../models/TicketTier');
const ScanAccessCode = require('../models/ScanAccessCode');
const { v4: uuidv4 } = require('uuid');
const { getRedisClient } = require('../config/redis');

class EventController {
  async createEvent(req, res, next) {
    try {
      const { name, description, startDate, endDate, location, bannerUrl, guests, tiers } = req.body;
      const hostId = req.user._id;

      // Create event
      const event = await Event.create({
        hostId,
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        bannerUrl,
        guests: guests || [],
        tiers: []
      });

      // Create ticket tiers
      const createdTiers = await Promise.all(
        tiers.map(async tier => {
          const createdTier = await TicketTier.create({
            name: tier.name,
            price: tier.price,
            quantity: tier.quantity,
            eventId: event._id
          });
          return createdTier._id;
        })
      );

      // Update event with tier IDs
      event.tiers = createdTiers;
      await event.save();

      // Add event to user's created events
      req.user.eventsCreated.push(event._id);
      await req.user.save();

      // Clear cache for this host's events
      if (getRedisClient()) {
        await getRedisClient().del(`events:host:${hostId}`);
      }

      res.status(201).json({
        success: true,
        event: {
          id: event._id,
          publicId: event.publicId,
          name: event.name,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location,
          bannerUrl: event.bannerUrl,
          guests: event.guests,
          tiers: await TicketTier.find({ _id: { $in: createdTiers } }),
          publicLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/event/${event.publicId}`
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getEvent(req, res, next) {
    try {
      const { id } = req.params;

      // Try cache first
      let event;
      const cacheKey = `event:${id}`;
      
      if (getRedisClient()) {
        const cached = await getRedisClient().get(cacheKey);
        if (cached) {
          event = JSON.parse(cached);
        }
      }

      if (!event) {
        event = await Event.findById(id)
          .populate('tiers', 'name price quantity ticketsSold')
          .populate('hostId', 'name email phone')
          .lean();

        if (!event) {
          return res.status(404).json({
            success: false,
            message: 'Event not found'
          });
        }

        // Cache event for 5 minutes
        if (getRedisClient()) {
          await getRedisClient().setEx(cacheKey, 300, JSON.stringify(event));
        }
      }

      res.json({
        success: true,
        event
      });
    } catch (error) {
      next(error);
    }
  }

  async getEventByPublicId(req, res, next) {
    try {
      const { publicId } = req.params;

      // Try cache first
      let event;
      const cacheKey = `event:public:${publicId}`;
      
      if (getRedisClient()) {
        const cached = await getRedisClient().get(cacheKey);
        if (cached) {
          event = JSON.parse(cached);
        }
      }

      if (!event) {
        event = await Event.findOne({ publicId })
          .populate('tiers', 'name price quantity ticketsSold')
          .populate('hostId', 'name')
          .lean();

        if (!event) {
          return res.status(404).json({
            success: false,
            message: 'Event not found'
          });
        }

        // Cache event for 5 minutes
        if (getRedisClient()) {
          await getRedisClient().setEx(cacheKey, 300, JSON.stringify(event));
        }
      }

      res.json({
        success: true,
        event
      });
    } catch (error) {
      next(error);
    }
  }

  async getHostEvents(req, res, next) {
    try {
      const hostId = req.user._id;

      // Try cache first
      let events;
      const cacheKey = `events:host:${hostId}`;
      
      if (getRedisClient()) {
        const cached = await getRedisClient().get(cacheKey);
        if (cached) {
          events = JSON.parse(cached);
        }
      }

      if (!events) {
        events = await Event.find({ hostId })
          .populate('tiers', 'name price quantity ticketsSold')
          .sort({ createdAt: -1 })
          .lean();

        // Cache for 2 minutes
        if (getRedisClient()) {
          await getRedisClient().setEx(cacheKey, 120, JSON.stringify(events));
        }
      }

      res.json({
        success: true,
        events
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEvent(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const event = await Event.findById(id);
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      // Check if user is the host
      if (event.hostId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this event'
        });
      }

      // Update event
      Object.keys(updates).forEach(key => {
        if (key !== 'tiers' && updates[key] !== undefined) {
          event[key] = updates[key];
        }
      });

      await event.save();

      // Clear cache
      if (getRedisClient()) {
        await getRedisClient().del(`event:${id}`);
        await getRedisClient().del(`event:public:${event.publicId}`);
        await getRedisClient().del(`events:host:${req.user._id}`);
      }

      res.json({
        success: true,
        event
      });
    } catch (error) {
      next(error);
    }
  }

  async generateScanAccessCode(req, res, next) {
    try {
      const { eventId } = req.params;
      const { count = 1 } = req.body;

      const event = await Event.findById(eventId);
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      // Check if user is the host
      if (event.hostId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to generate codes for this event'
        });
      }

      // Generate codes
      const codes = [];
      for (let i = 0; i < count; i++) {
        const code = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
        const scanCode = await ScanAccessCode.create({
          eventId,
          code
        });
        codes.push({
          id: scanCode._id,
          code: scanCode.code,
          expiresAt: scanCode.expiresAt
        });
      }

      res.json({
        success: true,
        codes,
        message: `Generated ${count} scan access code${count > 1 ? 's' : ''}`
      });
    } catch (error) {
      next(error);
    }
  }

  async getEventStats(req, res, next) {
    try {
      const { eventId } = req.params;

      const event = await Event.findById(eventId);
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      // Check if user is the host
      if (event.hostId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view stats for this event'
        });
      }

      // Get ticket tiers with stats
      const tiers = await TicketTier.find({ eventId })
        .select('name price quantity ticketsSold');

      // Calculate revenue
      const ticketRevenue = tiers.reduce((sum, tier) => 
        sum + (tier.price * tier.ticketsSold), 0
      );

      // Calculate platform fees (KES 15 per ticket)
      const totalTicketsSold = tiers.reduce((sum, tier) => sum + tier.ticketsSold, 0);
      const platformFees = totalTicketsSold * 15;
      const netRevenue = ticketRevenue - platformFees;

      // Get scan codes
      const scanCodes = await ScanAccessCode.find({ eventId })
        .select('code isUsed usedBy usedAt createdAt')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        stats: {
          totalTicketsSold,
          totalRevenue: ticketRevenue,
          platformFees,
          netRevenue,
          availableBalance: event.endDate > new Date() ? 0 : netRevenue, // Only available after event
          tiers,
          scanCodes
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EventController();