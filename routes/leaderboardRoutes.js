
const express = require("express");
const router = express.Router();
const { 
  getGlobalLeaderboard, 
  getWeeklyLeaderboard,
  getUserRank
} = require("../controllers/leaderboardController");

const authMiddleware = require("../middleware/authMiddleware");

// Public routes
router.get("/global", getGlobalLeaderboard);
router.get("/weekly", getWeeklyLeaderboard);

// Protected route - get specific user's rank
router.get("/rank/:userId", authMiddleware, getUserRank);

module.exports = router;