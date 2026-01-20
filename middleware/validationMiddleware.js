
const validateEmail = (req, res, next) => {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

  if (!req.body.email || !emailRegex.test(req.body.email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  next();
};

const validateUsername = (req, res, next) => {
  if (!req.body.username) {
    return res.status(400).json({
      success: false,
      message: "Username is required",
    });
  }

  if (req.body.username.length < 3 || req.body.username.length > 30) {
    return res.status(400).json({
      success: false,
      message: "Username must be between 3 and 30 characters",
    });
  }

  next();
};

const validatePassword = (req, res, next) => {
  if (!req.body.password) {
    return res.status(400).json({
      success: false,
      message: "Password is required",
    });
  }

  if (req.body.password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters",
    });
  }

  next();
};

const validateQuestion = (req, res, next) => {
  const { text, options, correctOptionId, difficulty } = req.body;

  // Validate text
  if (!text || text.length < 10) {
    return res.status(400).json({
      success: false,
      message: "Question text is required and must be at least 10 characters",
    });
  }

  // Validate options
  if (!Array.isArray(options) || options.length !== 4) {
    return res.status(400).json({
      success: false,
      message: "Question must have exactly 4 options",
    });
  }

  // Validate each option has id and text
  for (let i = 0; i < options.length; i++) {
    if (!options[i].id || !options[i].text) {
      return res.status(400).json({
        success: false,
        message: "Each option must have id (1-4) and text",
      });
    }
    if (options[i].id < 1 || options[i].id > 4) {
      return res.status(400).json({
        success: false,
        message: "Option ids must be 1-4",
      });
    }
  }

  // Validate correctOptionId
  if (!correctOptionId || correctOptionId < 1 || correctOptionId > 4) {
    return res.status(400).json({
      success: false,
      message: "Correct option ID must be between 1-4",
    });
  }

  // Validate difficulty
  if (difficulty && !["easy", "medium", "hard"].includes(difficulty)) {
    return res.status(400).json({
      success: false,
      message: "Difficulty must be easy, medium, or hard",
    });
  }

  next();
};

const validateCategory = (req, res, next) => {
  const { name, description } = req.body;

  if (!name || name.length < 3) {
    return res.status(400).json({
      success: false,
      message: "Category name is required and must be at least 3 characters",
    });
  }

  if (!description || description.length < 10) {
    return res.status(400).json({
      success: false,
      message: "Category description is required and must be at least 10 characters",
    });
  }

  next();
};

module.exports = {
  validateEmail,
  validateUsername,
  validatePassword,
  validateQuestion,
  validateCategory,
};