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
const os = require('os');

/**
 * @description Submit solution for a problem
 * @route POST /api/submit
 * @access Private
 */
exports.submitSolution = catchAsyncErrors(async (req, res, next) => {
  const { problemSlug, language, sourceCode } = req.body;
  const userId = req.user._id;

  // Validate input
  if (!problemSlug || !language || !sourceCode) {
    return next(new ErrorHandler('Missing required fields', 400));
  }

  // Find problem
  const problem = await Problem.findOne({ slug: problemSlug });
  if (!problem) {
    return next(new ErrorHandler('Problem not found', 404));
  }

  // Create submission record
  const submission = await Submission.create({
    userId,
    problemId: problem._id,
    language,
    sourceCode,
    verdict: 'PENDING'
  });

  // Immediately respond with submission ID
  res.status(202).json({
    success: true,
    submissionId: submission._id
  });

  // Process submission in background
  processSubmission(submission, problem)
    .catch(err => {
      console.error('Submission processing error:', err);
      // Update submission with error status
      submission.verdict = 'SE';
      submission.errorMessage = 'System error during processing';
      submission.save();
    });
});

// Helper function to process submission
// 1. executeCode (3Files_provide, with time & memoryLimt); -->getVerdictFromError call if (code!==0 ie -1 or, whatever..as process.on(1st argument: code))
// a/c to code-->MLE,TLE,RE,SE decide...by getVerdictFromError (switch fxn)
// 2. count the testCasesPassed && clean the files
// 3. update Submission (testCases passed, totalTestCases..) && update UserStats ... all in one session (ie grouped)

