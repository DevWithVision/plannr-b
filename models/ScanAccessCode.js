const mongoose = require('mongoose');

const scanAccessCodeSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  usedBy: {
    type: String,
    trim: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      const date = new Date();
      date.setDate(date.getDate() + 7); // Code expires in 7 days
      return date;
    }
  }
});

// Check if code is valid
scanAccessCodeSchema.methods.isValid = function() {
  return !this.isUsed && new Date() < this.expiresAt;
};

// Mark code as used
scanAccessCodeSchema.methods.markAsUsed = async function(volunteerName = '') {
  this.isUsed = true;
  this.usedBy = volunteerName;
  this.usedAt = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('ScanAccessCode', scanAccessCodeSchema);