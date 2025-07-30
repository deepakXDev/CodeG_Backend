class ErrorHandler extends Error{
    constructor(message,statusCode){
        super(message);
        this.statusCode=statusCode;
    }
}

const errorMiddleware=(err,req,res,next)=>{
    err.message=err.message||"Internal Server Error";
    err.statusCode=err.statusCode|| 500;

    if(err.code===11000){
        const statusCode=400;
        const message="Duplicate Field value entered";
        err=new ErrorHandler(message,statusCode);
    }

    if(err.name==="JsonWebTokenError"){
        const statusCode=400;
        const message="Json web Token is invalid. Try again.";
        err=new ErrorHandler(message,statusCode);
    }

    if(err.name==="TokenExpiredError"){
        const statusCode=400;
        const message="Json web Token is expired. Try again.";
        err=new ErrorHandler(message,statusCode);
    }

    if(err.name==="CastError"){
        const statusCode=400;
        const message=`Resource not found. Invalid: ${err.path}`;
        err=new ErrorHandler(message,statusCode);
    }

    const errorMessage=err.errors?
    Object.values(err.errors).map((error)=>error.message).join(" "):err.message; 
    return res.status(err.statusCode).json({
        success:false,
        message: errorMessage,
    });
}

// export default ErrorHandler; //both class && function exported..
// module.exports={errorMiddleware}; 
// module.exports=ErrorHandler;// // This overwrites the previous export

// Export ErrorHandler as default
module.exports = ErrorHandler;
// Export errorMiddleware as named export
module.exports.errorMiddleware = errorMiddleware;

// const ErrorHandler = require("./middlewares/errorMiddleware"); // Default import
// const { errorMiddleware } = require("./middlewares/errorMiddleware"); // Named import