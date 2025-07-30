const {generateVerificationOtpEmailTemplate} = require("./emailTemplate");
const {sendEmail}=require("./sendEmail.js");


// export async function sendVerificationCode(verificationCode, to, res, registrationSessionId) {
exports.sendVerificationCode=async(verificationCode, to, res, registrationSessionId)=>{
    try {
        const message = generateVerificationOtpEmailTemplate(verificationCode); 
        
        await sendEmail({
            to,
            subject: "Verification Code (CodeG registration)",
            message,
        });

        // Set both cookie and return session ID in response
        res.status(200)
            .cookie("email", to, { 
                httpOnly: true, 
                maxAge: 4 * 60 * 1000, // 4 mins expiry
                secure: process.env.NODE_ENV === 'production', // Secure in production
                sameSite: 'strict' // Prevent CSRF
            })
            .cookie("reg_session", registrationSessionId, {
                httpOnly: true,
                maxAge: 4 * 60 * 1000, // Same 4 mins expiry as OTP
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            })
            .json({ 
                success: true, 
                message: "OTP sent to email",
                registrationSessionId // Also send in response for clients that can't use cookies
            });

    } catch(error) {
        return res.status(500).json({
            success: false,
            message: "Verification code failed to send.",
        });
    }
}