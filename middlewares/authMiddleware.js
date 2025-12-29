const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    next(error);
  }
};

const hostOnly = async (req, res, next) => {
  try {
    if (!req.user.isHost) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Host privileges required.'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, isHost: user.isHost },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

const volunteerAuth = async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Scan access code is required'
      });
    }

    // The actual validation will be done in the controller
    req.scanCode = code;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect, hostOnly, generateToken, volunteerAuth };