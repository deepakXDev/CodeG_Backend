import {app} from "./app.js" 

// Start server
// const PORT = 3000;
const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`)
});
