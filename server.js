// const {app} = require("./app");
const app=require("./app");

const func=()=>{
    console.log(`Server is running on port ${process.env.PORT}`)
}

// console.log(app);
app.listen(process.env.PORT,func);




// npm init -y
// npm i express
// npm i -D nodemon
// node src/index.js
// npx nodemon src/index.js
// npm run dev (if updated package.json)
