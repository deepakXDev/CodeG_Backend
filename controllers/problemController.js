const Problem = require("../models/Problem");
const Submission = require("../models/Submission");
const ErrorHandler = require("../middlewares/errorMiddleware");
const { catchAsyncErrors } = require("../middlewares/catchAsyncErrors");
const mongoose = require("mongoose");

/**
 * @description Get list of problems with pagination and filtering
 * @route GET /api/problems
 * @access Public
 */
exports.getProblems = catchAsyncErrors(async (req, res, next) => {
  const { page = 1, limit = 10, difficulty, tags, search } = req.query;

  const query = {};
  if (difficulty) query.difficulty = difficulty;
  if (tags) query.tags = { $in: tags.split(",") };
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { descriptionMarkdown: { $regex: search, $options: "i" } },
    ];
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    select: "-descriptionMarkdown -testCases -constraints",
    populate: { path: "createdBy", select: "name" },
  };

  const problems = await Problem.paginate(query, options);

  res.status(200).json({
    success: true,
    data: problems, //// includes docs, totalPages, etc.
  });
});

exports.getProblemById = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const problem = await Problem.findById(id)
    .populate("createdBy", "username")
    .lean();

  if (!problem) {
    return next(new ErrorHandler("Problem not found", 404));
  }

  if (!userId) {
    problem.testCases = problem.testCases.filter((tc) => tc.isSample);
  } else if (userId.toString() !== problem.createdBy._id.toString()) {
    problem.testCases = problem.testCases.filter(
      (tc) => tc.isSample || !tc.isHidden
    );
  }

  if (userId) {
    const submission = await Submission.findOne({
      userId,
      problemId: problem._id,
      verdict: "AC",
    }).sort({ createdAt: -1 });

    if (submission) {
      problem.isSolved = true;
      problem.lastSubmission = submission.createdAt;
    }
  }

  res.status(200).json({
    success: true,
    data: problem,
  });
});

/**
 * @description Get single problem by slug
 * @route GET /api/problems/:slug
 * @access Public
 */
exports.getProblemBySlug = catchAsyncErrors(async (req, res, next) => {
  const { slug } = req.params;
  const userId = req.user?._id;

  const problem = await Problem.findOne({ slug })
    .populate("createdBy", "username")
    .lean();

  if (!problem) {
    return next(new ErrorHandler("Problem not found", 404));
  }

  if (!userId) {
    problem.testCases = problem.testCases.filter((tc) => tc.isSample);
  } else if (userId.toString() !== problem.createdBy._id.toString()) {
    problem.testCases = problem.testCases.filter(
      (tc) => tc.isSample || !tc.isHidden
    );
  }

  if (userId) {
    const submission = await Submission.findOne({
      userId,
      problemId: problem._id,
      verdict: "AC",
    }).sort({ createdAt: -1 });

    if (submission) {
      problem.isSolved = true;
      problem.lastSubmission = submission.createdAt;
    }
  }

  res.status(200).json({
    success: true,
    data: problem,
  });
});

/**
 * @description Create a new problem (Admin only)
 * @route POST /api/problems
 * @access Private/Admin
 */
exports.createProblem = catchAsyncErrors(async (req, res, next) => {
  const { title, ...rest } = req.body;
  const userId = req.user._id;

  const existingProblem = await Problem.findOne({ title });
  if (existingProblem) {
    return next(
      new ErrorHandler("Problem with this title already exists", 400)
    );
  }

  console.log(rest.testCases);
  if (!rest.testCases || rest.testCases.length < 2) {
    return next(new ErrorHandler("At least 2 test cases are required", 400));
  }

  const hasSample = rest.testCases.some((tc) => tc.isSample);
  if (!hasSample) {
    return next(
      new ErrorHandler("At least one sample test case is required", 400)
    );
  }

  const problem = await Problem.create({
    title,

    ...rest,
    createdBy: userId,
  });

  res.status(201).json({
    success: true,
    data: problem,
  });
});

/**
 * @description Update a problem (Admin only)
 * @route PUT /api/problems/:slug
 * @access Private/Admin
 */
exports.updateProblem = catchAsyncErrors(async (req, res, next) => {
  const { slug } = req.params;
  const updates = req.body;

  const problem = await Problem.findOneAndUpdate({ slug }, updates, {
    new: true,
    runValidators: true,
  });

  if (!problem) {
    return next(new ErrorHandler("Problem not found", 404));
  }

  res.status(200).json({
    success: true,
    data: problem,
  });
});
