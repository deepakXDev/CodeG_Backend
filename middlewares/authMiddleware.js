const User = require("../models/User");
const { catchAsyncErrors } = require("./catchAsyncErrors");
const ErrorHandler = require("./errorMiddleware");
const jwt = require("jsonwebtoken");

exports.isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.cookies;
  const authHeader = req.headers.authorization;
  if (!token && !authHeader)
    return next(new ErrorHandler("User is not authenticated.", 400));
  let decoded = null;
  if (!authHeader) {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } else {
    decoded = jwt.verify(authHeader, process.env.JWT_SECRET_KEY);
  }
  req.user = await User.findById(decoded.id);

  next();
});

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

    next();
  };
};

exports.isAdmin = exports.requireRole("Admin"); //as requireRole not define (as directly exported);
exports.isAdminOrProblem_Setter = exports.requireRole(
  "Problem_Setter",
  "Admin"
);

exports.isOwnerOrAdmin = (Model, userIdField = "userId", from = "params") => {
  return async (req, res, next) => {
    try {
      if (req.user.role === "Admin") return next();

      let resourceUserId;

      if (Model) {
        const id = req.params.id || req.body.id;
        const resource = await Model.findById(id);
        if (!resource) return next(new ErrorHandler("Resource not found", 404));
        resourceUserId = resource[userIdField]?.toString();
      } else {
        resourceUserId = req[from][userIdField]?.toString();
      }

      if (resourceUserId !== req.user._id.toString()) {
        return next(new ErrorHandler("Not authorized", 403));
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
