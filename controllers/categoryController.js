
const Category = require("../models/Category");

// Get all categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort("order");
    res.json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

// Get single category
exports.getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Create category (admin only)
exports.createCategory = async (req, res, next) => {
  try {
    // Add createdBy from authenticated user
    const categoryData = {
      ...req.body,
      createdBy: req.user.id, // From authMiddleware
    };
    const category = await Category.create(categoryData);
    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Update category (admin only)
exports.updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    res.json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Delete category (admin only)
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Bulk create categories (admin only)
exports.bulkCreateCategories = async (req, res, next) => {
  try {
    const { categories } = req.body;
    
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Categories array is required",
      });
    }

    // Set createdBy for all categories
    const categoriesWithCreator = categories.map(cat => ({
      ...cat,
      createdBy: req.user.id,
      isActive: true,
    }));

    const createdCategories = await Category.insertMany(categoriesWithCreator, {
      ordered: false, // Continue even if one fails
    });

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdCategories.length} categories`,
      count: createdCategories.length,
      data: createdCategories,
    });
  } catch (error) {
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Some categories already exist",
        error: error.message,
      });
    }
    next(error);
  }
};