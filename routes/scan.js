const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');
const { protect, volunteerAuth } = require('../middlewares/authMiddleware');
const { scanCodeValidation, validateRequest } = require('../utils/validation');

// Volunteer routes
router.post('/validate', volunteerAuth, scanController.validateTicket);
router.post('/scan', volunteerAuth, scanController.scanAndValidate);
router.post('/mark-used', volunteerAuth, scanController.markTicketUsed);

// Host routes
router.get('/stats/:eventId', protect, scanController.getScanStats);

module.exports = router;