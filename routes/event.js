const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { protect, hostOnly } = require('../middlewares/authMiddleware');
const { eventValidation, validateRequest } = require('../utils/validation');

// Public routes
router.get('/public/:publicId', eventController.getEventByPublicId);

// Protected routes
router.use(protect);

// Host-only routes
router.post('/', hostOnly, eventValidation, validateRequest, eventController.createEvent);
router.get('/host', hostOnly, eventController.getHostEvents);
router.get('/:id', eventController.getEvent);
router.put('/:id', hostOnly, eventController.updateEvent);
router.post('/:eventId/scan-codes', hostOnly, eventController.generateScanAccessCode);
router.get('/:eventId/stats', hostOnly, eventController.getEventStats);

module.exports = router;