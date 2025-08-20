const mongoose = require("mongoose");

const userStatsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    totalSubmissions: { type: Number, default: 0 },
    totalAccepted: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    highestStreak: { type: Number, default: 0 },
    lastSubmissionDate: { type: Date },
    solvedProblemIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Problem",
      },
    ],
    difficultyStats: {
      easy: { solved: Number, submissions: Number },
      medium: { solved: Number, submissions: Number },
      hard: { solved: Number, submissions: Number },
    },
    activityHeatmap: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userStatsSchema.index({ userId: 1 });
userStatsSchema.index({ totalAccepted: -1 });
userStatsSchema.index({ highestStreak: -1 });

userStatsSchema.pre("save", function (next) {
  if (!this.difficultyStats) {
    this.difficultyStats = {
      easy: { solved: 0, submissions: 0 },
      medium: { solved: 0, submissions: 0 },
      hard: { solved: 0, submissions: 0 },
    };
  }
  next();
});

userStatsSchema.virtual("solvedProblems", {
  ref: "Problem",
  localField: "solvedProblemIds",
  foreignField: "_id",
});

module.exports = mongoose.model("UserStats", userStatsSchema); // ✅ Default export
