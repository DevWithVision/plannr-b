const qr = require('qr-image');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getRedisClient } = require('../config/redis');

class QRGenerator {
  constructor() {
    this.redisClient = getRedisClient();
  }

  generateQRData(ticketId, eventId, buyerPhone) {
    const data = {
      ticketId: ticketId.toString(),
      eventId: eventId.toString(),
      phone: buyerPhone,
      timestamp: Date.now(),
      nonce: uuidv4()
    };

    // Create a signature for verification
    const signature = crypto
      .createHmac('sha256', process.env.QR_SECRET || 'qr-secret-key')
      .update(JSON.stringify(data))
      .digest('hex');

    data.signature = signature;
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  async generateQRCode(data) {
    try {
      const qr_png = qr.image(data, { type: 'png' });
      const chunks = [];
      
      return new Promise((resolve, reject) => {
        qr_png.on('data', chunk => chunks.push(chunk));
        qr_png.on('end', () => resolve(Buffer.concat(chunks)));
        qr_png.on('error', reject);
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  async validateQRData(qrData) {
    try {
      // Check cache first
      if (this.redisClient) {
        const cached = await this.redisClient.get(`qr:${qrData}`);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      const decoded = Buffer.from(qrData, 'base64').toString();
      const data = JSON.parse(decoded);

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.QR_SECRET || 'qr-secret-key')
        .update(JSON.stringify({
          ticketId: data.ticketId,
          eventId: data.eventId,
          phone: data.phone,
          timestamp: data.timestamp,
          nonce: data.nonce
        }))
        .digest('hex');

      if (expectedSignature !== data.signature) {
        return { valid: false, reason: 'Invalid QR code signature' };
      }

      // Check if QR code was generated within last 4 hours before event
      // This will be checked with actual event time in the scan controller

      // Cache the validation result for 5 minutes
      if (this.redisClient) {
        await this.redisClient.setEx(
          `qr:${qrData}`,
          300,
          JSON.stringify({ valid: true, data })
        );
      }

      return { valid: true, data };
    } catch (error) {
      console.error('Error validating QR data:', error);
      return { valid: false, reason: 'Invalid QR code format' };
    }
  }

  async cacheTicketValidation(ticketId, result) {
    if (this.redisClient) {
      await this.redisClient.setEx(
        `ticket:valid:${ticketId}`,
        300, // 5 minutes
        JSON.stringify(result)
      );
    }
  }

  async getCachedTicketValidation(ticketId) {
    if (this.redisClient) {
      const cached = await this.redisClient.get(`ticket:valid:${ticketId}`);
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  }
}

module.exports = new QRGenerator();