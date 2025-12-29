const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  tierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketTier',
    required: true
  },
  buyerName: {
    type: String,
    required: [true, 'Buyer name is required'],
    trim: true
  },
  buyerPhone: {
    type: String,
    required: [true, 'Buyer phone is required'],
    trim: true
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
    default: 'PENDING'
  },
  qrCode: {
    type: String,
    required: true
  },
  qrCodeData: {
    type: String,
    required: true,
    unique: true
  },
  used: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date
  },
  checkoutRequestID: {
    type: String
  },
  mpesaReceiptNumber: {
    type: String
  },
  transactionDate: {
    type: Date
  },
  totalAmount: {
    type: Number,
    required: true
  },
  platformFee: {
    type: Number,
    default: 20
  },
  hostFee: {
    type: Number,
    default: 15
  },
  netAmount: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
ticketSchema.index({ qrCodeData: 1 });
ticketSchema.index({ eventId: 1, used: 1 });
ticketSchema.index({ buyerPhone: 1 });

// Method to mark ticket as used
ticketSchema.methods.markAsUsed = async function() {
  this.used = true;
  this.usedAt = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('Ticket', ticketSchema);