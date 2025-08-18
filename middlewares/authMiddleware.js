// import BlacklistToken from "../models/blacklistToken.model.js";
const User = require("../models/User");
const { catchAsyncErrors } = require("./catchAsyncErrors");
const ErrorHandler = require("./errorMiddleware");
const jwt = require("jsonwebtoken");


exports.isAuthenticated=catchAsyncErrors(async(req,res,next)=>{
    const {token}=req.cookies; 
    const authHeader = req.headers.authorization;
    if(!token && !authHeader) return next(new ErrorHandler("User is not authenticated.",400));
    let decoded=null;
    if(!authHeader) {decoded=jwt.verify(token,process.env.JWT_SECRET_KEY);}
    else {decoded=jwt.verify(authHeader,process.env.JWT_SECRET_KEY);}
  
    req.user=await User.findById(decoded.id); 
    next(); 
}) 

// Generic role-based authorization middleware
exports.requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return next(
                new ErrorHandler(
                    `Role ${req.user.role} is not authorized to access this resource.`, 
                    403
                )
            );
        }
        //if no error, then this next()-->execute, otherwise if block-->return next(function)
        next();
    };
};

// Specific role middlewares (for better readability in routes)

// export const isAdmin = isAuthorized('SuperAdmin', 'RegionalAdmin', 'SupportAdmin');
// export const isAdmin = requireRole('Admin');

exports.isAdmin = exports.requireRole('Admin'); //as requireRole not define (as directly exported);
exports.isAdminOrProblem_Setter = exports.requireRole('Problem_Setter','Admin');
// //M2:
// exports.requireRole = requireRole;
// exports.isAdmin = requireRole('Admin');

// isOwnerOrAdmin(...): Checks if user owns the resource OR is an admin

// isOwnerOrAdmin(Submission, 'userId'),  // from req.params.id → Submission → submission.userId
// submission.userId === req.user._id → user owns it or, OR req.user.role === 'Admin' (or similar) → user is admin
// isOwnerOrAdmin(null, 'userId', 'params') : Just directly compares: req.params.userId === req.user._id OR user is admin

//Model-->It’s passed as a parameter when the middleware is initialized in your route:
exports.isOwnerOrAdmin = (Model, userIdField = 'userId', from = 'params') => {
  //function returns a middleware.. not middleware in self*****
  return async (req, res, next) => {
    try {
      // Admins can access everything
      if (req.user.role === 'Admin') return next();

      let resourceUserId;

      if (Model) {
        // Case: Fetch resource from DB
        const id = req.params.id || req.body.id;
        const resource = await Model.findById(id);
        if (!resource) return next(new ErrorHandler('Resource not found', 404));
        resourceUserId = resource[userIdField]?.toString();
        //This is called dynamic property access (also known as bracket notation) in JavaScript.
      } else {
        // Case: No DB query, just use req.params or req.body
        //from && userIdField --> guide where to look in req (in params) && there you get userId-->key..
        resourceUserId = req[from][userIdField]?.toString(); //req.from.userIdField (ie req.params.userId) //works->when know both name statically.. (not when dynamic)
        // Statically means hardcoded and fixed in your code, not from a variable.
        
      }

      // Check if the current user is the owner
      if (resourceUserId !== req.user._id.toString()) {
        return next(new ErrorHandler('Not authorized', 403));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

/*
    1. req.params.userId  // Only works if you know both names statically
    2. req[from][userIdField] // Works when names are dynamic (passed as args)
    3. Mongoose ObjectIds are objects==>You usually convert them to strings before comparison.
    4. ?. (optional chaining)	//Prevents errors if property is undefined
*/






// Composite middlewares for common scenarios
// export const isVerifiedUser = requireRole('Member', 'Trainer', 'Staff', 'GymOwner', 'Admin');

// Optional: Middleware to check if user has active plan for gym-specific actions
// export const hasActivePlan = catchAsyncErrors(async (req, res, next) => {
//     const gymId = req.params.gymId || req.body.gymId;
//     const userId = req.user._id;

//     if (!gymId) {
//         return next(new ErrorHandler("Gym ID not provided", 400));
//     }

//     const activePlan = await UserPlan.findOne({
//         userId,
//         gymId,
//         isExpired: false
//     });

//     if (!activePlan) {
//         return next(new ErrorHandler("You need an active plan to perform this action", 403));
//     }

//     req.activePlan = activePlan; // Attach plan to request for later use
//     next();
// });