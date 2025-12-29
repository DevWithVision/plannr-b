const User = require('../models/User');
const { generateToken } = require('../middlewares/authMiddleware');
const ScanAccessCode = require('../models/ScanAccessCode');
const Event = require('../models/Event');

class AuthController {
  async signup(req, res, next) {
    try {
      const { name, email, phone, password, isHost, bankDetails } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [{ email }, { phone }] 
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or phone already exists'
        });
      }

      // Create user
      const user = await User.create({
        name,
        email,
        phone,
        password,
        isHost: isHost || false,
        bankDetails: bankDetails || {}
      });

      // Generate token
      const token = generateToken(user);

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isHost: user.isHost,
          balance: user.balance
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email }).select('+password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate token
      const token = generateToken(user);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isHost: user.isHost,
          balance: user.balance
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async volunteerLogin(req, res, next) {
    try {
      const { code, volunteerName = 'Volunteer' } = req.body;

      // Find scan access code
      const scanCode = await ScanAccessCode.findOne({ code });
      
      if (!scanCode) {
        return res.status(404).json({
          success: false,
          message: 'Invalid scan access code'
        });
      }

      // Check if code is valid
      if (!scanCode.isValid()) {
        return res.status(400).json({
          success: false,
          message: 'Scan access code is expired or already used'
        });
      }

      // Get event details
      const event = await Event.findById(scanCode.eventId)
        .select('name bannerUrl startDate location.address')
        .lean();

      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      // Mark code as used
      await scanCode.markAsUsed(volunteerName);

      // Generate temporary token for scanning (valid for 24 hours)
      const token = generateToken({
        _id: scanCode._id,
        eventId: scanCode.eventId,
        type: 'volunteer'
      });

      res.json({
        success: true,
        token,
        event,
        scanCode: {
          id: scanCode._id,
          code: scanCode.code
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      res.json({
        success: true,
        user: req.user
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { name, phone, bankDetails } = req.body;
      const user = req.user;

      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (bankDetails) {
        user.bankDetails = {
          ...user.bankDetails,
          ...bankDetails
        };
      }

      await user.save();

      res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isHost: user.isHost,
          balance: user.balance,
          bankDetails: user.bankDetails
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();