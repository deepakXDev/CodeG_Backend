const Submission = require("../models/Submission");
const Problem = require("../models/Problem");
const UserStats = require("../models/UserStats");
const ErrorHandler = require("../middlewares/errorMiddleware");
const { catchAsyncErrors } = require("../middlewares/catchAsyncErrors");
const mongoose = require("mongoose");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const os = require("os");
const executeCode = require("../utils/codeRunner");
const axios = require('axios');
const compilerURL = process.env.COMPILER_URL;

exports.submitSolution = catchAsyncErrors(async (req, res, next) => {
  const { language, sourceCode, problemId } = req.body;
  const userId = req.user._id;

  if (!problemId || !language) {
    return next(new ErrorHandler("Missing required fields", 400));
  }

  const problem = await Problem.findById(problemId);
  if (!problem) {
    return next(new ErrorHandler("Problem not found", 404));
  }

  let sourceFilePath = null;

  const tempDir = path.resolve(process.cwd(), "uploads/source");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  if (req.files?.["sourceCode"]?.[0]) {
    sourceFilePath = req.files["sourceCode"][0].path;
  } else if (sourceCode) {
    const fileName = `${uuidv4()}.${language}`;
    sourceFilePath = path.resolve(tempDir, fileName);
    fs.writeFileSync(sourceFilePath, sourceCode);
  } else {
    return next(new ErrorHandler("No code submitted", 400));
  }

  const submission = await Submission.create({
    userId,
    problemId: problem._id,
    language,
    sourceCode: sourceCode || "", // still store raw text for UI view
    filePath: sourceFilePath,
    verdict: "Pending",
  });

//   if (!submission.sourceCode) {
//   throw new Error("Submission missing source code");
// }

  res.status(202).json({
    success: true,
    submissionId: submission._id,
  });

  // processSubmission(submission, problem).catch((err) => {
  //   console.error("Submission processing error:", err);

  //   submission.verdict = "System Error";
  //   submission.errorMessage = "System error during processing";
  //   submission.save();
  // });
  
    // Send to compiler service asynchronously
    sendToCompilerService(submission, problem);
});

async function sendToCompilerService(submission, problem) {
  try {
    let codeToSend = submission.sourceCode;

// If sourceCode is empty (uploaded file case), read from filePath
if (!codeToSend && submission.filePath && fs.existsSync(submission.filePath)) {
  codeToSend = fs.readFileSync(submission.filePath, "utf-8");
}

  const callbackUrl = `${process.env.BACKEND_URL}/submission/${submission._id}/callback`;

  // Fire-and-forget the request to the compiler. (no await)
    axios.post(`${compilerURL}/process-submission`, {
      language: submission.language,
      sourceCode: codeToSend,
      testCases: problem.testCases,
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit,
      callbackUrl: callbackUrl, 
      secretToken: process.env.COMPILER_SECRET_TOKEN 
    });
  } catch (err) {
    // This will now only catch errors if the initial axios.post fails to send.
    console.error('Failed to dispatch job to compiler service:', err.message);
    submission.verdict = 'System Error';
    submission.errorMessage = 'Failed to dispatch job to compiler.';
    await submission.save();
  }
}

exports.compilerCallback= async (req, res, next) => {
  const { secretToken, results, verdict, errorDetails } = req.body;
  if (secretToken !== process.env.COMPILER_SECRET_TOKEN) {
    return next(new ErrorHandler("Unauthorized", 403));
  }

  const submission = await Submission.findById(req.params.id);
  if (!submission) {
    return next(new ErrorHandler("Submission not found", 404));
  }

  console.log(errorDetails);

  submission.verdict = verdict;
  submission.testCasesPassed = results.filter(r => r.passed).length;
  submission.totalTestCases = results.length;
  submission.errorDetails = errorDetails;
  await submission.save();

  await updateUserStats(submission);
  
  res.status(200).json({ success: true, message: "Callback received." });
}



    // Call compiler service
    // const compilerResponse = await axios.post('http://localhost:5001/process-submission', {
    // const compilerResponse=await axios.post(`${compilerURL}/process-submission`,{
    //   language: submission.language,
    //   sourceCode: codeToSend,
    //   testCases: problem.testCases,
    //   timeLimit: problem.timeLimit,
    //   memoryLimit: problem.memoryLimit
    // });

