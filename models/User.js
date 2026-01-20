
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      unique: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username must not exceed 30 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Invalid email format"],
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    xp: {
      type: Number,
      default: 0,
      min: 0,
    },
    weeklyXp: {
      type: Number,
      default: 0,
      min: 0,
    },
    rank: {
      type: String,
      enum: ["Novice", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster"],
      default: "Novice",
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
    },
    badges: {
      type: [String],
      default: [],
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: 200,
      default: "",
    },
  },
  {
    timestamps: true,
    indexes: [
      { unique: true, fields: { username: 1 } },
      { unique: true, fields: { email: 1 } },
    ],
  }
);

// ✅ NO DUPLICATE INDEXES - Removed manual index definitions
// unique: true automatically creates index

module.exports = mongoose.model("User", userSchema);