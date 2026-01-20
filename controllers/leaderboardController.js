
const User = require("../models/User");

// Helper function to reset weekly XP every Monday
let lastWeeklyReset = null;

async function resetWeeklyXPIfNeeded() {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Reset on Monday (dayOfWeek === 1)
    // Check if we've already reset this week
    const currentWeek = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const lastResetWeek = lastWeeklyReset ? lastWeeklyReset.split('T')[0] : null;
    
    // Reset if it's Monday and we haven't reset this week yet
    if (dayOfWeek === 1 && lastResetWeek !== currentWeek) {
      await User.updateMany({}, { $set: { weeklyXp: 0 } });
      lastWeeklyReset = now.toISOString();
      console.log('[WEEKLY-RESET] Weekly XP reset for all users');
    }
  } catch (error) {
    console.error('[WEEKLY-RESET-ERROR]', error);
    // Don't throw - allow leaderboard to still load
  }
}

// Get global leaderboard (top 10 all-time)
exports.getGlobalLeaderboard = async (req, res, next) => {
  try {
    const leaderboard = await User.find({ isActive: true })
      .sort({ xp: -1 })
      .limit(10)
      .select("_id username xp rank badges createdAt");

    // Map to include userId for admin dashboard
    const formattedLeaderboard = leaderboard.map(user => ({
      userId: user._id,
      username: user.username,
      xp: user.xp,
      rank: user.rank,
      badges: user.badges,
      createdAt: user.createdAt
    }));

    res.json({
      success: true,
      type: "global",
      count: formattedLeaderboard.length,
      data: formattedLeaderboard,
    });
  } catch (error) {
    next(error);
  }
};

// Get weekly leaderboard (top 10 this week)
// Weekly XP resets every Monday at 00:00
exports.getWeeklyLeaderboard = async (req, res, next) => {
  try {
    // Check if we need to reset weekly XP (Monday reset)
    await resetWeeklyXPIfNeeded();
    
    const leaderboard = await User.find({ isActive: true })
      .sort({ weeklyXp: -1 })
      .limit(10)
      .select("_id username weeklyXp xp rank badges");

    // Map to include userId for admin dashboard
    const formattedLeaderboard = leaderboard.map(user => ({
      userId: user._id,
      username: user.username,
      weeklyXp: user.weeklyXp,
      xp: user.xp,
      rank: user.rank,
      badges: user.badges
    }));

    res.json({
      success: true,
      type: "weekly",
      count: formattedLeaderboard.length,
      data: formattedLeaderboard,
    });
  } catch (error) {
    next(error);
  }
};

// Get user's rank (protected)
exports.getUserRank = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select(
      "username xp weeklyXp rank badges"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get global rank
    const globalRank = await User.countDocuments({
      xp: { $gt: user.xp },
      isActive: true,
    });

    // Get weekly rank
    const weeklyRank = await User.countDocuments({
      weeklyXp: { $gt: user.weeklyXp },
      isActive: true,
    });

    res.json({
      success: true,
      data: {
        user,
        globalRank: globalRank + 1,
        weeklyRank: weeklyRank + 1,
      },
    });
  } catch (error) {
    next(error);
  }
};