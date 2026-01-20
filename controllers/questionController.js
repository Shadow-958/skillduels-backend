
const Question = require("../models/Question");
const mongoose = require("mongoose");

// Get all questions (admin only)
exports.getAllQuestions = async (req, res, next) => {
  try {
    const questions = await Question.find({}).populate('category', 'name').sort({ createdAt: -1 });

    res.json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    next(error);
  }
};

// Get questions by category
exports.getQuestionsByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const questions = await Question.find({
      category: categoryId,
      isApproved: true,
      isActive: true,
    });

    res.json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    next(error);
  }
};

// Get random questions (for match)
exports.getRandomQuestions = async (req, res, next) => {
  try {
    const { categoryId, count } = req.params;
    const questionCount = parseInt(count) || 5;

    const questions = await Question.aggregate([
      {
        $match: {
          category: new mongoose.Types.ObjectId(categoryId),
          isApproved: true,
          isActive: true,
        },
      },
      { $sample: { size: Math.min(questionCount, 5) } }, // Max 5
      {
        $project: {
          text: 1,
          options: 1,
          correctOptionId: 1,
          difficulty: 1,
          category: 1,
        },
      },
    ]);

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No approved questions found in this category",
      });
    }

    res.json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    next(error);
  }
};

// Get single question
exports.getQuestionById = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    res.json({
      success: true,
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

// Create question (admin only)
exports.createQuestion = async (req, res, next) => {
  try {
    const question = await Question.create({
      ...req.body,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Question created successfully",
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

// Update question (admin only)
exports.updateQuestion = async (req, res, next) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    res.json({
      success: true,
      message: "Question updated successfully",
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

// Delete question (admin only)
exports.deleteQuestion = async (req, res, next) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    res.json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};