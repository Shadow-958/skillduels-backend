
const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
  {
    players: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        socketId: {
          type: String,
          default: null,
        },
        score: {
          type: Number,
          default: 0,
        },
        answers: [
          {
            questionId: mongoose.Schema.Types.ObjectId,
            selectedOptionId: Number,
            isCorrect: Boolean,
            timeSpent: Number, // seconds
          },
        ],
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true, // ✅ Single index definition
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    state: {
      type: String,
      enum: ["waiting", "active", "finished"],
      default: "active",
    },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    scores: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        score: Number,
        xpEarned: Number,
      },
    ],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // in seconds
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ NO DUPLICATE INDEXES - Removed manual index definitions

module.exports = mongoose.model("Match", matchSchema);