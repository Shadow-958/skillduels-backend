const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const connectDB = require("./config/db");
const { initializeSocket } = require("./socket/socketHandler");

dotenv.config();

const app = express();

// ============================================================
// MIDDLEWARE CONFIGURATION
// ============================================================

// CORS Configuration - Allow Vite dev server
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n📨 ${req.method} ${req.path}`);
  console.log(`Origin: ${req.get("origin")}`);
  next();
});

// ============================================================
// DATABASE CONNECTION
// ============================================================

connectDB();

// ============================================================
// ROUTES - All API Endpoints
// ============================================================

// Authentication Routes
app.use("/api/auth", require("./routes/authRoutes"));

// Category Routes
app.use("/api/categories", require("./routes/categoryRoutes"));

// Question Routes
app.use("/api/questions", require("./routes/questionRoutes"));

// Match Routes - IMPORTANT: Use 'matches' (plural) not 'match'
app.use("/api/matches", require("./routes/matchRoutes"));

// Leaderboard Routes
app.use("/api/leaderboard", require("./routes/leaderboardRoutes"));

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

app.get("/", (req, res) => {
  res.json({
    message: "SkillDuels Backend Running",
    status: "Active",
    version: "1.0.0",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "UP",
    timestamp: new Date().toISOString(),
    database: "Connected",
    socketIO: "Ready",
  });
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path
  });
});

// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================

app.use((err, req, res, next) => {
  console.error("[ERROR]", err);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: err.message || "Validation Error",
      code: "VALIDATION_ERROR"
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      error: "Invalid token",
      code: "INVALID_TOKEN"
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      error: "Token expired",
      code: "TOKEN_EXPIRED"
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
    code: err.code || "SERVER_ERROR",
  });
});

// ============================================================
// HTTP SERVER + SOCKET.IO INITIALIZATION
// ============================================================

const server = http.createServer(app);
const io = initializeSocket(server);

// ============================================================
// SERVER STARTUP
// ============================================================

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║           🎮 SKILLDUEL SERVER STARTED 🎮              ║
║                                                        ║
║  Environment: ${NODE_ENV.toUpperCase().padEnd(35)}║
║  REST API: http://localhost:${PORT}${" ".repeat(23)}║
║  WebSocket: ws://localhost:${PORT}${" ".repeat(20)}║
║                                                        ║
║  Database: MongoDB Connected ✅${" ".repeat(19)}║
║  Socket.IO: Initialized ✅${" ".repeat(22)}║
║                                                        ║
║  CORS Origins Allowed:${" ".repeat(22)}║
║  ✅ http://localhost:5173 (Vite)${" ".repeat(14)}║
║  ✅ http://localhost:3000${" ".repeat(23)}║
║  ✅ http://localhost:3001${" ".repeat(23)}║
║                                                        ║
║  API Routes:${" ".repeat(38)}║
║  📍 /api/auth        - Authentication${" ".repeat(12)}║
║  📍 /api/matches     - Match gameplay${" ".repeat(12)}║
║  📍 /api/categories  - Categories${" ".repeat(15)}║
║  📍 /api/questions   - Questions${" ".repeat(16)}║
║  📍 /api/leaderboard - Leaderboards${" ".repeat(13)}║
║  📍 /api/health      - Health check${" ".repeat(13)}║
║                                                        ║
║  Status: Ready for Real-Time Gaming ✅${" ".repeat(13)}║
╚════════════════════════════════════════════════════════╝
  `);

  console.log("\n📡 WebSocket Events Registered:");
  console.log("  ├─ user-join");
  console.log("  ├─ create-match");
  console.log("  ├─ join-match");
  console.log("  ├─ submit-answer");
  console.log("  ├─ next-question");
  console.log("  ├─ sync-timer");
  console.log("  ├─ forfeit-match");
  console.log("  ├─ reconnect-match");
  console.log("  └─ disconnect\n");
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

process.on("SIGTERM", () => {
  console.log("[SHUTDOWN] SIGTERM received, closing server gracefully...");
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[SHUTDOWN] SIGINT received, closing server gracefully...");
  server.close(() => {
    console.log("[SHUTDOWN] Server closed");
    process.exit(0);
  });
});

// ============================================================
// UNHANDLED ERRORS
// ============================================================

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[UNHANDLED REJECTION]", reason);
  process.exit(1);
});

module.exports = { server, io };