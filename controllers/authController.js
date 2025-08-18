const { catchAsyncErrors } = require("../middlewares/catchAsyncErrors");
const ErrorHandler = require("../middlewares/errorMiddleware");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { sendVerificationCode } = require("../utils/sendVerificationCode");
const { sendToken } = require("../utils/sendToken");
const { generateForgotPasswordEmailTemplate } = require("../utils/emailTemplate");
const { sendEmail } = require("../utils/sendEmail");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// export const register = catchAsyncErrors(async (req, res, next) => {
exports.register=catchAsyncErrors(async (req, res, next) => {
  // try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return next(new ErrorHandler("Please enter all fields.", 400));
    }

    if (/[^a-zA-Z0-9!@#$%^&*]/.test(password)) {
      return next(new ErrorHandler("Invalid characters in password.", 400));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const registrationSessionId = crypto.randomUUID();

    const user = await User.findOne({ email });

    if (user) {
      if (user.accountVerified && user.isPwdAuth) {
        return next(new ErrorHandler("User already exists.", 400));
      }

      // Handle Google auth user adding password (not update, name && role)** send error if role not match
      if (user.googleId && !user.isPwdAuth) {
        const diff = user.pwdSetupAttempts?.lastAttempt
          ? (now - user.pwdSetupAttempts.lastAttempt) / (1000 * 60 * 60)
          : Infinity;

        if (diff < 24 && user.pwdSetupAttempts.count >= 10) {
          return next(new ErrorHandler("Too many attempts. Try after 24 hours.", 400));
        }

        user.tempPassword = hashedPassword;
        user.registrationSessionId = registrationSessionId;
        user.generateVerificationCode();
        user.pwdSetupAttempts = {
          count: diff < 24 ? user.pwdSetupAttempts.count + 1 : 1,
          lastAttempt: new Date(),
        };
        await user.save();
        
        // Send session ID back to frontend
        sendVerificationCode(user.verificationCode, email, res, registrationSessionId);
        return;
      }

      // Existing unverified user
      const diff = user.pwdSetupAttempts?.lastAttempt
        ? (now - user.pwdSetupAttempts.lastAttempt) / (1000 * 60 * 60)
        : Infinity;

      if (diff < 24 && user.pwdSetupAttempts.count >= 10) {
        return next(new ErrorHandler("Too many attempts. Try after 24 hours.", 400));
      }

      user.name = name;
      user.password = hashedPassword;
      user.accountVerified = false;
      user.role=role; //keep changing role, until verified..
      user.registrationSessionId = registrationSessionId;
      user.pwdSetupAttempts = {
        count: diff < 24 ? (user.pwdSetupAttempts?.count || 0) + 1 : 1,
        lastAttempt: now,
      };
      
      const verificationCode = user.generateVerificationCode();
      await user.save();
      sendVerificationCode(verificationCode, email, res, registrationSessionId);
    } else {
      // New user creation
      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        role,
        registrationSessionId
      });

      const verificationCode = newUser.generateVerificationCode();
      // await newUser.save();
      // sendVerificationCode(verificationCode, email, res, registrationSessionId);
      
    newUser.accountVerified = true;
    newUser.verificationCode = null;
    newUser.verificationCodeExpire = null;
    newUser.isPwdAuth = true;
    newUser.registrationSessionId = null; // Clear after use

    if (newUser.tempPassword) {
      newUser.password = newUser.tempPassword;
      newUser.tempPassword = null;
      newUser.pwdSetupAttempts = { count: 0, lastAttempt: null };
    }
    await newUser.save({ validateModifiedOnly: true });
    res.clearCookie("email");
    sendToken(newUser, 200, "Account Verified.", res);
    console.log(newUser);
    }
  // } catch (error) {
  //   next(error);
  // }
});

