const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    registrationSessionId: {
      type: String,
      default: null,
    },
    isPwdAuth: { type: Boolean, default: false },
    password: { type: String, select: false }, //transfer tempPassword to password (on verifyOTP)
    tempPassword: { type: String }, //in login, check password, not tempPassword
    googleId: { type: String },
    role: {
      type: String,
      enum: ["User", "Admin", "Problem_Setter"],
      default: "User",
    },

    accountVerified: { type: Boolean, default: false },
    pwdSetupAttempts: {
      count: { type: Number, default: 0 },
      lastAttempt: Date,
    },
    forgotPasswordAttempts: { type: Number, default: 0 },
    forgotPasswordAttemptsExpire: { type: Date },

    verificationCode: Number,
    verificationCodeExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

userSchema.methods.generateVerificationCode = function () {
  function generateRandomFiveDigitNumber() {
    const firstDigit = Math.floor(Math.random() * 9) + 1;
    const remainingDigits = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");

    return parseInt(firstDigit + remainingDigits);
  }
  const verificationCode = generateRandomFiveDigitNumber();
  this.verificationCode = verificationCode;
  this.verificationCodeExpire = Date.now() + 2 * 60 * 1000; //for 2min
  return verificationCode;
};

userSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRE, //JWT_EXPIRE=3d && COOKIE_EXPIRE=3d
  });
};

userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 5 * 60 * 1000;

  return resetToken;
};

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
