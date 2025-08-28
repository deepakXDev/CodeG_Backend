const express = require("express");
const {
  forgotPassword,
  getUser,
  login,
  logout,
  register,
  resetPassword,
  verifyOTP,
  updatePassword,
  googleLogin,
  resendOtp,
} = require("../controllers/authController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { body: body, validationResult } = require("express-validator");
const ErrorHandler = require("../middlewares/errorMiddleware");

const router = express.Router();

const validateRegistration = [
  (req, res, next) => {
    const requiredFields = ["name", "email", "password"];
    const missingFields = requiredFields.filter(
      (field) => req.body[field] === undefined
    );

    if (missingFields.length > 0) {
      return next(
        new ErrorHandler(
          `Please enter all fields: ${missingFields.join(", ")}`,
          400
        )
      );
    }

    next(); // ✅ Move to the next validation middleware
  },

  body("name")
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Name must be between 3 and 20 characters long."),

  body("email").isEmail().withMessage("Invalid email format."),

  body("password")
    .isLength({ min: 6, max: 15 })
    .withMessage("Password must be between 6 and 15 characters long."),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors
        .array()
        .map((err) => err.msg)
        .join(", ");
      return next(new ErrorHandler(`Validation error: ${errorMessages}`, 400));
    }
    next(); // Continue if no errors
  },
];

router.post("/register", validateRegistration, register); //as update if already registered with googleAuth
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp",resendOtp)
router.post("/login", login);
router.get("/logout", isAuthenticated, logout);
router.get("/profile", isAuthenticated, getUser);
router.post("/password/forgot", forgotPassword); //if authenticated..then also no problem
router.put("/password/reset/:token", resetPassword);
router.put("/password/update", isAuthenticated, updatePassword);

router.post("/google-login", googleLogin);

module.exports = router;