exports.verifyOTP = catchAsyncErrors(async (req, res, next) => {
const { otp } = req.body;
const email = req.cookies.email || req.body.email;
console.log(`${otp}:${email}`);
const registrationSessionId = req.cookies.reg_session || req.body.registrationSessionId;

console.log(`${registrationSessionId}`);
  if (!email || !otp || !registrationSessionId) {
    return next(new ErrorHandler("Required fields are missing.", 400));
  }

  try {
    const user = await User.findOne({ 
      email, 
      verificationCode: otp,
      registrationSessionId // Must match
    });

    if (!user) {
      return next(new ErrorHandler("Invalid OTP or session.", 404));
    }

    const now = Date.now();
    if (now > new Date(user.verificationCodeExpire).getTime()) {
      return next(new ErrorHandler("OTP expired.", 400));
    }

    user.accountVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpire = null;
    user.isPwdAuth = true;
    user.registrationSessionId = null; // Clear after use

    if (user.tempPassword) {
      user.password = user.tempPassword;
      user.tempPassword = null;
      user.pwdSetupAttempts = { count: 0, lastAttempt: null };
    }

    await user.save({ validateModifiedOnly: true });
    res.clearCookie("email");

    sendToken(user, 200, "Account Verified.", res);
  } catch (error) {
    return next(new ErrorHandler("Internal server error.", 500));
  }
});

exports.login = catchAsyncErrors(async (req, res, next) => {
  const { email, password, role } = req.body;
  
  if (!email || !password) {
    return next(new ErrorHandler("Please enter all fields.", 400));
  }

  // Find user with email, verified account, and matching role
  const user = await User.findOne({ 
    email, 
    accountVerified: true,
    // role 
  }).select("+password");

  
if (!user) {
  return res.status(400).json({ success: false, message: "User not found. Please register first." });
}


  // if (user.isPwdAuth==false) {
  if (!user.isPwdAuth) {
    return next(new ErrorHandler("Use Google Sign-In to log in, or register with your email and password.", 400));
  }


  if (!user) return next(new ErrorHandler("Invalid email or password.", 400));

  const isPasswordMatched = await bcrypt.compare(password, user.password);


  if (!isPasswordMatched)
    return next(new ErrorHandler("Invalid email or password", 400));

  sendToken(user, 200, "User login successfully.", res);
});

async function verifyGoogleToken(token) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
  } catch (error) {
    console.error("Error verifying Google token:", error);
    throw error;
  }
}

exports.googleLogin = catchAsyncErrors(async (req, res, next) => {

  const { token, role } = req.body;
  console.log("Received token:", token); // In your backend route
  console.log("role from frontend provided to this googleLoginRoute:",role); 

  if (!token || !role) {
    return next(new ErrorHandler("either token or role is missing.", 400));
  }


  const googleUser = await verifyGoogleToken(token);


  const { name, email, picture, sub: googleId } = googleUser;
  console.log("Google User:", googleUser); // In your backend route

  let user = await User.findOne({ email });
  if (!user) {
    // Register new user
    user = await User.create({
      name,
      email,
      googleId,
      isPwdAuth: false,
      password: null, 
      profile_picture: {
        url: picture,
        public_id: null,
      },
      role,
      accountVerified: true,
    });
  } else {

    if (user.role!=role) {
      return next(new ErrorHandler("incorrect role.", 400));
    }
    if (!user.googleId) { 
      user.googleId = googleId;
      user.profile_picture = {
        url: picture,
        public_id: null,
      },
        await user.save();
    }
  }

  sendToken(user, 200, "Google Login successful", res);
});

exports.logout = catchAsyncErrors(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      // expires:new Date(Date.now()),
      expires: new Date(0), // Expire cookie immediately

      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully.",
    });

  

});

exports.getUser = catchAsyncErrors(async (req, res, next) => {
  const user = req.user; //full detail of user,from authMiddleware (findById(decoded_id));
  console.log(user);
  res.status(200).json({
    success: true,
    user,
  });
});

exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  if (!req.body.email) return next(new ErrorHandler("Email is required.", 400));

  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });


  if(!user.isPwdAuth) {
    return next(new ErrorHandler("Use Use Google Sign-In to log in, or register with your email and password.", 400));
  }

  if (!user) return next(new ErrorHandler("Invalid email.", 400));

  if (!user.forgotPasswordAttemptsExpire || user.forgotPasswordAttemptsExpire < Date.now()) {
    user.forgotPasswordAttempts = 0;
    user.forgotPasswordAttemptsExpire = Date.now() + 60 * 60 * 1000; // 1 hour expiry
  }

  if (user.forgotPasswordAttempts >= 3) {
    return next(new ErrorHandler("Too many reset requests. Try again after 1 hour.", 429));
  }

  user.forgotPasswordAttempts += 1;
  await user.save({ validateBeforeSave: false });



  const resetToken = user.getResetPasswordToken();


  await user.save({ validateBeforeSave: false });


  const resetPasswordUrl = `${process.env.FRONTEND_URL}/resetpassword?id=${resetToken}`; 


  const message = generateForgotPasswordEmailTemplate(resetPasswordUrl);

  try {
    await sendEmail({
      to: user.email,
      subject: "🔐 Reset Your gymsHood Password – Urgent Action Required!",
      message,
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully.`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler(error.message, 500));
    {
     
    }
  }
});

exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.params;
  if (!token) return next(new ErrorHandler("Reset token is required.", 400));

  const resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select("+password"); // 🔥 Ensure password is included


  if (!user) {
    return next(new ErrorHandler("Reset password token is invalid or expired.", 400));
  }

  const newPassword = String(req.body.password).trim();
  const confirmPassword = String(req.body.confirmPassword).trim();

  if (newPassword !== confirmPassword) {
    return next(new ErrorHandler("Password & confirm password don't match.", 400));
  }
  if (await bcrypt.compare(newPassword, user.password)) {
    return next(new ErrorHandler("New password must be different from the old password.", 400));
  }


  if (newPassword.length < 8 || newPassword.length > 16) {
    return next(new ErrorHandler("Password must be between 8 & 16 characters.", 400));
  }

  if (/^0+$/.test(newPassword)) {
    return next(new ErrorHandler("Password cannot be all zeros.", 400));
  }

  const invalidChars = newPassword.match(/[^a-zA-Z0-9!@#$%^&*]/);
  if (invalidChars) {
    return next(new ErrorHandler(`Invalid character(s) in password: ${invalidChars.join(", ")}`, 400));
  }

  // 🔥 Update password and invalidate all old JWTs
  user.password = await bcrypt.hash(newPassword, 10);
  user.tokenVersion += 1; // 🔥 Increments token version, invalidating old JWTs

  // Remove reset token and expiry date
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();
  sendToken(user, 200, "Password reset successfully. Please log in again.", res);
});

//reduce redundancy in code..by define bcrypt_Hash&Compare fxn in userModel itself as multiple times use

exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
  const { newPassword, confirmPassword } = req.body;

  // 1. Check if both fields are provided
  if (!newPassword || !confirmPassword) {
    return next(new ErrorHandler('Please provide both new password and confirmation', 400));
  }

  // 2. Verify password match
  if (newPassword !== confirmPassword) {
    return next(new ErrorHandler('Passwords do not match', 400));
  }

  if (/[^a-zA-Z0-9!@#$%^&*]/.test(newPassword)) {
    return next(new ErrorHandler("Invalid characters in password.", 400));
  }
  if (newPassword.length < 6 || newPassword.length > 15) {
    return next(new ErrorHandler("Password must be between 6 & 15 characters.", 400))
  };

  // if (/^0/.test(newPassword)) {
  //   return next(new ErrorHandler("Password cannot start with 0.", 400));
  // }

  // 3. Get user from request (added by auth middleware)
  const user = await User.findById(req.user.id).select('+password');;

  // 4. Optional: Check if new password is different from current
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    return next(new ErrorHandler('New password must be different from current password', 400));
  }

  // 5. Hash and update password
  user.password = await bcrypt.hash(newPassword, 10);

  // 6. Save user
  await user.save();

  // 7. Return success response
  res.status(200).json({
    success: true,
    message: 'Password updated successfully'
  });
});

// exports.updateUserLocation = catchAsyncErrors(async (req, res, next) => {
//   const userId = req.user._id;
//   const { address, coordinates } = req.body;

//   // Validation: coordinates must be an array of two numbers
//   if (!Array.isArray(coordinates) || coordinates.length !== 2 || 
//       typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
//     return next(new ErrorHandler('Coordinates must be [longitude, latitude]', 400));
//   }

//   const user = await User.findByIdAndUpdate(
//     userId,
//     {
//       // address,
//       // coordinates
//         location: {
//         address,
//         coordinates
//       }
//     },
//     { new: true, runValidators: true }
//   );
 
//   if (!user) {
//     return next(new ErrorHandler('User not found', 404));
//   }
//   // console.log("Updated user location:", user);

//   res.status(200).json({
//     success: true,
//     message: 'Location updated successfully',
//     // user: {
//     //   address: user.address,
//     //   coordinates: user.coordinates
//     // }
//     user: {
//       location: user.location
//     }
//   });
// });