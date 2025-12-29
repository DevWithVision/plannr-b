const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const eventSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true
  },
  bannerUrl: {
    type: String,
    required: [true, 'Banner URL is required']
  },
  description: {
    type: String,
    required: [true, 'Event description is required']
  },
  guests: [{
    type: String,
    trim: true
  }],
  location: {
    latitude: {
      type: Number,
      required: [true, 'Latitude is required']
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required']
    },
    address: {
      type: String,
      required: [true, 'Address is required']
    }
  },
  tiers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketTier'
  }],
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalTicketsSold: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  publicId: {
    type: String,
    unique: true,
    required: true
  },
  category: {
    type: String,
    enum: ['Music', 'Conference', 'Workshop', 'Networking', 'Sports', 'Art', 'Food', 'Other'],
    default: 'Other'
  },
  maxAttendees: {
    type: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate public ID before validation
eventSchema.pre('validate', function(next) {
  if (!this.publicId) {
    this.publicId = `EVENT${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

module.exports = mongoose.model('Event', eventSchema);