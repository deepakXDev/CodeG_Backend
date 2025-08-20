const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuid } = require("uuid");

const folders = ["uploads/source", "uploads/input", "uploads/output"];
folders.forEach((folder) => {
  const absPath = path.join(__dirname, "..", folder);

  if (!fs.existsSync(absPath)) fs.mkdirSync(absPath, { recursive: true });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest =
      file.fieldname === "sourceCode" ? "uploads/source" : "uploads/input";
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuid()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

module.exports = upload;
