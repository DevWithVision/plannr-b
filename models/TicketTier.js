const mongoose = require('mongoose');

const ticketTierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ticket tier name is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: 1
  },
  ticketsSold: {
    type: Number,
    default: 0,
    min: 0
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Check if tickets are available
ticketTierSchema.methods.isAvailable = function() {
  return this.ticketsSold < this.quantity;
};

// Reserve a ticket
ticketTierSchema.methods.reserveTicket = async function() {
  if (!this.isAvailable()) {
    throw new Error('No tickets available for this tier');
  }
  this.ticketsSold += 1;
  await this.save();
  return this.ticketsSold;
};

module.exports = mongoose.model('TicketTier', ticketTierSchema);