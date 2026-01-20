const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const connectDB = require("./config/db");
const { initializeSocket } = require("./socket/socketHandler");

dotenv.config();

const app = express();
// Allow multiple frontend URLs from environment or default list
const getAllowedOrigins = () => {
  const origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://skillduels-fe.web.app",
    "https://skillduels-fe.firebaseapp.com"
  ];

  // Add FRONTEND_URL from environment if provided
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  // Support multiple frontend URLs separated by comma
  if (process.env.FRONTEND_URLS) {
    origins.push(...process.env.FRONTEND_URLS.split(',').map(url => url.trim()));
  }

  return origins;
};

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use((req, res, next) => {
  console.log(`\n📨 ${req.method} ${req.path}`);
  console.log(`Origin: ${req.get("origin")}`);
  next();
});
connectDB();
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/questions", require("./routes/questionRoutes"));
app.use("/api/matches", require("./routes/matchRoutes"));
app.use("/api/leaderboard", require("./routes/leaderboardRoutes"));
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
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path
  });
});
app.use((err, req, res, next) => {
  console.error("[ERROR]", err);
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: err.message || "Validation Error",
      code: "VALIDATION_ERROR"
    });
  }

 
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

 
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
    code: err.code || "SERVER_ERROR",
  });
});
const server = http.createServer(app);
const io = initializeSocket(server);
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

server.listen(PORT, () => {
  console.log("Server is listening")
});


process.on("SIGTERM", () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[UNHANDLED REJECTION]", reason);
  process.exit(1);
});

module.exports = { server, io };