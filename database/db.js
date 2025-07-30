const mongoose=require('mongoose');

// export const connectDb=
const connectDb=async()=>{
    try{
        await mongoose.connect(process.env.MONGO_URI,{
            dbName:"Online_Judge",
        })
        console.log("mongodB connected");
    }catch(err){
        console.log("Connection error: ",err);
        process.exit(1);
    }
};

module.exports=connectDb;