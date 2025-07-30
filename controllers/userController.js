// import UserStats from "../models/UserStats.js";
const UserStats = require("../models/UserStats");
const Submission = require("../models/Submission");
const ErrorHandler = require("../middlewares/errorMiddleware");
const { catchAsyncErrors} = require("../middlewares/catchAsyncErrors");
const mongoose = require("mongoose");

/**
 * @description Get user profile with stats
 * @route GET /api/users/:userId/profile
 * @access Public
 */
exports.getUserProfile = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.params;

  const userStats = await UserStats.findOne({ userId })
    .populate('solvedProblems', 'title slug difficulty')
    .lean();

  if (!userStats) {
    return next(new ErrorHandler('User stats not found', 404));
  }

  // Calculate problem statistics
  const solvedByDifficulty = {
    easy: userStats.solvedProblems.filter(p => p.difficulty === 'easy').length,
    medium: userStats.solvedProblems.filter(p => p.difficulty === 'medium').length,
    hard: userStats.solvedProblems.filter(p => p.difficulty === 'hard').length
  };

  // Get recent submissions
  const recentSubmissions = await Submission.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('problem', 'title slug')
    .lean();

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalSolved: userStats.totalAccepted,
        totalSubmissions: userStats.totalSubmissions,
        currentStreak: userStats.currentStreak,
        highestStreak: userStats.highestStreak,
        solvedByDifficulty
      },
      solvedProblems: userStats.solvedProblems,
      recentSubmissions
    }
  });
});

/**
 * @description Get user activity heatmap
 * @route GET /api/users/:userId/activity
 * @access Private (owner or admin)
 */
exports.getUserActivity = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.params;
  const requestingUserId = req.user._id;
  const isAdmin = req.user.role === 'ADMIN';

  // Check authorization
  if (userId !== requestingUserId.toString() && !isAdmin) {
    return next(new ErrorHandler('Unauthorized access', 403));
  }

  const userStats = await UserStats.findOne({ userId }).lean();
  if (!userStats) {
    return next(new ErrorHandler('User stats not found', 404));
  }

  // Convert heatmap to array format for frontend
  const heatmap = Object.entries(userStats.activityHeatmap || {}).map(([date, count]) => ({
    date,
    count
  }));

  res.status(200).json({
    success: true,
    data: heatmap
  });
});