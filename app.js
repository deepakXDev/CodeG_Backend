const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ path: "./config/config.env" }); 
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { errorMiddleware } = require("./middlewares/errorMiddleware"); 
const connectDB = require("./database/db");
const fileUpload = require('express-fileupload');

const authRouter = require("./routes/authRoutes"); 
const problemRouter = require("./routes/problemRoutes");
const userRouter = require("./routes/userRoutes");
const submissionRouter = require("./routes/submissionRoutes");

const app = express();
module.exports = app;

const corsOptions = {
  origin: ["http://localhost:5173", "https://code-g-frontend-nine.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE"], 
  credentials: true,
};

// 👉 Postman is not restricted by CORS at all.
// CORS is a browser-side security feature. So Postman does not trigger CORS errors.

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); //for parsing form data
app.use(fileUpload({ useTempFiles: true }));

app.use("/auth", authRouter);
app.use("/problems", problemRouter);
app.use("/users", userRouter);
app.use("/submission", submissionRouter);


app.get("/ping", (req, res) => {
  console.log("Ping hit!");
  const user = req.query.name || "Guest";
  res.json({ message: `Pong, ${user}` });
});


connectDB(); 

app.use(errorMiddleware); 


