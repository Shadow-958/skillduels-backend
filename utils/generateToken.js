
const jwt = require("jsonwebtoken");

/**
 * Generate JWT Access Token
 * @param {string} userId - User's MongoDB ID
 * @returns {string} JWT token valid for 15 minutes
 */
const generateAccessToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not defined in .env");
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "15m",
    algorithm: "HS256",
  });
};

/**
 * Generate JWT Refresh Token
 * @param {string} userId - User's MongoDB ID
 * @returns {string} JWT token valid for 7 days
 */
const generateRefreshToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not defined in .env");
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
    algorithm: "HS256",
  });
};

/**
 * Verify JWT Token
 * @param {string} token - JWT token to verify
 * @returns {object} Decoded token data { id, iat, exp }
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not defined in .env");
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Decode JWT Token (without verification)
 * @param {string} token - JWT token to decode
 * @returns {object} Decoded token data
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
};