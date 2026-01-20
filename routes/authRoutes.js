const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  refreshToken,
  logout,
  getUserDetails,
  updateProfile,
  updatePassword,
  googleAuth,
  sendOTP,
  verifyOTP,
  getAllUsers
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// ============================================================
// PUBLIC ROUTES (No authentication needed)
// ============================================================

// Register new user
router.post("/register", registerUser);

// Login user
router.post("/login", loginUser);

// Google OAuth
router.post("/google", googleAuth);

// OTP Authentication
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);

// Refresh access token
router.post("/refresh", refreshToken);

// ============================================================
// PROTECTED ROUTES (Requires authentication)
// ============================================================

// Get current user details
router.get("/me", authMiddleware, getUserDetails);

// Logout
router.post("/logout", authMiddleware, logout);

// Update profile
router.put("/profile", authMiddleware, updateProfile);

// Update password
router.patch("/password", authMiddleware, updatePassword);

// Get all users (Admin only)
router.get("/users", authMiddleware, adminMiddleware, getAllUsers);

module.exports = router;
