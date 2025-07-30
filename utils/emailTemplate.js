exports.generateVerificationOtpEmailTemplate=(otpCode)=>{
  return `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #ffffff; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
    <img src="https://your-codeg-logo-url.com/logo.png" alt="CodeG Logo" style="max-width: 100px; margin-bottom: 10px;">

    <h2 style="color: #1e1e2f;">Welcome to <span style="color: #2ecc71;">CodeG</span>!</h2>

    <p style="font-size: 16px; color: #555;">Use the OTP below to verify your email and complete your <strong>CodeG</strong> account registration:</p>

    <div style="font-size: 24px; font-weight: bold; color: #2ecc71; padding: 10px; border: 2px dashed #2ecc71; display: inline-block; margin: 10px 0;">
      ${otpCode}
    </div>

    <p style="font-size: 14px; color: #666;">This OTP is valid for a limited time. Please do not share it with anyone.</p>
    <p style="font-size: 14px; color: #999;">If you did not request this, you can safely ignore this email.</p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

    <p style="font-size: 14px; font-weight: bold; color: #333;">Keep Coding. Keep Growing.</p>
    <p style="font-size: 14px; color: #555;">– The CodeG Team</p>

    <p style="font-size: 12px; color: #999;">Follow us on 
      <a href="https://instagram.com/codeg_official" style="color: #2ecc71; text-decoration: none;">Instagram</a> | 
      <a href="https://twitter.com/codeg_judge" style="color: #2ecc71; text-decoration: none;">Twitter</a>
    </p>
  </div>`;
}



// export function generateForgotPasswordEmailTemplate(resetPasswordUrl) {
exports.generateForgotPasswordEmailTemplate=(resetPasswordUrl)=> {
  return `<div style="
    font-family: Arial, sans-serif; 
    max-width: 600px; 
    margin: auto; 
    padding: 20px; 
    border: 1px solid #ddd; 
    border-radius: 8px;
    background-color: #ffffff;
    text-align: center;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  ">
    <img src="https://your-codeg-logo-url.com/logo.png" alt="CodeG Logo" style="max-width: 100px; margin-bottom: 15px;">
    
    <h2 style="color: #1e1e2f;">🔐 Reset Your CodeG Password</h2>
    
    <p style="font-size: 16px; color: #555;">
        We received a request to reset your password for your <strong>CodeG</strong> account.
        Click the button below to create a new password and regain access to your coding dashboard.
    </p>
    
    <div style="margin: 20px 0;">
        <a href="${resetPasswordUrl}" style="
            display: inline-block;
            padding: 12px 24px;
            font-size: 16px;
            font-weight: bold;
            color: #ffffff;
            background-color: #2ecc71;
            text-decoration: none;
            border-radius: 6px;
        ">Reset Password</a>
    </div>
    
    <p style="font-size: 14px; color: #777;">
        Didn’t request this? Just ignore this message. The link will expire in <strong>15 minutes</strong> for your security.
    </p>
    
    <hr style="border: none; height: 1px; background-color: #ddd; margin: 20px 0;">
    
    <p style="font-size: 12px; color: #aaa;">
        &copy; ${new Date().getFullYear()} <strong>CodeG</strong>. All rights reserved.
    </p>
    
    <p style="font-size: 12px; color: #999;">
        Need help? <a href="mailto:support@codeg.com" style="color: #2ecc71; text-decoration: none;">Contact Support</a>
    </p>
  </div>`;
}

