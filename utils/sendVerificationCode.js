const { generateVerificationOtpEmailTemplate } = require("./emailTemplate");
const { sendEmail } = require("./sendEmail.js");

exports.sendVerificationCode = async (
  verificationCode,
  to,
  res,
  registrationSessionId
) => {
  try {
    const message = generateVerificationOtpEmailTemplate(verificationCode);

    await sendEmail({
      to,
      subject: "Verification Code (CodeG registration)",
      message,
    });

    res
      .status(200)
      .cookie("email", to, {
        httpOnly: true,
        maxAge: 4 * 60 * 1000, // 4 mins expiry
        secure: process.env.NODE_ENV === "production", // Secure in production
      })
      .cookie("reg_session", registrationSessionId, {
        httpOnly: true,
        maxAge: 4 * 60 * 1000, // Same 4 mins expiry as OTP
        secure: process.env.NODE_ENV === "production",
      })
      .json({
        success: true,
        message: "OTP sent to email",
        registrationSessionId, // Also send in response for clients that can't use cookies
      });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Verification code failed to send.",
    });
  }
};