//     const { results, verdict } = compilerResponse.data;

//     // Update submission in DB
//     submission.verdict = verdict;
//     submission.testCasesPassed = results.filter(r => r.passed).length;
//     submission.totalTestCases = results.length;
//     submission.resultDetails = results; // optional, store full results for UI
//     await submission.save();

//     // Update user stats
//     await updateUserStats(submission);

//   } 
//   // catch (err) {
//   //   console.error('Compiler service error:', err.message);
//   //   submission.verdict = 'System Error';
//   //   submission.errorMessage = err.message;
//   //   await submission.save();
//   // }
//   catch (err) {
//   console.error('Compiler service error FULL:', err);  // logs the whole error object
//   console.error('STACK:', err.stack);                  // shows call stack
//   console.error('NAME:', err.name);                    // error type
//   console.error('MESSAGE:', err.message);              // short message

//   submission.verdict = 'System Error';
//   submission.errorMessage = err.stack || err.message;  // save stack trace for debugging
//   await submission.save();
// }
// }


async function processSubmission(submission, problem) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tempDir = path.resolve(process.cwd(), "temp"); //not join, to avoid issue accross OSes
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const uniqueId = uuidv4();

    const inputFile = path.resolve(tempDir, `${uniqueId}_input.txt`);
    const outputFile = path.resolve(tempDir, `${uniqueId}_output.txt`);

    const sourceFile = submission.filePath;

    let passedCases = 0;
    const totalCases = problem.testCases.length;

    for (const testCase of problem.testCases) {
      fs.writeFileSync(inputFile, testCase.input); //- Clears file first → then writes this input.

      const result = await executeCode(
        submission.language,
        sourceFile,
        inputFile,
        outputFile,
        problem.timeLimit * 1000,
        problem.memoryLimit * 1024
      );
      const { stdout, stderr, code } = result;

      if (code !== 0) {
        submission.verdict = getVerdictFromError(code);
        submission.errorMessage = stderr;
        break;
      }

      const userOutput = fs.readFileSync(outputFile, "utf-8").trim();
      const passed = compareTestCase(testCase.output, userOutput);

      if (passed) {
        passedCases++;
      } else {
        submission.verdict = "Wrong Answer";
        break;
      }
    }

    [inputFile, outputFile].forEach((file) => {
      console.log(file);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    submission.testCasesPassed = passedCases;
    submission.totalTestCases = totalCases;
    if (submission.verdict === "Pending") {
      submission.verdict =
        passedCases === totalCases ? "Accepted" : "Wrong Answer";
    }

    await submission.save({ session });

    await updateUserStats(submission, session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

function getVerdictFromError(code) {
  switch (code) {
    case 137: // SIGKILL (memory limit)
      return "Memory Limit Exceeded";
    case 124: // Timeout
      return "Time Limit Exceeded";
    case 1: // Runtime error
      return "Runtime Error";
    default:
      return "System Error"; // System error
  }
}

async function updateUserStats(submission, session=null) {
  const userId = submission.userId;
  const problemId = submission.problemId;
  const verdict = submission.verdict;

  const submissionDate = new Date(submission.createdAt)
    .toISOString()
    .split("T")[0];

  const problem = await Problem.findById(problemId);
  if (!problem) throw new Error("Problem not found");
  const difficulty = problem.difficulty; // 'easy', 'medium', 'hard'

  const statsUpdate = {
    $inc: {
      totalSubmissions: 1,
      [`difficultyStats.${difficulty}.submissions`]: 1,
    },
    $set: { lastSubmissionDate: submissionDate },
  };

  if (verdict === "AC") {
    statsUpdate.$inc.totalAccepted = 1;
    statsUpdate.$inc[`difficultyStats.${difficulty}.solved`] = 1;
    statsUpdate.$addToSet = { solvedProblemIds: problemId };
  }

  const userStats = await UserStats.findOne({ userId }).session(session);
  if (userStats) {
    const lastDate = userStats.lastSubmissionDate;
    const currentDate = submissionDate;

    if (lastDate === currentDate) {
    } else if (isConsecutiveDay(lastDate, currentDate)) {
      statsUpdate.$inc.currentStreak = 1;
      statsUpdate.$set.highestStreak = Math.max(
        userStats.highestStreak,
        userStats.currentStreak + 1
      );
    } else {
      statsUpdate.$set.currentStreak = 1;
    }
  }

  statsUpdate.$inc = statsUpdate.$inc || {}; //Hence, you **ensure `$inc` exists** before you assign:
  statsUpdate.$inc[`activityHeatmap.${submissionDate}`] = 1;

  await UserStats.findOneAndUpdate({ userId }, statsUpdate, {
    upsert: true,
    new: true,
    session,
  });
}

function isConsecutiveDay(prevDate, currentDate) {
  if (!prevDate) return false;
  const prev = new Date(prevDate);
  const curr = new Date(currentDate);
  const diffTime = curr - prev;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays === 1;
}

/**
 * @description Get submission by ID
 * @route GET /api/submissions/:id
 * @access Private (owner or admin)
 */
exports.getSubmission = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;
  const isAdmin = req.user.role === "ADMIN";

  const submission = await Submission.findById(id)
    .populate("problem", "title slug difficulty")
    .populate("user", "username");

  if (!submission) {
    return next(new ErrorHandler("Submission not found", 404));
  }

  if (submission.userId.toString() !== userId.toString() && !isAdmin) {
    return next(new ErrorHandler("Unauthorized access", 403));
  }

  res.status(200).json({
    success: true,
    data: submission,
  });
});

/**
 * @description Get user's submission history
 * @route GET /api/submissions/user/:userId
 * @access Private (owner or admin)
 */
exports.getUserSubmissions = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.params;
  const requestingUserId = req.user._id; //when by this method, then use .toString()
  const isAdmin = req.user.role === "ADMIN";

  if (userId !== requestingUserId.toString() && !isAdmin) {
    return next(new ErrorHandler("Unauthorized access", 403));
  }

  const { page = 1, limit = 20, problemId, verdict } = req.query;

  const query = { userId };
  if (problemId) query.problemId = problemId;
  if (verdict) query.verdict = verdict;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    populate: [{ path: "problem", select: "title slug difficulty" }],
  };

  const submissions = await Submission.paginate(query, options);

  res.status(200).json({
    success: true,

    data: { submissions }, // Ensure frontend can read: data.data.submissions
  });
});