async function processSubmission(submission, problem) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create temporary files for processing
    // const tempDir = path.join(os.tmpdir(), 'online-judge'); //tmpdir->of os..so autoClean by os_itself..

    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const uniqueId = uuidv4();
    
    // const sourceFile = path.join(tempDir, `${uniqueId}.${submission.language}`);
    // const inputFile = path.join(tempDir, `${uniqueId}_input.txt`);
    // const outputFile = path.join(tempDir, `${uniqueId}_output.txt`);
    
    const sourceFile = path.resolve(tempDir, `${uniqueId}.${submission.language}`);
    const inputFile = path.resolve(tempDir, `${uniqueId}_input.txt`);
    const outputFile = path.resolve(tempDir, `${uniqueId}_output.txt`);

    // const quotePath = (p) => `"${p.replace(/\\/g, '/')}"`; // Helps in shell-safe quoting

    // Write source code to file
    // fs.writeFileSync(sourceFile, submission.sourceCode);

    console.log("Saving to sourceFile:", sourceFile);
    fs.writeFileSync(sourceFile, submission.sourceCode);
    console.log("File saved. Exists?", fs.existsSync(sourceFile));  // Check before compile


    // Process each test case
    let passedCases = 0;
    const totalCases = problem.testCases.length;

    for (const testCase of problem.testCases) {
      // Write input to file
      fs.writeFileSync(inputFile, testCase.input); //- Clears file first → then writes this input.
    

      // Execute code with timeout
      // This step runs as a promise using `spawn()`
      const { stdout, stderr, code } = await executeCode(
        submission.language,
        sourceFile,
        inputFile,
        outputFile,
        problem.timeLimit * 1000, // convert to ms
        problem.memoryLimit * 1024 // convert to KB
      );

      // Check results
      if (code !== 0) {
        submission.verdict = getVerdictFromError(code);
        submission.errorMessage = stderr;
        break;
      }

      //So **yes, it starts from top of file**, not from where last left off.
      // file is guaranteed to have only the **latest output**, not previous ones.
      const userOutput = fs.readFileSync(outputFile, 'utf-8').trim();
      if (userOutput === testCase.output.trim()) {
        passedCases++;
      } else {
        submission.verdict = 'WA';
        break;
      }

      // // not need to read from outputFile, as also in resolve->passed "stdout"..
      // const expected = JSON.stringify(JSON.parse(testCase.output));
      // const actual = JSON.stringify(JSON.parse(stdout));
      // if (actual !== expected) {
      //   submission.verdict = 'Wrong Answer';
      //   break;
      // }

    }

    // Clean up files
    // [sourceFile, inputFile, outputFile].forEach(file => {
    //   console.log(file);
    //   if (fs.existsSync(file)) fs.unlinkSync(file);
    // });

    // const tempFiles = [sourceFile, inputFile, outputFile];
    // tempFiles.forEach((file) => {
    //   try {
    //     if (fs.existsSync(file)) fs.unlinkSync(file);
    //   } catch (err) {
    //     console.warn(`Failed to delete ${file}:`, err);
    //   }
    // });

    // Update submission
    submission.testCasesPassed = passedCases;
    submission.totalTestCases = totalCases;
    if (submission.verdict === 'PENDING') {
      submission.verdict = passedCases === totalCases ? 'AC' : 'WA';
    }

    await submission.save({ session });

    // Update user stats
    await updateUserStats(submission, session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Helper to execute code with resource limits ---> Returns promise**

// spawn(command,args,stdio & shell->true) == process && RunTimer: process.kill() after timeLimit && timeOut-->true;
// inputFile-->write to stdin && get stdout,stderr(on)
// process.on(close) --> 1. clearTimer && checkTimeOut-->if corssed, stdout="" && stder: TLE && set code: -1

// else write--> into output File (the stdout-->value) && ***resolve(stdout,stderr,code)-->send..
// send (stdout, stderr, code) to processSubmision via (resolve)-->as it returns a promise..

// 'code' && 'data'-->process.stdout.on && process.on --> 1st argument..

// function executeCode(language, sourceFile, inputFile, outputFile, timeLimit, memoryLimit) {
  
//   //All this (process) is wrapped in a **Promise** that resolves once the code finishes or is killed.

//   return new Promise((resolve) => {
//     let command, args;
    
//     switch (language) {
//       case 'python':
//         command = 'python3';
//         args = [sourceFile];
//         break;
//       case 'cpp':
//         command = 'g++';
//         args = [sourceFile, '-o', `${sourceFile}.out`, '&&', `${sourceFile}.out`];
//         break;
//       case 'java':
//         command = 'java';
//         args = [sourceFile];
//         break;
//       case 'javascript':
//         command = 'node';
//         args = [sourceFile];
//         break;
//       default:
//         throw new Error('Unsupported language');
//     }

//     //create new child Process (python/c++/..a/c to command && args)
//     const process = spawn(command, args, {
//       stdio: ['pipe', 'pipe', 'pipe'], //three pipe-->for stdin,stdout,stderr (provide input, read output, read err)
//       shell: true
//     });

//     // Set time and memory limits
//     let timedOut = false;
//     const timeout = setTimeout(() => {
//       timedOut = true;
//       process.kill(); //terminates the on_going process
//     }, timeLimit);

//     // Write input to stdin
//     const input = fs.readFileSync(inputFile);
//     process.stdin.write(input); //write input to child_process
//     process.stdin.end(); //close input stream..to start execution

//     let stdout = '';
//     let stderr = '';
    
//     process.stdout.on('data', (data) => { //recieves ouput in chunks..
//       stdout += data.toString();
//     });

//     process.stderr.on('data', (data) => {
//       stderr += data.toString();
//     });

//     process.on('close', (code) => { //called (.on**) when child process exits (success or, error)
//       clearTimeout(timeout);
      
//       if (timedOut) {
//         resolve({ stdout: '', stderr: 'Time Limit Exceeded', code: -1 });
//       } else {
//         // Write output to file
//         // Clears file first → then writes this input.
//         fs.writeFileSync(outputFile, stdout);
//         resolve({ stdout, stderr, code });
//       }
//     });
//   });
// }


function executeCode(language, sourceFile, inputFile, outputFile, timeLimit, memoryLimit) {
  return new Promise((resolve) => {
    const ext = path.extname(sourceFile);

    const outputExt = process.platform === 'win32' ? '.exe' : '.out';
    const exeFile = sourceFile.replace(ext, outputExt);

    let compileCmd = null;
    if (language === 'cpp') {
      // Compilation step
      compileCmd = spawn('g++', [sourceFile, '-o', exeFile], {
        shell: true
      });

      compileCmd.on('close', (code) => {
        if (code !== 0) {
          return resolve({
            stdout: '',
            stderr: `Compilation failed with code ${code}`,
            code: 1,
          });
        }

        // Execution step
        const runCmd = process.platform === 'win32' ? exeFile : `./${path.basename(exeFile)}`;
        runExecutable(runCmd, inputFile, outputFile, timeLimit, resolve);
      });
    } else if (language === 'python') {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      runExecutable(pythonCmd, inputFile, outputFile, timeLimit, resolve, [sourceFile]); //python3->linux
    } else if (language === 'javascript') {
      runExecutable('node', inputFile, outputFile, timeLimit, resolve, [sourceFile]);
    } 
    //also java->javac Main.java && then java Main..to compile & run..
    else {
      return resolve({ stdout: '', stderr: 'Unsupported language', code: 1 });
    }
  });
}

function runExecutable(cmd, inputFile, outputFile, timeLimit, resolve, args = []) {
  const process = spawn(cmd, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false
  });

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    process.kill();
  }, timeLimit);

  const input = fs.readFileSync(inputFile);
  process.stdin.write(input);
  process.stdin.end();

  let stdout = '';
  let stderr = '';

  process.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  process.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  process.on('close', (code) => {
    clearTimeout(timeout);
    if (timedOut) {
      return resolve({ stdout: '', stderr: 'Time Limit Exceeded', code: -1 });
    }
    fs.writeFileSync(outputFile, stdout);
    resolve({ stdout, stderr, code });
  });
}


