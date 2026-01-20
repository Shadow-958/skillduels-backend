
const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Question text is required"],
      minlength: [10, "Question must be at least 10 characters"],
      maxlength: [500, "Question must not exceed 500 characters"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
      index: true, // ✅ Single index definition
    },
    options: [
      {
        id: {
          type: Number,
          required: true,
          enum: [1, 2, 3, 4],
        },
        text: {
          type: String,
          required: [true, "Option text is required"],
          maxlength: 200,
        },
      },
    ],
    correctOptionId: {
      type: Number,
      required: [true, "Correct option is required"],
      enum: [1, 2, 3, 4],
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    explanation: {
      type: String,
      maxlength: 500,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    isApproved: {
      type: Boolean,
      default: false,
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
    timesAsked: {
      type: Number,
      default: 0,
      min: 0,
    },
    correctAnswers: {
      type: Number,
      default: 0,
      min: 0,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
  },
  {
    timestamps: true,
  }
);

// ✅ NO DUPLICATE INDEXES - Removed manual index definitions

module.exports = mongoose.model("Question", questionSchema);