exports.downloadSourceCode = async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await Submission.findById(id);
    if (!submission || !submission.filePath) {
      return res.status(404).json({ error: "Submission or file not found" });
    }

    return res.download(submission.filePath);
  } catch (err) {
    res.status(500).json({ error: "Download failed", details: err.message });
  }
};

exports.getProblemSubmissions = catchAsyncErrors(async (req, res, next) => {
  const { problemId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const problem = await Problem.findById(problemId);
  if (!problem) {
    return next(new ErrorHandler("Problem not found", 404));
  }

  const submissions = await Submission.find({
    problemId,
    userId: req.user._id,
  })
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip((page - 1) * limit);

  const total = await Submission.countDocuments({
    problemId,
    userId: req.user._id,
  });

  res.status(200).json({
    success: true,
    message: "Problem submissions retrieved successfully",
    data: {
      submissions,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total,
    },
  });
});

exports.getSubmissionStats = catchAsyncErrors(async (req, res, next) => {
  const userId = req.user._id;
  console.trace("reached here");
  const stats = await Submission.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: "$verdict",
        count: { $sum: 1 },
      },
    },
  ]);

  const totalSubmissions = await Submission.countDocuments({ userId });

  const acceptedSubmissions =
    stats.find((s) => s._id === "Accepted")?.count || 0;
  const acceptanceRate =
    totalSubmissions > 0
      ? ((acceptedSubmissions / totalSubmissions) * 100).toFixed(2)
      : 0;

  const solvedProblems = await Submission.distinct("problemId", {
    userId,
    verdict: "Accepted",
  });

  res.status(200).json({
    success: true,
    message: "Submission stats retrieved successfully",
    data: {
      totalSubmissions,
      acceptedSubmissions,
      acceptanceRate: parseFloat(acceptanceRate),
      solvedProblems: solvedProblems.length,
      verdictBreakdown: stats,
    },
  });
});

