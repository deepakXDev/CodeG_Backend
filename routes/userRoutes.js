const express = require("express");
const {
  getUserProfile,
  getUserActivity,
  getAuthenticatedUserProfile,
  updateUserProfile,
} = require("../controllers/userController");
const {
  isAuthenticated,
  // isAdmin
  isOwnerOrAdmin,
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.route('/me')
  .get(isAuthenticated, getAuthenticatedUserProfile)
  .put(isAuthenticated,updateUserProfile);

// Public profile
router.get("/:userId/profile", getUserProfile)
      

// Private activity data
router.get(
  "/:userId/activity",
  isAuthenticated,
  isOwnerOrAdmin(null, "userId", "params"),
  // isAdmin,
  getUserActivity
);

module.exports = router;
