
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Generate Access Token (15 min)
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "15m" });
};

// Generate Refresh Token (7 days)
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Register User
exports.registerUser = async (req, res, next) => {
  try {
    const { username, email, password, isAdmin } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required",
      });
    }

    // Normalize email to lowercase (matching login)
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    // Check existing user with normalized email
    const existingUser = await User.findOne({ 
      $or: [
        { email: normalizedEmail }, 
        { username: normalizedUsername }
      ] 
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username or email already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password.trim(), salt);

    // Create user
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      xp: 0,
      weeklyXp: 0,
      rank: "Novice",
      badges: [],
      isAdmin: isAdmin || false,
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        xp: user.xp,
        rank: user.rank,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Login User
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Email and password must be strings",
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and password cannot be empty",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // Find user (email is stored in lowercase in DB due to schema)
    console.log(`[LOGIN] Searching for user with email: ${trimmedEmail}`);
    const user = await User.findOne({ email: trimmedEmail }).select("+passwordHash");
    
    if (!user) {
      // Check if any users exist at all (for debugging)
      const userCount = await User.countDocuments();
      console.log(`[LOGIN] User not found for email: ${trimmedEmail}`);
      console.log(`[LOGIN] Total users in database: ${userCount}`);
      
      // List first few emails for debugging (in development only)
      if (process.env.NODE_ENV === 'development' && userCount > 0) {
        const sampleUsers = await User.find({}).select('email username').limit(5);
        console.log(`[LOGIN] Sample users in DB:`, sampleUsers.map(u => ({ email: u.email, username: u.username })));
      }
      
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }
    
    console.log(`[LOGIN] User found: ${user.username} (${user.email}), checking password...`);

    // Check if user is active
    if (user.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Account is deactivated. Please contact support.",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(trimmedPassword, user.passwordHash);
    if (!isMatch) {
      console.log(`[LOGIN] Password mismatch for email: ${trimmedEmail}`);
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    console.log(`[LOGIN] Successful login for user: ${user.username} (${user.email})`);

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      message: "Login successful",
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        xp: user.xp,
        rank: user.rank,
        badges: user.badges,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Refresh Token
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }

    // Verify token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id);

    res.json({
      success: true,
      token: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
};

// Logout User
exports.logoutUser = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get Current User (Protected)
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// Get All Users (Admin Only)
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select("-passwordHash -refreshToken").sort({ xp: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// Update Profile (Protected)
exports.updateProfile = async (req, res, next) => {
  try {
    const { username, email } = req.body;
    const userId = req.user.id;

    // Check if username/email is taken by another user
    if (username || email) {
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
        _id: { $ne: userId }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Username or email already taken",
        });
      }
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email.toLowerCase();

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select("-passwordHash");

    res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};

// Update Password (Protected)
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Find user with password
    const user = await User.findById(userId).select("+passwordHash");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    user.passwordHash = passwordHash;
    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Google Authentication
exports.googleAuth = async (req, res, next) => {
  try {
    const { idToken, email, name, isAdmin } = req.body;

    if (!idToken || !email) {
      return res.status(400).json({
        success: false,
        message: "ID token and email are required",
      });
    }

    // Note: In production, you should verify the idToken with Google
    // For now, we trust the token from the frontend and extract user info
    // TODO: Add google-auth-library to verify token server-side
    
    // Find or create user
    let user = await User.findOne({ email });
    
    if (!user) {
      // Generate unique username if name not provided
      const baseUsername = name || email.split('@')[0];
      let username = baseUsername;
      let usernameExists = await User.findOne({ username });
      
      // If username exists, append numbers
      if (usernameExists) {
        let counter = 1;
        while (await User.findOne({ username: `${baseUsername}${counter}` })) {
          counter++;
        }
        username = `${baseUsername}${counter}`;
      }

      user = await User.create({
        username,
        email,
        xp: 0,
        weeklyXp: 0,
        rank: "Novice",
        badges: [],
        isAdmin: isAdmin || false,
      });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      message: "Google login successful",
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        xp: user.xp,
        weeklyXp: user.weeklyXp,
        rank: user.rank,
        badges: user.badges,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    console.error('[GOOGLE-AUTH-ERROR]', error);
    next(error);
  }
};

// Send OTP
exports.sendOTP = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // TODO: Implement OTP sending via SMS service (Twilio, AWS SNS, etc.)
    // For now, return error indicating not configured
    
    return res.status(501).json({
      success: false,
      message: "OTP service is not yet configured. Please configure SMS service (Twilio/AWS SNS).",
    });

    /* Placeholder for future implementation:
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in database/cache with expiration (5 minutes)
    // await OTPService.storeOTP(phoneNumber, otp, 5 * 60);
    
    // Send OTP via SMS
    // await SMSService.sendOTP(phoneNumber, otp);
    
    res.json({
      success: true,
      message: "OTP sent to your phone",
    });
    */
  } catch (error) {
    next(error);
  }
};

// Verify OTP
exports.verifyOTP = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    // TODO: Verify OTP
    // This requires OTP storage and verification
    // For now, return error indicating not configured
    
    return res.status(501).json({
      success: false,
      message: "OTP verification is not yet configured. Please configure OTP service.",
    });

    /* Placeholder for future implementation:
    // Verify OTP
    // const isValid = await OTPService.verifyOTP(phoneNumber, otp);
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }
    
    // Find or create user by phone number
    let user = await User.findOne({ phoneNumber });
    
    if (!user) {
      user = await User.create({
        username: `user_${phoneNumber.slice(-4)}`,
        phoneNumber,
        xp: 0,
        weeklyXp: 0,
        rank: "Novice",
        badges: [],
        isAdmin: false,
      });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      message: "OTP verified successfully",
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        phoneNumber: user.phoneNumber,
        xp: user.xp,
        rank: user.rank,
        badges: user.badges,
        isAdmin: user.isAdmin,
      },
    });
    */
  } catch (error) {
    next(error);
  }
};

// Export aliases for route handlers
exports.logout = exports.logoutUser;
exports.getUserDetails = exports.getMe;