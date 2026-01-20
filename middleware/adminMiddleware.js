
const adminMiddleware = (req, res, next) => {
  try {
    // Check if user is authenticated (authMiddleware should run first)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Authorization check failed",
      error: error.message,
    });
  }
};

module.exports = adminMiddleware;