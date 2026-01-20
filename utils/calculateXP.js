
/**
 * Calculate XP earned based on score and difficulty
 * @param {number} score - User's score (0-100)
 * @param {string} difficulty - Question difficulty ("easy", "medium", "hard")
 * @returns {number} XP earned
 */
const calculateXP = (score, difficulty = "medium") => {
  // Base XP from score
  let baseXP = score;

  // Difficulty multiplier
  const difficultyMultiplier = {
    easy: 1.0,
    medium: 1.5,
    hard: 2.0,
  };

  const multiplier = difficultyMultiplier[difficulty] || 1.0;

  // Total XP = score × difficulty multiplier
  const totalXP = Math.floor(baseXP * multiplier);

  return totalXP;
};

/**
 * Calculate user rank based on total XP
 * @param {number} totalXP - User's total XP
 * @returns {string} Rank name
 */
const calculateRank = (totalXP) => {
  const rankTiers = [
    { threshold: 0, name: "Novice", color: "gray" },
    { threshold: 100, name: "Bronze", color: "orange" },
    { threshold: 500, name: "Silver", color: "silver" },
    { threshold: 1000, name: "Gold", color: "gold" },
    { threshold: 2500, name: "Platinum", color: "lightblue" },
    { threshold: 5000, name: "Diamond", color: "cyan" },
    { threshold: 10000, name: "Master", color: "purple" },
    { threshold: 20000, name: "Grandmaster", color: "darkred" },
  ];

  // Find the highest tier the user qualifies for
  let currentRank = rankTiers[0];
  for (let tier of rankTiers) {
    if (totalXP >= tier.threshold) {
      currentRank = tier;
    }
  }

  return currentRank.name;
};

/**
 * Get badge based on conditions
 * @param {number} totalXP - User's total XP
 * @param {number} score - Match score
 * @param {number} streak - Win streak
 * @returns {array} Array of earned badges
 */
const checkBadges = (totalXP = 0, score = 0, streak = 0) => {
  const badges = [];

  // XP-based badges
  if (totalXP >= 100) badges.push("First Steps");
  if (totalXP >= 500) badges.push("Rising Star");
  if (totalXP >= 1000) badges.push("Pro Gamer");
  if (totalXP >= 5000) badges.push("Elite Player");
  if (totalXP >= 10000) badges.push("Legend");

  // Performance badges
  if (score === 100) badges.push("Perfect Match");
  if (score >= 90) badges.push("Expert");
  if (score >= 80) badges.push("Skilled");

  // Streak badges
  if (streak >= 5) badges.push("On Fire");
  if (streak >= 10) badges.push("Unstoppable");
  if (streak >= 25) badges.push("Dominator");

  // Remove duplicates
  return [...new Set(badges)];
};

/**
 * Calculate match reward
 * @param {object} matchData - Match data { score, difficulty, duration, opponent }
 * @returns {object} Reward { xp, bonus, totalReward }
 */
const calculateMatchReward = (matchData) => {
  const { score = 0, difficulty = "medium", duration = 0, isVictory = false } =
    matchData;

  // Base XP from score
  const baseXP = calculateXP(score, difficulty);

  // Victory bonus (50% extra)
  const victoryBonus = isVictory ? Math.floor(baseXP * 0.5) : 0;

  // Speed bonus (finish in < 5 min = 10% bonus)
  const speedBonus = duration < 5 * 60 ? Math.floor(baseXP * 0.1) : 0;

  // Perfect score bonus (100 score = 25% bonus)
  const perfectBonus = score === 100 ? Math.floor(baseXP * 0.25) : 0;

  // Total reward
  const totalReward = baseXP + victoryBonus + speedBonus + perfectBonus;

  return {
    baseXP,
    victoryBonus,
    speedBonus,
    perfectBonus,
    totalReward: Math.floor(totalReward),
  };
};

/**
 * Calculate win rate
 * @param {number} wins - Total wins
 * @param {number} totalMatches - Total matches played
 * @returns {string} Win rate as percentage
 */
const calculateWinRate = (wins = 0, totalMatches = 0) => {
  if (totalMatches === 0) return "0%";
  const rate = (wins / totalMatches) * 100;
  return rate.toFixed(2) + "%";
};

/**
 * Calculate level based on XP
 * @param {number} totalXP - User's total XP
 * @returns {number} Current level (1-100)
 */
const calculateLevel = (totalXP = 0) => {
  // Each level requires 500 XP
  const level = Math.floor(totalXP / 500) + 1;
  return Math.min(level, 100); // Cap at 100
};

/**
 * Calculate XP needed for next level
 * @param {number} totalXP - User's current XP
 * @returns {object} { currentLevel, nextLevel, xpNeeded, progress }
 */
const getProgressToNextLevel = (totalXP = 0) => {
  const xpPerLevel = 500;
  const currentLevel = calculateLevel(totalXP);
  const nextLevel = currentLevel + 1;

  const currentLevelXP = (currentLevel - 1) * xpPerLevel;
  const nextLevelXP = currentLevel * xpPerLevel;

  const xpInCurrentLevel = totalXP - currentLevelXP;
  const xpNeededForLevel = xpPerLevel;

  return {
    currentLevel,
    nextLevel,
    currentLevelXP,
    nextLevelXP,
    xpInCurrentLevel,
    xpNeededForLevel,
    progress: Math.min(
      (xpInCurrentLevel / xpNeededForLevel) * 100,
      100
    ).toFixed(1),
    xpUntilNextLevel: Math.max(nextLevelXP - totalXP, 0),
  };
};

module.exports = {
  calculateXP,
  calculateRank,
  checkBadges,
  calculateMatchReward,
  calculateWinRate,
  calculateLevel,
  getProgressToNextLevel,
};