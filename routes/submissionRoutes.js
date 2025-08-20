const express = require("express");
const {
  submitSolution,
  getSubmission,
  getUserSubmissions,
} = require("../controllers/submissionController");

const controller = require("../controllers/submissionController");
const upload = require("../middlewares/upload");

const {
  isAuthenticated,
  isOwnerOrAdmin,
} = require("../middlewares/authMiddleware");
const { body, validationResult } = require("express-validator");
const ErrorHandler = require("../middlewares/errorMiddleware");
const Submission = require("../models/Submission");

const router = express.Router();

const validateSubmission = [
  body("problemId").notEmpty().withMessage("ProblemId is required"),
  body("language")
    .isIn(["cpp", "java", "python", "javascript"])
    .withMessage("Invalid language"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors
        .array()
        .map((err) => err.msg)
        .join(", ");
      return next(new ErrorHandler(message, 400));
    }
    next();
  },
];

router.post(
  "/",
  isAuthenticated,

  upload.fields([
    { name: "sourceCode", maxCount: 1 }, //sourceCode->fieldName in multer (file.filedName)
  ]),
  validateSubmission,
  submitSolution
);

router.get(
  "/stats",
  isAuthenticated,

  controller.getSubmissionStats
);

router.get(
  "/:id",
  isAuthenticated,
  isOwnerOrAdmin(Submission, "userId"), //So you're dynamically injecting the model into the middleware and using its findById method.
  getSubmission
);

router.get(
  "/user/:userId",
  isAuthenticated,
  isOwnerOrAdmin(null, "userId", "params"),
  getUserSubmissions
);

router.post(
  "/run-sample",
  upload.fields([
    { name: "sourceCode", maxCount: 1 }, //sourceCode->fieldName in multer (file.filedName)
  ]),
  controller.runSampleTest
);

router.get("/", isAuthenticated, controller.getMySubmissions);

router.get(
  "/problem/:problemId",
  isAuthenticated,
  controller.getProblemSubmissions
);

router.get("/download/:id", controller.downloadSourceCode);

module.exports = router;
