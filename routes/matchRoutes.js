
const express = require("express");
const router = express.Router();
const { 
  getMatchHistory,
  getMatchDetails,
  getMatchStats
} = require("../controllers/matchController");

const authMiddleware = require("../middleware/authMiddleware");

// Protected routes - get user's match history
router.get("/history", authMiddleware, getMatchHistory);

// Get specific match details
router.get("/:matchId", authMiddleware, getMatchDetails);

// Public route - get user statistics
router.get("/stats/:userId", getMatchStats);

module.exports = router;
