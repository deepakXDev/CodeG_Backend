exports.sendToken=(user,statusCode, message, res)=>{
    const token=user.generateToken();//generate token for 3days, jwt_expire=3d;

    res.status(statusCode)
    .cookie("token",token,{
        expires: new Date(
            Date.now()+process.env.COOKIE_EXPIRE*24*60*60*1000),//for 24Hrs*3==>3days
        httpOnly:true,
    })
    .json({
        success:true,
        user,
        message,
    })
}