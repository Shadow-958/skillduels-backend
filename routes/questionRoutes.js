
const express = require("express");
const router = express.Router();
const { 
  createQuestion, 
  getAllQuestions,
  getQuestionsByCategory,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  getRandomQuestions
} = require("../controllers/questionController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { validateQuestion } = require("../middleware/validationMiddleware");

// Admin routes (get all questions)
router.get("/all", authMiddleware, adminMiddleware, getAllQuestions);

// Public routes (no auth needed)
router.get("/category/:categoryId", getQuestionsByCategory);
router.get("/random/:categoryId/:count", getRandomQuestions); // For match - get 5 random
router.get("/:id", getQuestionById);

// Admin routes (create, update, delete)
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  validateQuestion,
  createQuestion
);

router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateQuestion,
  updateQuestion
);

router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  deleteQuestion
);

module.exports = router;