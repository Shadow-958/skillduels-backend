const mongoose = require("mongoose");
const User = require("../models/User");
const Match = require("../models/Match");
const Question = require("../models/Question");
const Category = require("../models/Category");

// Configuration Constants
const QUESTION_TIME_LIMIT = 30; // 30 seconds per question
const QUESTIONS_PER_MATCH = 5;
const RECONNECT_GRACE_PERIOD = 30000; // 30 seconds to reconnect
const TIMER_SYNC_INTERVAL = 5000; // Sync every 5 seconds
const XP_PER_CORRECT = 10;
const PERFECT_MATCH_BONUS = 50; // All 5 questions correct

// In-memory game rooms
const gameRooms = new Map();

/**
 * Initialize Socket.IO server
 * Aligns with Backend Architecture JWT + WebSocket flow
 */
function initializeSocket(server) {
  const io = require("socket.io")(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // ============================================================
  // CONNECTION & USER MANAGEMENT
  // ============================================================

  io.on("connection", (socket) => {
    console.log(`[CONNECT] Socket connected: ${socket.id}`);

    /**
     * User joins the game server
     * Frontend sends: JWT token (via query or header)
     * Payload: { userId, username }
     */
    socket.on("user-join", async (data) => {
      try {
        const { userId, username } = data;

        // Validate user exists in database
        const user = await User.findById(userId);
        if (!user) {
          console.error(`[USER-JOIN] User not found: ${userId}`);
          return socket.emit("error", {
            code: "USER_NOT_FOUND",
            message: "User not found in database",
          });
        }

        // Store socket session data
        socket.userId = userId;
        socket.username = username;
        socket.join(`user-${userId}`);

        console.log(`[USER-JOIN] ${username} (${userId}) connected via socket`);

        // Send confirmation with user data
        socket.emit("user-joined-success", {
          userId,
          username,
          currentXP: user.xp,
          currentRank: user.rank,
          message: "Connected to SkillDuels game server",
        });

        // Broadcast to all users that someone is online (optional)
        io.emit("user-online", { userId, username });
      } catch (error) {
        console.error("[USER-JOIN ERROR]", error);
        socket.emit("error", {
          code: "JOIN_FAILED",
          message: "Failed to join server",
        });
      }
    });

    // ============================================================
    // MATCH CREATION & JOINING
    // ============================================================

    /**
     * Player 1: Create a new 1v1 match
     * Frontend sends: categoryId, userId (from JWT)
     * Returns: matchId, questions (first question displayed)
     */
    socket.on("create-match", async (data) => {
      try {
        const { categoryId, userId, numberOfQuestions, timePerQuestion } = data;
        const socketId = socket.id;

        // Use provided values or defaults
        const questionsCount = numberOfQuestions || QUESTIONS_PER_MATCH;
        const questionTimeLimit = timePerQuestion || QUESTION_TIME_LIMIT;

        // Validate questions count (min 3, max 20)
        if (questionsCount < 3 || questionsCount > 20) {
          return socket.emit("error", {
            code: "INVALID_QUESTION_COUNT",
            message: "Number of questions must be between 3 and 20",
          });
        }

        // Validate time limit (min 15, max 300 seconds)
        if (questionTimeLimit < 15 || questionTimeLimit > 300) {
          return socket.emit("error", {
            code: "INVALID_TIME_LIMIT",
            message: "Time per question must be between 15 and 300 seconds",
          });
        }

        console.log(`[CREATE-MATCH] Player ${userId} creating match in ${categoryId} with ${questionsCount} questions, ${questionTimeLimit}s per question`);

        // Validate category exists - try both string and ObjectId
        let category;
        try {
          // Try direct find
          category = await Category.findById(categoryId);
          
          // If not found, try as string
          if (!category) {
            category = await Category.findOne({ 
              $or: [
                { _id: categoryId },
                { _id: new mongoose.Types.ObjectId(categoryId) },
                { name: categoryId }
              ]
            });
          }
        } catch (err) {
          console.error(`[CREATE-MATCH] Category lookup error:`, err);
          return socket.emit("error", {
            code: "CATEGORY_LOOKUP_ERROR",
            message: `Error looking up category: ${err.message}`,
          });
        }
        
        if (!category) {
          console.error(`[CREATE-MATCH] Category not found: ${categoryId}`);
          return socket.emit("error", {
            code: "CATEGORY_NOT_FOUND",
            message: `Category with ID "${categoryId}" does not exist. Please check the category ID.`,
          });
        }

        // Fetch random questions from category using aggregation
        // Aligned with Backend Architecture: uses 'text', not 'questionText'
        let questions;
        try {
          questions = await Question.aggregate([
            {
              $match: {
                category: new mongoose.Types.ObjectId(categoryId),
                isActive: { $ne: false } // Include active questions (or undefined)
              }
            },
            { $sample: { size: questionsCount } }, // Randomly select questions
            {
              $project: {
                _id: 1,
                text: 1,
                options: 1,
                correctOptionId: 1,
                difficulty: 1,
                category: 1
              }
            }
          ]);

          console.log(`[CREATE-MATCH] Found ${questions?.length || 0} questions for category ${categoryId}`);
        } catch (err) {
          console.error(`[CREATE-MATCH] Error fetching questions:`, err);
          return socket.emit("error", {
            code: "QUESTIONS_FETCH_ERROR",
            message: "Error fetching questions. Please try again.",
          });
        }

        // Convert ObjectId strings back to ObjectIds if needed for consistency
        if (questions) {
          questions.forEach(q => {
            if (q.category && typeof q.category === 'string') {
              q.category = new mongoose.Types.ObjectId(q.category);
            }
          });
        }

        if (!questions || questions.length === 0) {
          return socket.emit("error", {
            code: "INSUFFICIENT_QUESTIONS",
            message: `No questions found in category "${category.name}". Please add questions to this category first.`,
          });
        }

        if (questions.length < questionsCount) {
          return socket.emit("error", {
            code: "INSUFFICIENT_QUESTIONS",
            message: `Not enough questions in category "${category.name}". Available: ${questions.length}, Required: ${questionsCount}. Please reduce the number of questions or add more questions to this category.`,
          });
        }

        // Create match document in MongoDB
        // Aligned with Backend Architecture schema
        const match = await Match.create({
          players: [{ user: userId, socketId }],
          category: categoryId,
          questions: questions.map((q) => q._id),
          scores: [{ userId, score: 0 }],
          state: "waiting", // Waiting for second player
          startedAt: null,
          finishedAt: null,
        });

        const matchId = match._id.toString();
        
        // Generate match code (first 12 chars of matchId, uppercase)
        const matchCode = matchId.substring(0, 12).toUpperCase();

        // Store match in memory for real-time management
        gameRooms.set(matchId, {
          matchId,
          matchCode,
          categoryId,
          categoryName: category.name,
          numberOfQuestions: questionsCount,
          questionTimeLimit: questionTimeLimit,
          players: [
            {
              userId,
              socketId,
              username: socket.username,
              answered: false,
              disconnected: false,
              finishReady: false,
            },
          ],
          questionsData: questions,
          currentQuestionIndex: 0,
          scores: { [userId]: 0 },
          answers: {},
          state: "waiting",
          startTime: null,
          timerInterval: null,
          createdAt: new Date(),
        });
        
        // Also store by code for quick lookup
        gameRooms.set(matchCode, gameRooms.get(matchId));

        // Add creator to match room
        socket.join(matchId);
        socket.matchId = matchId;

        console.log(`[CREATE-MATCH] Match ${matchId} created, waiting for opponent`);

        // Notify creator
        socket.emit("match-created", {
          matchId,
          matchCode,
          code: matchCode,
          categoryName: category.name,
          message: "Match created! Waiting for opponent to join...",
          playersNeeded: 1,
        });

        // Broadcast match availability to all players in lobby
        io.emit("match-available", {
          matchId,
          categoryId,
          categoryName: category.name,
          creatorUsername: socket.username,
          playersCount: 1,
          maxPlayers: 2,
          difficultyLevels: ["easy", "medium", "hard"],
        });
      } catch (error) {
        console.error("[CREATE-MATCH ERROR]", error);
        socket.emit("error", {
          code: "CREATE_MATCH_FAILED",
          message: "Failed to create match",
        });
      }
    });

    /**
     * Player 2: Join an existing match
     * Frontend sends: matchId, userId (from JWT)
     * Returns: match-ready event, questions start being delivered
     */
    socket.on("join-match", async (data) => {
      try {
        const { matchId, code, userId } = data;
        const socketId = socket.id;
        
        if (!matchId && !code) {
          return socket.emit("error", {
            code: "MATCH_ID_REQUIRED",
            message: "Match ID or code is required",
          });
        }

        console.log(`[JOIN-MATCH] Player ${userId} joining match ${matchId || code}`);
        console.log(`[JOIN-MATCH] Available rooms: ${gameRooms.size}`);
        console.log(`[JOIN-MATCH] Room keys:`, Array.from(gameRooms.keys()));

        // First, try to find room by code or matchId in memory
        let room = null;
        let targetMatchId = matchId;
        const codeUpper = code ? code.toUpperCase() : null;
        
        // First priority: direct lookup by matchId
        if (targetMatchId && gameRooms.has(targetMatchId)) {
          room = gameRooms.get(targetMatchId);
          console.log(`[JOIN-MATCH] Found room by matchId: ${targetMatchId}`);
        }
        
        // Second priority: lookup by code key
        if (!room && codeUpper && gameRooms.has(codeUpper)) {
          room = gameRooms.get(codeUpper);
          if (room && room.matchId) {
            targetMatchId = room.matchId;
            console.log(`[JOIN-MATCH] Found room by code key: ${codeUpper} -> ${targetMatchId}`);
          }
        }
        
        // Third priority: search through all rooms by matchCode property
        if (!room && codeUpper) {
          for (const [key, value] of gameRooms.entries()) {
            if (value && value.matchCode === codeUpper) {
              room = value;
              targetMatchId = value.matchId;
              console.log(`[JOIN-MATCH] Found room by matchCode property: ${codeUpper} -> ${targetMatchId} (key: ${key})`);
              break;
            }
          }
        }
        
        // Fourth priority: try partial matchId if code looks like ObjectId start
        if (!room && codeUpper && codeUpper.length >= 8) {
          for (const [key, value] of gameRooms.entries()) {
            if (key && key.toString().toUpperCase().startsWith(codeUpper)) {
              room = value;
              targetMatchId = value.matchId || key;
              console.log(`[JOIN-MATCH] Found room by partial matchId: ${codeUpper} -> ${targetMatchId} (key: ${key})`);
              break;
            }
          }
        }
        
        // If no room in memory, match doesn't exist or was cleaned up
        if (!room) {
          console.log(`[JOIN-MATCH] Room not found for code: ${codeUpper}, matchId: ${targetMatchId}`);
          console.log(`[JOIN-MATCH] Available room codes:`, Array.from(gameRooms.entries()).map(([k, v]) => ({ key: k, matchCode: v?.matchCode, matchId: v?.matchId })));
          return socket.emit("error", {
            code: "MATCH_NOT_FOUND",
            message: "Match does not exist or has expired. Please check the match code or create a new match.",
          });
        }
        
        // Validate room state
        if (room.state !== "waiting" || room.players.length >= 2) {
          return socket.emit("error", {
            code: "MATCH_UNAVAILABLE",
            message: "Match is full or already started",
          });
        }
        
        // Get match from database using the found matchId
        const match = await Match.findById(targetMatchId);
        
        if (!match) {
          return socket.emit("error", {
            code: "MATCH_NOT_FOUND",
            message: "Match does not exist in database",
          });
        }
        
        // Validate match state in database
        if (match.state !== "waiting" || match.players.length >= 2) {
          return socket.emit("error", {
            code: "MATCH_UNAVAILABLE",
            message: "Match is full or already started",
          });
        }

        // Add second player to match (MongoDB)
        match.players.push({ user: userId, socketId });
        match.scores.push({ userId, score: 0 });
        match.state = "active";
        match.startedAt = new Date();
        await match.save();

        // Add player to memory room
        room.players.push({
          userId,
          socketId,
          username: socket.username,
          answered: false,
          disconnected: false,
          finishReady: false,
        });
        room.state = "active";

        // Join socket to match room
        socket.join(targetMatchId);
        socket.matchId = targetMatchId;

        console.log(
          `[JOIN-MATCH] Player ${userId} joined match ${targetMatchId}. Match starting...`
        );

        // Notify both players
        io.to(targetMatchId).emit("match-ready", {
          matchId: targetMatchId,
          players: room.players.map((p) => ({
            userId: p.userId,
            username: p.username,
          })),
          message: "Both players connected! Battle starting...",
          startingIn: 2, // seconds
        });
        
        // Also emit match-joined for frontend compatibility
        socket.emit("match-joined", {
          matchId: targetMatchId,
          players: room.players.map((p) => ({
            userId: p.userId,
            username: p.username,
          })),
        });

        // Remove match from lobby broadcasts
        io.emit("match-removed-from-lobby", { matchId: targetMatchId });

        // Start match after 2 second delay
        setTimeout(() => {
          startMatch(io, targetMatchId);
        }, 2000);
      } catch (error) {
        console.error("[JOIN-MATCH ERROR]", error);
        socket.emit("error", {
          code: "JOIN_MATCH_FAILED",
          message: "Failed to join match",
        });
      }
    });

    // ============================================================
    // QUESTION & ANSWER HANDLING
    // ============================================================

    /**
     * Submit answer to current question
     * Frontend sends: matchId, questionIndex, selectedOptionId (1-4)
     * Validates against correctOptionId
     * Awards 10 XP per correct answer
     */
    socket.on("submit-answer", async (data) => {
      try {
        const { matchId, questionIndex, selectedOptionId } = data;
        const userId = socket.userId;

        const room = gameRooms.get(matchId);
        if (!room) {
          return socket.emit("error", {
            code: "MATCH_NOT_FOUND",
            message: "Match not found",
          });
        }

        // Get current question
        const question = room.questionsData[questionIndex];
        if (!question) {
          return socket.emit("error", {
            code: "QUESTION_NOT_FOUND",
            message: "Question not found",
          });
        }

        // Validate answer: compare selectedOptionId with correctOptionId
        // Aligned with Backend Architecture (1-4, not 0-3)
        const isCorrect = selectedOptionId === question.correctOptionId;

        // Award XP (10 per correct, 0 per incorrect)
        const xpAwarded = isCorrect ? XP_PER_CORRECT : 0;
        room.scores[userId] = (room.scores[userId] || 0) + xpAwarded;

        // Store answer for results
        room.answers[userId] = {
          questionIndex,
          selectedOptionId,
          isCorrect,
          xpAwarded,
        };

        // Find correct option text for feedback
        const correctOption = question.options.find(
          (opt) => opt.id === question.correctOptionId
        );

        console.log(
          `[ANSWER] User ${userId} answered Q${questionIndex + 1}: ${
            isCorrect ? "CORRECT" : "INCORRECT"
          }`
        );

        // Send feedback to answering player
        socket.emit("answer-validated", {
          questionIndex,
          selectedOptionId,
          isCorrect,
          correctOptionId: question.correctOptionId,
          correctOptionText: correctOption ? correctOption.text : "Unknown",
          xpAwarded,
          totalScore: room.scores[userId],
          message: isCorrect ? "Correct! +10 XP" : `Incorrect. Correct: ${correctOption.text}`,
        });

        // Mark player as answered
        const player = room.players.find((p) => p.userId === userId);
        if (player) {
          player.answered = true;
        }

        // Notify opponent that you answered
        io.to(matchId)
          .except(socket.id)
          .emit("opponent-answered", {
            userId,
            questionIndex,
            hasAnswered: true,
          });

        console.log(
          `[ANSWER-STATUS] Players answered in Q${questionIndex + 1}: ${room.players
            .map((p) => p.answered)
            .join(", ")}`
        );

        // Check if both players answered
        if (room.players.every((p) => p.answered)) {
          console.log(`[BOTH-ANSWERED] Displaying results for Q${questionIndex + 1}`);
          displayQuestionResults(io, matchId, questionIndex);
          
          // Check if all questions are answered - if so, end match immediately
          if (questionIndex + 1 >= room.questionsData.length) {
            console.log(`[ALL-QUESTIONS-ANSWERED] Both players finished all questions, ending match immediately`);
            // Wait a moment to show results, then end match
            setTimeout(() => {
              endMatch(io, matchId, { reason: "All questions answered" });
            }, 2000); // 2 seconds to show final question results
          }
        }
      } catch (error) {
        console.error("[SUBMIT-ANSWER ERROR]", error);
        socket.emit("error", {
          code: "ANSWER_FAILED",
          message: "Failed to submit answer",
        });
      }
    });

    /**
     * Finish quiz early - both players can click this on last question
     * Ends the match immediately
     */
    socket.on("finish-quiz", (data) => {
      try {
        const { matchId, userId } = data;
        const room = gameRooms.get(matchId);

        if (!room) {
          return socket.emit("error", {
            code: "MATCH_NOT_FOUND",
            message: "Match not found",
          });
        }

        // Mark player as ready to finish
        const player = room.players.find((p) => p.userId === userId);
        if (player) {
          player.finishReady = true;
        }

        // Check if both players are ready to finish
        if (room.players.length >= 2 && room.players.every((p) => p.finishReady)) {
          console.log(`[FINISH-QUIZ] Both players ready, ending match ${matchId}`);
          endMatch(io, matchId, { reason: "Both players finished quiz" });
        } else {
          console.log(`[FINISH-QUIZ] Player ${userId} ready, waiting for opponent`);
          // Notify other players
          io.to(matchId).except(socket.id).emit("opponent-finish-ready", {
            message: "Opponent clicked Finish Quiz",
          });
        }
      } catch (error) {
        console.error("[FINISH-QUIZ ERROR]", error);
        socket.emit("error", {
          code: "FINISH_QUIZ_FAILED",
          message: "Failed to finish quiz",
        });
      }
    });

    /**
     * Request next question
     * Both players emit this (or auto-advance)
     * Moves to next question or ends match if no more
     */
    socket.on("next-question", (data) => {
      try {
        const { matchId } = data;
        const room = gameRooms.get(matchId);

        if (!room) {
          return socket.emit("error", {
            code: "MATCH_NOT_FOUND",
            message: "Match not found",
          });
        }

        // Move to next question
        room.currentQuestionIndex++;
        console.log(
          `[NEXT-QUESTION] Match ${matchId} moving to question ${room.currentQuestionIndex + 1}`
        );

        if (room.currentQuestionIndex >= room.questionsData.length) {
          // All questions answered
          console.log(`[MATCH-COMPLETE] All questions answered, ending match`);
          endMatch(io, matchId);
        } else {
          // Deliver next question
          deliverQuestion(io, matchId, room.currentQuestionIndex);
        }
      } catch (error) {
        console.error("[NEXT-QUESTION ERROR]", error);
        socket.emit("error", {
          code: "NEXT_QUESTION_FAILED",
          message: "Failed to get next question",
        });
      }
    });

    // ============================================================
    // TIMER SYNC & MANAGEMENT
    // ============================================================

    /**
     * Sync timer with server
     * Used when client timer drifts
     * Returns remaining time for current question
     */
    socket.on("sync-timer", (data) => {
      try {
        const { matchId } = data;
        const room = gameRooms.get(matchId);

        if (room && room.startTime) {
          const timeLimit = room.questionTimeLimit || QUESTION_TIME_LIMIT;
          const elapsed = Date.now() - room.startTime;
          const timeRemaining = Math.max(0, timeLimit * 1000 - elapsed);

          socket.emit("timer-synced", {
            timeRemaining,
            totalTime: timeLimit * 1000,
            percentage: Math.round((timeRemaining / (timeLimit * 1000)) * 100),
          });
        }
      } catch (error) {
        console.error("[SYNC-TIMER ERROR]", error);
      }
    });

    // ============================================================
    // MATCH CONTROL
    // ============================================================

    /**
     * Player forfeits the match
     * Opponent wins by default
     */
    socket.on("forfeit-match", async (data) => {
      try {
        const { matchId } = data;
        const userId = socket.userId;

        console.log(`[FORFEIT] Player ${userId} forfeited match ${matchId}`);

        const room = gameRooms.get(matchId);
        if (room) {
          // Opponent wins - they get bonus points
          const opponent = room.players.find((p) => p.userId !== userId);
          if (opponent) {
            room.scores[opponent.userId] = (room.scores[opponent.userId] || 0) + 50; // Forfeit bonus
            console.log(
              `[FORFEIT-BONUS] ${opponent.userId} gets 50 XP bonus for opponent forfeit`
            );
          }
        }

        // End match with forfeit reason
        endMatch(io, matchId, { forfeiter: userId, reason: "Player forfeited" });
      } catch (error) {
        console.error("[FORFEIT-MATCH ERROR]", error);
      }
    });

    /**
     * Reconnect to ongoing match
     * If player disconnected and reconnects within grace period
     */
    socket.on("reconnect-match", async (data) => {
      try {
        const { matchId, userId } = data;
        const room = gameRooms.get(matchId);

        if (!room) {
          return socket.emit("error", {
            code: "MATCH_NOT_FOUND",
            message: "Match not found",
          });
        }

        // Restore socket connection
        socket.userId = userId;
        socket.matchId = matchId;
        socket.join(matchId);

        // Mark player as reconnected
        const player = room.players.find((p) => p.userId === userId);
        if (player) {
          player.disconnected = false;
          player.socketId = socket.id;
        }

        console.log(`[RECONNECT] Player ${userId} reconnected to match ${matchId}`);

        // Notify opponent
        io.to(matchId)
          .except(socket.id)
          .emit("opponent-reconnected", { userId, message: "Opponent reconnected!" });

        // Send current game state to reconnected player
        socket.emit("match-state-restored", {
          matchId,
          currentQuestionIndex: room.currentQuestionIndex,
          currentQuestion: room.questionsData[room.currentQuestionIndex],
          scores: room.scores,
          state: room.state,
          players: room.players.map((p) => ({
            userId: p.userId,
            username: p.username,
            answered: p.answered,
          })),
        });
      } catch (error) {
        console.error("[RECONNECT-MATCH ERROR]", error);
        socket.emit("error", {
          code: "RECONNECT_FAILED",
          message: "Failed to reconnect",
        });
      }
    });

    // ============================================================
    // DISCONNECTION HANDLING
    // ============================================================

    socket.on("disconnect", () => {
      console.log(`[DISCONNECT] Socket disconnected: ${socket.id}`);

      const matchId = socket.matchId;
      if (matchId) {
        const room = gameRooms.get(matchId);
        if (room) {
          const player = room.players.find((p) => p.socketId === socket.id);
          if (player) {
            player.disconnected = true;
            console.log(
              `[DISCONNECT] Player ${player.userId} disconnected from match ${matchId}`
            );

            // Notify opponent
            io.to(matchId)
              .except(socket.id)
              .emit("opponent-disconnected", {
                userId: player.userId,
                message: "Opponent disconnected. Waiting for reconnection...",
                reconnectTimeLimit: RECONNECT_GRACE_PERIOD / 1000,
              });

            // Set grace period for reconnection
            const gracePeriodTimeout = setTimeout(() => {
              // Check if player is still disconnected
              const stillDisconnected = room.players.find(
                (p) => p.userId === player.userId && p.disconnected
              );

              if (stillDisconnected) {
                console.log(
                  `[GRACE-PERIOD-EXPIRED] Player ${player.userId} did not reconnect`
                );
                // Player forfeited - opponent wins
                endMatch(io, matchId, {
                  forfeiter: player.userId,
                  reason: "Did not reconnect in time",
                });
              }
            }, RECONNECT_GRACE_PERIOD);

            // Store timeout ID for potential cancellation
            room.gracePeriodTimeout = gracePeriodTimeout;
          }
        }
      }
    });
  });

  return io;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Start match and deliver first question
 */
function startMatch(io, matchId) {
  const room = gameRooms.get(matchId);
  if (!room) return;

  room.state = "active";
  console.log(`[START-MATCH] Match ${matchId} starting. Category: ${room.categoryName}`);

  io.to(matchId).emit("start-battle", {
    matchId,
    categoryName: room.categoryName,
    totalQuestions: room.questionsData.length,
    questionDuration: room.questionTimeLimit || QUESTION_TIME_LIMIT,
    message: `Battle started! Answer ${room.questionsData.length} questions about ${room.categoryName}`,
  });

  // Deliver first question after 1 second
  setTimeout(() => {
    deliverQuestion(io, matchId, 0);
  }, 1000);
}

/**
 * Deliver question to both players
 * Aligned with Backend Architecture: uses 'text', not 'questionText'
 */
function deliverQuestion(io, matchId, questionIndex) {
  const room = gameRooms.get(matchId);
  if (!room || !room.questionsData[questionIndex]) {
    console.error(`[DELIVER-QUESTION] Invalid question at index ${questionIndex}`);
    return;
  }

  const question = room.questionsData[questionIndex];
  const timeLimit = room.questionTimeLimit || QUESTION_TIME_LIMIT;

  // Reset answered flags for new question
  room.players.forEach((p) => (p.answered = false));
  room.startTime = Date.now();

  console.log(`[DELIVER-QUESTION] Delivering Q${questionIndex + 1} for match ${matchId} (${timeLimit}s limit)`);

  // Emit question to both players
  io.to(matchId).emit("question-display", {
    questionIndex,
    questionText: question.text, // Aligned: 'text', not 'questionText'
    options: question.options, // Aligned: Array of {id, text}
    correctOptionId: question.correctOptionId, // Include correct answer ID for frontend
    difficulty: question.difficulty,
    timeLimit: timeLimit,
    questionNumber: questionIndex + 1,
    totalQuestions: room.questionsData.length,
  });

  // Set auto-timeout: if both don't answer in time, auto-advance
  const timeoutId = setTimeout(() => {
    if (room && room.currentQuestionIndex === questionIndex) {
      console.log(
        `[QUESTION-TIMEOUT] Q${questionIndex + 1} timed out for match ${matchId}`
      );
      io.to(matchId).emit("question-timeout", {
        questionIndex,
        message: "Time is up!",
      });
      displayQuestionResults(io, matchId, questionIndex);
    }
  }, timeLimit * 1000);

  room.timerInterval = timeoutId;
}

/**
 * Display results after both players answered or timeout
 */
function displayQuestionResults(io, matchId, questionIndex) {
  const room = gameRooms.get(matchId);
  if (!room || !room.questionsData[questionIndex]) return;

  const question = room.questionsData[questionIndex];
  const correctOption = question.options.find(
    (opt) => opt.id === question.correctOptionId
  );

  console.log(`[QUESTION-RESULTS] Q${questionIndex + 1} results: ${correctOption.text}`);

  io.to(matchId).emit("question-results", {
    questionIndex,
    correctOptionId: question.correctOptionId,
    correctOptionText: correctOption ? correctOption.text : "Unknown",
    scores: room.scores,
    playerAnswers: Object.entries(room.answers).map(([userId, answer]) => ({
      userId,
      isCorrect: answer.isCorrect,
      selectedOptionId: answer.selectedOptionId,
      xpAwarded: answer.xpAwarded,
    })),
    message: "Results displayed. Next question coming...",
  });

  // Clear answers for next question
  room.answers = {};
}

/**
 * End match, update database, award XP and badges
 * Aligned with Backend Architecture XP & Ranking System
 */
async function endMatch(io, matchId, endReason = {}) {
  const room = gameRooms.get(matchId);
  if (!room) {
    console.error(`[END-MATCH] Room not found for ${matchId}`);
    return;
  }

  try {
    console.log(
      `[END-MATCH] Ending match ${matchId}. Reason:`,
      endReason.reason || "Normal completion"
    );

    // Calculate final scores
    const finalScores = room.scores;

    // Determine winner
    let winnerId = null;
    if (endReason.forfeiter) {
      winnerId = room.players.find((p) => p.userId !== endReason.forfeiter)?.userId;
    } else {
      const entries = Object.entries(finalScores);
      if (entries.length > 0) {
        winnerId = entries.sort(([, a], [, b]) => b - a)[0][0];
      }
    }

    // Update match in MongoDB
    const match = await Match.findByIdAndUpdate(
      matchId,
      {
        state: "finished", // Aligned with Backend Architecture
        finishedAt: new Date(),
        scores: Object.entries(finalScores).map(([userId, score]) => ({
          userId: new mongoose.Types.ObjectId(userId),
          score,
        })),
      },
      { new: true }
    );

    // Update user profiles: XP, rank, badges
    for (const [userId, score] of Object.entries(finalScores)) {
      const user = await User.findById(userId);
      if (user) {
        // Award XP
        user.xp += score;
        user.weeklyXp += score;

        // Update rank based on total XP using calculateRank utility
        const { calculateRank } = require("../utils/calculateXP");
        user.rank = calculateRank(user.xp);

        // Award badges
        const earnedBadges = [];

        // Check for "Perfect Match" badge (5/5 correct = 50 XP)
        if (score >= PERFECT_MATCH_BONUS && !user.badges.includes("Perfect Match")) {
          user.badges.push("Perfect Match");
          earnedBadges.push("Perfect Match");
        }

        // Check for milestone badges
        if (user.xp >= 100 && !user.badges.includes("Novice")) {
          user.badges.push("Novice");
          earnedBadges.push("Novice");
        }
        if (user.xp >= 1000 && !user.badges.includes("Pro Gamer")) {
          user.badges.push("Pro Gamer");
          earnedBadges.push("Pro Gamer");
        }
        if (user.xp >= 5000 && !user.badges.includes("Master")) {
          user.badges.push("Master");
          earnedBadges.push("Master");
        }

        await user.save();

        console.log(
          `[USER-UPDATE] ${userId} earned ${score} XP, rank: ${user.rank}, badges: ${earnedBadges.join(
            ", "
          )}`
        );
      }
    }

    // Build leaderboard from final scores
    const leaderboard = [];
    for (const [userId, score] of Object.entries(finalScores)) {
      const player = room.players.find(p => p.userId === userId);
      if (player) {
        leaderboard.push({
          userId,
          username: player.username || `Player ${userId.slice(0, 8)}`,
          score
        });
      }
    }
    // Sort by score descending
    leaderboard.sort((a, b) => b.score - a.score);

    // Notify both players of match end
    io.to(matchId).emit("match-ended", {
      matchId,
      winnerId,
      finalScores,
      leaderboard,
      questionsCount: room.questionsData?.length || room.numberOfQuestions || 0,
      reason: endReason.reason || "Match completed",
      message: `Match complete! ${winnerId ? `Winner: Player with ${finalScores[winnerId]} XP` : "Draw"}`,
    });

    // Clean up: remove from memory
    if (room.gracePeriodTimeout) {
      clearTimeout(room.gracePeriodTimeout);
    }
    if (room.timerInterval) {
      clearTimeout(room.timerInterval);
    }
    gameRooms.delete(matchId);

    console.log(`[MATCH-CLEANED] Match ${matchId} removed from memory`);
  } catch (error) {
    console.error("[END-MATCH ERROR]", error);
    io.to(matchId).emit("error", {
      code: "END_MATCH_ERROR",
      message: "Error ending match",
    });
  }
}

module.exports = { initializeSocket };