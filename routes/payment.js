const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middlewares/authMiddleware');
const { paymentCallbackValidation, validateRequest } = require('../utils/validation');

// M-Pesa callback (no auth required)
router.post('/callback', paymentController.handlePaymentCallback);

// Protected routes
router.use(protect);

router.get('/status/:checkoutRequestID', paymentController.checkPaymentStatus);
router.get('/history', paymentController.getTransactionHistory);

module.exports = router;