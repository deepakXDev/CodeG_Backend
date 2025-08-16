const express = require("express");
const {
  getProblems,
  getProblemBySlug,
  createProblem,
  updateProblem,
  getProblemById
} = require("../controllers/problemController");
const { isAuthenticated, requireRole, isAdmin } = require("../middlewares/authMiddleware");
// const { body } = require("express-validator");
const {body,validationResult}=require("express-validator");

const ErrorHandler = require("../middlewares/errorMiddleware");
const router = express.Router();

// Validation middleware
const validateProblemCreation = [
  body('title').notEmpty().trim().withMessage('Title is required'),
  body('slug').notEmpty().matches(/^[a-z0-9-]+$/).withMessage('Invalid slug format'),
  body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty'),
  body('tags').isArray({ min: 1 }).withMessage('At least one tag is required'),
  body('descriptionMarkdown').notEmpty().withMessage('Description is required'),
  body('timeLimit').isFloat({ min: 0.5, max: 10 }).withMessage('Invalid time limit'),
  body('memoryLimit').isInt({ min: 16, max: 1024 }).withMessage('Invalid memory limit'),
  body('testCases').isArray({ min: 2 }).withMessage('At least 2 test cases required'),
  body('testCases.*.input').notEmpty().withMessage('Test case input is required'),
  body('testCases.*.output').notEmpty().withMessage('Test case output is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors.array().map(err => err.msg).join(', ');
      return next(new ErrorHandler(message, 400));
    }
    next();
  }
];

// Public routes
router.get("/", getProblems);
router.get("/id/:id", getProblemById);     // fetch by MongoId
router.get("/:slug", getProblemBySlug);    // fetch by slug


// Admin routes
router.post(
  "/",
  isAuthenticated,
  isAdmin,
  validateProblemCreation,
  createProblem
);



router.put(
  "/:slug",
  isAuthenticated,
  requireRole("Admin"),
  validateProblemCreation,
  updateProblem
);

// export default router;
module.exports=router;