const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { protect, hostOnly } = require('../middlewares/authMiddleware');
const { withdrawalValidation, validateRequest } = require('../utils/validation');

router.use(protect);
router.use(hostOnly);

router.post('/request', withdrawalValidation, validateRequest, withdrawalController.requestWithdrawal);
router.get('/', withdrawalController.getWithdrawals);
router.get('/stats', withdrawalController.getWithdrawalStats);

// Admin routes
router.get('/all', withdrawalController.getAllWithdrawals);
router.put('/:withdrawalId/process', withdrawalController.processWithdrawal);

module.exports = router;