exports.getMySubmissions = catchAsyncErrors(async (req, res, next) => {
  req.params.userId = req.user._id.toString();
  return exports.getUserSubmissions(req, res, next);
});




function normalizeOutput(outputStr) {
  const cleanStr = outputStr.replace(/\r/g, "").trim();

  try {
    return JSON.parse(cleanStr);
  } catch (err) {
    const tokens = cleanStr.split(/\s+/).map((token) => {
      if (!isNaN(token)) return Number(token); // number
      if (token === "true") return true;
      if (token === "false") return false;
      return token; // raw string
    });
    return tokens.length === 1 ? tokens[0] : tokens;
  }
}

function deepEqual(a, b) {
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  if (typeof a === "object" && a && b) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(a[key], b[key]));
  }

  return a === b;
}

function compareTestCase(expectedStr, rawOutput) {
  let expected, output;

  try {
    expected = normalizeOutput(expectedStr);
  } catch (e) {
    console.error("Invalid expected JSON string:", expectedStr);
    return false;
  }

  try {
    output = normalizeOutput(rawOutput);
  } catch (e) {
    console.error("Invalid output format:", rawOutput);
    return false;
  }

  return deepEqual(output, expected);
}

exports.runSampleTest = async (req, res, next) => {

  try {
    const { language, customInput, sourceCode } = req.body;

    let sourceFilePath = null;
    const tempDir = path.resolve(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    if (req.files?.["sourceCode"]?.[0]) {
      sourceFilePath = req.files["sourceCode"][0].path;
    } else if (sourceCode) {
      const fileName = `${uuidv4()}.${language}`;
      sourceFilePath = path.resolve(tempDir, fileName);
      fs.writeFileSync(sourceFilePath, sourceCode);
    } else {
      return next(new ErrorHandler("No code submitted", 400));
    }

    if (customInput) {
      const uniqueId = uuidv4();
      const inputFile = path.resolve(tempDir, `${uniqueId}_input.txt`);
      const outputFile = path.resolve(tempDir, `${uniqueId}_output.txt`);
      fs.writeFileSync(inputFile, customInput);

      const result = await executeCode(
        language,
        sourceFilePath,
        inputFile,
        outputFile,
        3000,
        128
      );
      const output = fs.existsSync(outputFile)
        ? fs.readFileSync(outputFile, "utf8")
        : "";

      [sourceFilePath, inputFile, outputFile].forEach(
        (file) => fs.existsSync(file) && fs.unlinkSync(file)
      );

      return res.status(200).json({
        message: "Custom input run completed",
        output,
        ...result,
      });
    }

    const sampleCases = problem.testCases.filter((tc) => tc.isSample);

    const results = [];

    for (const [index, testCase] of sampleCases.entries()) {
      const uniqueId = uuidv4();
      const inputFile = path.resolve(tempDir, `${uniqueId}_input.txt`);
      const outputFile = path.resolve(tempDir, `${uniqueId}_output.txt`);
      fs.writeFileSync(inputFile, testCase.input);

      const result = await executeCode(
        language,
        sourceFilePath,
        inputFile,
        outputFile,
        3000,
        128
      );
      const output = fs.existsSync(outputFile)
        ? fs.readFileSync(outputFile, "utf8")
        : "";
      const expected = testCase.output;

      [inputFile, outputFile].forEach(
        (file) => fs.existsSync(file) && fs.unlinkSync(file)
      );

      const passed = compareTestCase(expected, output);

      results.push({
        case: index + 1,
        input: testCase.input,
        expected,
        output,
        passed,
        ...result,
      });

      if (!passed) break;
    }

    if (fs.existsSync(sourceFilePath)) fs.unlinkSync(sourceFilePath);

    res.status(200).json({
      message: "Sample test cases executed",
      testResults: results,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Sample execution failed", details: err.message });
  }
};