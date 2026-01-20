const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT token from request headers
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please login.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from database to get latest data including isAdmin
    const user = await User.findById(decoded.id).select("_id username email isAdmin");
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Please login again.",
      });
    }

    // Attach user info to request with all necessary fields
    req.user = {
      id: user._id.toString(),
      _id: user._id.toString(),
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin || false,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token. Please login again.",
      error: error.message,
    });
  }
};

module.exports = authMiddleware;