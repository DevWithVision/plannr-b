const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { protect } = require('../middlewares/authMiddleware');
const { ticketPurchaseValidation, validateRequest } = require('../utils/validation');

// Public routes (for QR code access)
router.get('/qr/:qrData', ticketController.getTicketByQRData);

// Protected routes
router.use(protect);

router.post('/purchase', ticketPurchaseValidation, validateRequest, ticketController.initiatePurchase);
router.get('/user', ticketController.getUserTickets);
router.get('/:ticketId', ticketController.getTicket);
router.get('/:ticketId/download-qr', ticketController.downloadQRCode);
router.get('/event/:eventId', protect, ticketController.getEventTickets);

module.exports = router;