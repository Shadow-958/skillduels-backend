
const Match = require("../models/Match");
const User = require("../models/User");

// Get match history (protected)
exports.getMatchHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const matches = await Match.find({
      $or: [{ "players.user": userId }],
      state: "finished",
    })
      .populate("category", "name")
      .populate("players.user", "username")
      .sort({ finishedAt: -1 })
      .limit(20);

    res.json({
      success: true,
      count: matches.length,
      data: matches,
    });
  } catch (error) {
    next(error);
  }
};

// Get specific match details (protected)
exports.getMatchDetails = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const match = await Match.findById(matchId)
      .populate("category", "name")
      .populate("players.user", "username xp rank")
      .populate("questions", "text options correctOptionId difficulty");

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
      });
    }

    // Check if user is part of this match
    const isParticipant = match.players.some(
      (p) => p.user._id.toString() === userId
    );

    if (!isParticipant && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this match",
      });
    }

    res.json({
      success: true,
      data: match,
    });
  } catch (error) {
    next(error);
  }
};

// Get user statistics
exports.getMatchStats = async (req, res, next) => {
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

    // Get match count
    const totalMatches = await Match.countDocuments({
      $or: [{ "players.user": userId }],
      state: "finished",
    });

    // Get wins
    const wins = await Match.countDocuments({
      winnerId: userId,
      state: "finished",
    });

    // Get total XP earned from matches
    const matchData = await Match.aggregate([
      {
        $match: {
          $or: [{ "players.user": userId }],
          state: "finished",
        },
      },
      {
        $unwind: "$scores",
      },
      {
        $match: {
          "scores.userId": userId,
        },
      },
      {
        $group: {
          _id: null,
          totalXP: { $sum: "$scores.score" },
        },
      },
    ]);

    const totalXPFromMatches = matchData[0]?.totalXP || 0;

    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          xp: user.xp,
          weeklyXp: user.weeklyXp,
          rank: user.rank,
          badges: user.badges,
        },
        stats: {
          totalMatches,
          wins,
          winRate: totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(2) + "%" : "0%",
          totalXPEarned: totalXPFromMatches,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
