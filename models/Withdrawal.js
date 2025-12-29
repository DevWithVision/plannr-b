const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  bankDetails: {
    accountNumber: String,
    bankName: String,
    mpesaNumber: String
  },
  processedAt: {
    type: Date
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Check if withdrawal can be processed
withdrawalSchema.methods.canProcess = function(eventEndDate) {
  const now = new Date();
  const eventEnd = new Date(eventEndDate);
  const twentyFourHoursAfterEvent = new Date(eventEnd.getTime() + 24 * 60 * 60 * 1000);
  
  return now >= twentyFourHoursAfterEvent && this.status === 'PENDING';
};

module.exports = mongoose.model('Withdrawal', withdrawalSchema);