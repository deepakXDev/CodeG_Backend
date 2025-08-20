const express = require("express");
const {
  getProblems,
  getProblemBySlug,
  createProblem,
  updateProblem,
  getProblemById,
} = require("../controllers/problemController");
const {
  isAuthenticated,
  requireRole,
  isAdmin,
  isAdminOrProblem_Setter,
} = require("../middlewares/authMiddleware");

const { body, validationResult } = require("express-validator");

const ErrorHandler = require("../middlewares/errorMiddleware");
const router = express.Router();

const validateProblemCreation = [
  body("title").notEmpty().trim().withMessage("Title is required"),

  body("difficulty")
    .isIn(["Easy", "Medium", "Hard"])
    .withMessage("Invalid difficulty"),
  body("tags").isArray({ min: 1 }).withMessage("At least one tag is required"),
  body("descriptionMarkdown").notEmpty().withMessage("Description is required"),
  body("timeLimit")
    .isFloat({ min: 500, max: 10000 })
    .withMessage("Invalid time limit"),
  body("memoryLimit")
    .isInt({ min: 16, max: 1024 })
    .withMessage("Invalid memory limit"),

  body("testCases.*.input")
    .notEmpty()
    .withMessage("Test case input is required"),
  body("testCases.*.output")
    .notEmpty()
    .withMessage("Test case output is required"),
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

router.get("/", getProblems);
router.get("/id/:id", getProblemById); // fetch by MongoId
router.get("/:slug", getProblemBySlug); // fetch by slug

router.post(
  "/",
  isAuthenticated,
  isAdminOrProblem_Setter,
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

module.exports = router;
