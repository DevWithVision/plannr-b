const { body, param, query, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

const eventValidation = [
  body('name').notEmpty().withMessage('Event name is required'),
  body('description').notEmpty().withMessage('Event description is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('location.latitude').isFloat().withMessage('Valid latitude is required'),
  body('location.longitude').isFloat().withMessage('Valid longitude is required'),
  body('location.address').notEmpty().withMessage('Address is required'),
  body('bannerUrl').isURL().withMessage('Valid banner URL is required'),
  body('guests').optional().isArray().withMessage('Guests must be an array'),
  body('tiers').isArray().withMessage('Ticket tiers are required'),
  body('tiers.*.name').notEmpty().withMessage('Ticket tier name is required'),
  body('tiers.*.price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('tiers.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required'),
];

const ticketPurchaseValidation = [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('tierId').isMongoId().withMessage('Valid tier ID is required'),
  body('buyerName').notEmpty().withMessage('Buyer name is required'),
  body('buyerPhone').matches(/^[0-9+\-\s()]{10,}$/).withMessage('Valid phone number is required'),
  body('phone').matches(/^[0-9+\-\s()]{10,}$/).withMessage('Valid payment phone number is required'),
];

const scanCodeValidation = [
  body('code').notEmpty().withMessage('Scan access code is required'),
  body('volunteerName').optional().isString().withMessage('Volunteer name must be a string'),
];

const paymentCallbackValidation = [
  body('Body.stkCallback.CheckoutRequestID').notEmpty().withMessage('CheckoutRequestID is required'),
  body('Body.stkCallback.ResultCode').isInt().withMessage('ResultCode is required'),
  body('Body.stkCallback.CallbackMetadata').optional(),
];

const withdrawalValidation = [
  body('amount').isFloat({ min: 100 }).withMessage('Minimum withdrawal amount is KES 100'),
  body('bankDetails.accountNumber').optional().isString(),
  body('bankDetails.bankName').optional().isString(),
  body('bankDetails.mpesaNumber').optional().isString(),
  body('eventId').optional().isMongoId().withMessage('Valid event ID is required'),
];

module.exports = {
  validateRequest,
  eventValidation,
  ticketPurchaseValidation,
  scanCodeValidation,
  paymentCallbackValidation,
  withdrawalValidation,
};