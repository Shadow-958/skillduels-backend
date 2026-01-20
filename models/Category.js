
const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      minlength: [3, "Name must be at least 3 characters"],
      maxlength: [50, "Name must not exceed 50 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [500, "Description must not exceed 500 characters"],
    },
    icon: {
      type: String,
      default: "📚",
    },
    color: {
      type: String,
      default: "#3498db",
    },
    questionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "intermediate",
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { unique: true, fields: { name: 1 } },
    ],
  }
);

// ✅ NO DUPLICATE INDEXES - Removed manual index definitions

module.exports = mongoose.model("Category", categorySchema);