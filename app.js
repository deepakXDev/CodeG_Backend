// const express = require('express');
import express from "express"; 

// require('dotenv').config();
// require('dotenv').config({ path: './config/config.env' });
import {config} from "dotenv"; config({path:"./config/config.env"});

import cookieParser from "cookie-parser";
import cors from "cors";
// import { connectDB } from "./database/db.js"; 
// import { errorMiddleware } from "./middlewares/errorMiddlewares.js";
// import authRouter from "./routes/authRouter.js"
import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const app = express(); //export, if use in server.js to start server..
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'https://gyms-hood.vercel.app', 'http://localhost:3000', 'http://localhost:3000/googleAuth',],
        method:["GET","POST","PUT","DELETE"],
    credentials: true
}));


// Middleware to parse JSON
app.use(express.json());

app.use(cookieParser());
app.use(express.urlencoded({ extended: true })); // for parsing form data


// // Simple route
// app.get('/', (req, res) => {
//   res.send('Hello, Node backend!');
// });
// app.get("/ping", (req, res) => {
//   console.log("Ping hit!");
//   const user = req.query.name || "Guest";
//   res.json({ message: `Pong, ${user}` });
// });

// app.use("/auth",authRouter); //staticUri



// connectDB();
// app.use(errorMiddleware); 


