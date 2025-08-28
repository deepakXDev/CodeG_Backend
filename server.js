const app = require("./app");

const func = () => {
  console.log(`Server is running on port ${process.env.PORT}`);
};

app.listen(process.env.PORT,'0.0.0.0', func);
