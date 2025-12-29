const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, volunteerAuth } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../utils/validation');

router.post('/signup', async (req, res, next) => {
  // Basic validation
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, phone, and password'
    });
  }
  await authController.signup(req, res, next);
});

router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password'
    });
  }
  await authController.login(req, res, next);
});

router.post('/volunteer-login', volunteerAuth, authController.volunteerLogin);

router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);

module.exports = router;