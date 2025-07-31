const express = require("express");
const {
  submitSolution,
  getSubmission,
  getUserSubmissions
} = require("../controllers/submissionController");

const controller = require('../controllers/submissionController');
const upload = require('../middlewares/upload');

const {
  isAuthenticated,
  isOwnerOrAdmin
} = require("../middlewares/authMiddleware");
const { body,validationResult } = require("express-validator");
const ErrorHandler = require("../middlewares/errorMiddleware");
const Submission = require('../models/Submission');

const router = express.Router();

// Validation middleware
const validateSubmission = [
  body('problemSlug').notEmpty().withMessage('Problem slug is required'),
  body('language').isIn(['cpp', 'java', 'python', 'javascript']).withMessage('Invalid language'),
  // body('sourceCode').notEmpty().withMessage('Source code is required'), //as also fileUpload option
  
  

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors.array().map(err => err.msg).join(', ');
      return next(new ErrorHandler(message, 400));
    }
    next();
  }
];

// Submit solution
router.post(
  "/",
  isAuthenticated,
  // validateSubmission, //before need multer to parse the formData->file && req.body && then use such middlewares..
   upload.fields([
    { name: 'sourceCode', maxCount: 1 }, //sourceCode->fieldName in multer (file.filedName)
    // { name: 'sampleInput', maxCount: 1 },
  ]),
  validateSubmission,
  submitSolution
);

// Get submission by ID
router.get(
  "/:id",
  isAuthenticated,
  isOwnerOrAdmin(Submission, 'userId'), //So you're dynamically injecting the model into the middleware and using its findById method.
  getSubmission
);

// Get user submissions
router.get(
  "/user/:userId",
  isAuthenticated,
  isOwnerOrAdmin(null, 'userId', 'params'),
  getUserSubmissions
);


router.post(
  '/run-sample',
  upload.fields([
    { name: 'sourceCode', maxCount: 1 }, //sourceCode->fieldName in multer (file.filedName)
    // { name: 'sampleInput', maxCount: 1 },
  ]),
  controller.runSampleTest
);

router.get('/download/:id', controller.downloadSourceCode);


module.exports=router;