function getVerdictFromError(code) {
  switch (code) {
    case 137: // SIGKILL (memory limit)
      return 'MLE';
    case 124: // Timeout
      return 'TLE';
    case 1:   // Runtime error
      return 'RE';
    default:
      return 'SE'; // System error
  }
}


//unlike processSubmission ie called without await-->so run in background...** even if process submission is asyncFunc
//passing session as argument && calling function as await funcName(arg1,arg2) && this func is async..

async function updateUserStats(submission, session) {
  const userId = submission.userId;
  const problemId = submission.problemId;
  const verdict = submission.verdict;

  const submissionDate = new Date(submission.createdAt).toISOString().split('T')[0];

  // Update UserStats

  const problem = await Problem.findById(problemId);
  if (!problem) throw new Error("Problem not found");
  const difficulty = problem.difficulty; // 'easy', 'medium', 'hard'

  const statsUpdate = {
    // $inc: { totalSubmissions: 1 },
    $inc: {
      totalSubmissions: 1,
      [`difficultyStats.${difficulty}.submissions`]: 1
    },
    $set: { lastSubmissionDate: submissionDate }
  };

  if (verdict === 'AC') {
    statsUpdate.$inc.totalAccepted = 1;
    statsUpdate.$inc[`difficultyStats.${difficulty}.solved`] = 1;
    statsUpdate.$addToSet = { solvedProblemIds: problemId };
  }

  // Update streak
  const userStats = await UserStats.findOne({ userId }).session(session);
  if (userStats) {
    const lastDate = userStats.lastSubmissionDate;
    const currentDate = submissionDate;
    
    if (lastDate === currentDate) {
      // No streak update needed for same day
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

  // Update activity heatmap
  statsUpdate.$inc = statsUpdate.$inc || {}; //Hence, you **ensure `$inc` exists** before you assign:
  statsUpdate.$inc[`activityHeatmap.${submissionDate}`] = 1;

  await UserStats.findOneAndUpdate(
    { userId },
    statsUpdate,
    { upsert: true, new: true, session }
  );
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
  const isAdmin = req.user.role === 'ADMIN';

  const submission = await Submission.findById(id)
    .populate('problem', 'title slug difficulty')
    .populate('user', 'username');

  if (!submission) {
    return next(new ErrorHandler('Submission not found', 404));
  }

  // Check ownership
  if (submission.userId.toString() !== userId.toString() && !isAdmin) {
    return next(new ErrorHandler('Unauthorized access', 403));
  }

  res.status(200).json({
    success: true,
    data: submission
  });
});

/**
 * @description Get user's submission history
 * @route GET /api/submissions/user/:userId
 * @access Private (owner or admin)
 */
exports.getUserSubmissions = catchAsyncErrors(async (req, res, next) => {
  const { userId } = req.params;
  const requestingUserId = req.user._id;
  const isAdmin = req.user.role === 'ADMIN';

  // Check authorization
  if (userId !== requestingUserId.toString() && !isAdmin) {
    return next(new ErrorHandler('Unauthorized access', 403));
  }

  const { page = 1, limit = 20, problemId, verdict } = req.query;

  const query = { userId };
  if (problemId) query.problemId = problemId;
  if (verdict) query.verdict = verdict;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    populate: [
      { path: 'problem', select: 'title slug difficulty' }
    ]
  };

  const submissions = await Submission.paginate(query, options);

  res.status(200).json({
    success: true,
    data: submissions
  });
});