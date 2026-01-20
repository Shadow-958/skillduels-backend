const express = require("express");
const router = express.Router();
const { 
  createCategory, 
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  bulkCreateCategories
} = require("../controllers/categoryController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { validateCategory } = require("../middleware/validationMiddleware");

// ============================================================
// PUBLIC ROUTES (No authentication needed)
// ============================================================

// Get all categories - MUST be before POST
router.get("/", getCategories);

// Get single category by ID
router.get("/:id", getCategoryById);

// ============================================================
// ADMIN ROUTES (Requires authentication)
// ============================================================

// Bulk create categories - MUST be before POST /
router.post(
  "/bulk",
  authMiddleware,
  adminMiddleware,
  bulkCreateCategories
);

// Create new category
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  validateCategory,
  createCategory
);

// Update category
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateCategory,
  updateCategory
);

// Delete category
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  deleteCategory
);

module.exports = router;
