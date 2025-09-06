const UserStats = require("../models/UserStats");
const Submission = require("../models/Submission");
const ErrorHandler = require("../middlewares/errorMiddleware");
const { catchAsyncErrors } = require("../middlewares/catchAsyncErrors");
const mongoose = require("mongoose");
const User = require("../models/User");

exports.getUserProfile = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.params;

  const userStats = await UserStats.findOne({ userId })
    .populate("solvedProblems", "title slug difficulty")
    .lean();

  if (!userStats) {
    return next(new ErrorHandler("User stats not found", 404));
  }

  const solvedByDifficulty = {
    Easy: userStats.solvedProblems.filter((p) => p.difficulty === "Easy")
      .length,
    Medium: userStats.solvedProblems.filter((p) => p.difficulty === "Medium")
      .length,
    Hard: userStats.solvedProblems.filter((p) => p.difficulty === "Hard")
      .length,
  };

  const recentSubmissions = await Submission.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("problem", "title slug")
    .lean();

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalSolved: userStats.totalAccepted,
        totalSubmissions: userStats.totalSubmissions,
        currentStreak: userStats.currentStreak,
        highestStreak: userStats.highestStreak,
        solvedByDifficulty,
      },
      solvedProblems: userStats.solvedProblems,
      recentSubmissions,
    },
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
  const isAdmin = req.user.role === "ADMIN";

  if (userId !== requestingUserId.toString() && !isAdmin) {
    return next(new ErrorHandler("Unauthorized access", 403));
  }

  const userStats = await UserStats.findOne({ userId }).lean();
  if (!userStats) {
    return next(new ErrorHandler("User stats not found", 404));
  }

  const heatmap = Object.entries(userStats.activityHeatmap || {}).map(
    ([date, count]) => ({
      date,
      count,
    })
  );

  res.status(200).json({
    success: true,
    data: heatmap,
  });
});

exports.getAuthenticatedUserProfile = catchAsyncErrors(
  async (req, res, next) => {
    const user = await User.findById(req.user.id).lean();

    if (!user) {
      return next(new ErrorHandler("User not found.", 404));
    }

    const { password, ...userData } = user;

    res.status(200).json({
      success: true,
      data: userData,
    });
  }
);

exports.updateUserProfile = catchAsyncErrors(async (req, res, next) => {
  const { fullName, username, gender, location, website } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }

  user.fullName = fullName || user.fullName;
  user.username = username || user.username;
  user.gender = gender || user.gender;
  user.location = location || user.location;
  user.website = website || user.website;

  if (req.files && req.files.avatar) {
    console.log("Avatar file received, ready for upload.");
  }

  await user.save();

  const { password, ...updatedUserData } = user.toObject();

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: updatedUserData,
  });
});
