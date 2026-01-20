
const bcrypt = require("bcryptjs");

/**
 * Hash password with bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    throw new Error("Error hashing password: " + error.message);
  }
};

/**
 * Compare plain password with hash
 * @param {string} plainPassword - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} True if passwords match
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    throw new Error("Error comparing passwords: " + error.message);
  }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { isValid: boolean, errors: array }
 */
const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password || password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*)");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
};