//express, config, cookieParser, cors, connectDB, errorMiddleware && Router..
const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ path: "./config/config.env" }); //const {config}=require('dotenv');
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { errorMiddleware } = require("./middlewares/errorMiddleware"); //.json,.ts..then mention extension..
const connectDB = require("./database/db");

const authRouter = require("./routes/authRoutes"); //.js when import authRouter from "./....js"
const problemRouter = require("./routes/problemRoutes");
const userRouter = require("./routes/userRoutes");
const submissionRouter = require("./routes/submissionRoutes");

const app = express();
// module.exports={app};
module.exports = app;
// exports.app=express(); //if direct export, then app.use..not work-->as app not defined.. && if want
// then ==> exports.app.use(..);

// has double colons ::. Fix it: "http::/127.0.0.1:5500"
const corsOptions = {
  origin: "http://localhost:5173", //true,//['http://localhost:3000','http::/127.0.0.1:5500','http://localhost:3000/googleAuth','https://codeG.vercel.app',],
  methods: ["GET", "POST", "PUT", "DELETE"], //typo->method in place of methods
  credentials: true,
};
// Your backend must also allow credentials and proper CORS headers:
// When withCredentials is true, you cannot use Access-Control-Allow-Origin: * in the backend.
// Browsers block it because allowing credentials from any origin is unsafe.
// 👉 Postman is not restricted by CORS at all.
// undefined // <-- allow Postman (no origin header) (if added in list of origin)
// CORS is a browser-side security feature. So Postman does not trigger CORS errors.

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); //for parsing form data

// console.log(typeof authRouter); // should be 'function'
app.use("/auth", authRouter);
app.use("/problems", problemRouter);
app.use("/user", userRouter);
app.use("/submission", submissionRouter);

// Error_reading:
// at Object.<anonymous> (D:\! 0.WebD\onlineJudge\backend\app.js:47:5) ==> Check line 47 in app.js:

app.get("/ping", (req, res) => {
  console.log("Ping hit!");
  const user = req.query.name || "Guest";
  res.json({ message: `Pong, ${user}` });
});

//DB-->take time to connect, if "replica" && it not setup-->in that time..if any request hit..Then crash && wrongResponse...***
//connectDB before all  && then online start the app.use()..full safety && in catch-->throw error->db not connected
//so server not fails, if DB take time to connect** (otherwise server crashes..need to restart with npm run dev)
connectDB(); //Connection error:  MongoRuntimeError: Unable to parse localhost:27017; with URL

// app.use(errorMiddleware()); // ❌ wrong — you're calling the function
// if any error->then this send final response to server without failing the server..(its keep running)
app.use(errorMiddleware); //💡 app.use() expects a middleware function, not the result of a function call.

// module.exports={app};
