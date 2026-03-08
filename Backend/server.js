// ======================================
// Imports
// ======================================
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const geoip = require("geoip-lite");

const Log = require("./log.model");
const Session = require("./session.model");

// ======================================
// App Setup
// ======================================
const app = express();
app.use(express.json());

const PORT = 3000;

// ======================================
// MongoDB Connection
// ======================================
mongoose.connect("mongodb://127.0.0.1:27017/vaultID")
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));


// ======================================
// Helper: Log User Action
// ======================================
const logUserAction = async (userId, action, req)=>{

 const ip =
 req.headers["x-forwarded-for"] ||
 req.socket.remoteAddress ||
 "127.0.0.1";

 const device = req.headers["user-agent"];

 const geo = geoip.lookup(ip);

 let country="LOCAL";
 let region="LOCAL";
 let city="LOCAL";

 if(geo){
   country = geo.country;
   region = geo.region;
   city = geo.city;
 }

 await Log.create({
   userId,
   action,
   ip,
   device,
   country,
   region,
   city
 });

};


// ======================================
// Risk Check Middleware
// ======================================
const riskCheckMiddleware = async (req,res,next)=>{

 try{

   const {userId} = req.body;

   const session = await Session.findOne({userId});

   if(!session){
     return res.status(403).json({
       message:"No active session"
     });
   }

   if(!session.isActive){
     return res.status(403).json({
       message:"Session revoked due to risk"
     });
   }

   if(session.currentRisk==="HIGH"){

     session.isActive=false;
     await session.save();

     return res.status(403).json({
       message:"Access blocked due to high risk"
     });

   }

   next();

 }
 catch(error){

   console.error(error);

   res.status(500).json({
     message:"Risk check failed"
   });

 }

};


// ======================================
// LOGIN RISK EVALUATION
// ======================================
app.post("/login-risk", async(req,res)=>{

 try{

   const {userId} = req.body;

   const ip =
   req.headers["x-forwarded-for"] ||
   req.socket.remoteAddress ||
   "127.0.0.1";

   const device = req.headers["user-agent"];

   const geo = geoip.lookup(ip);

   let country="LOCAL";
   let region="LOCAL";
   let city="LOCAL";

   if(geo){
     country=geo.country;
     region=geo.region;
     city=geo.city;
   }

   const now = Date.now();

   // ==========================
   // Get last login
   // ==========================
   const lastLog = await Log.findOne({userId})
   .sort({timestamp:-1});

   let timeGap=0;
   let ipChange=0;
   let deviceChange=0;
   let locationChange=0;

   if(lastLog){

     timeGap =
     (now - lastLog.timestamp.getTime())/1000;

     ipChange =
     lastLog.ip !== ip ? 1 : 0;

     deviceChange =
     lastLog.device !== device ? 1 : 0;

     locationChange =
     lastLog.country !== country ? 1 : 0;

   }

   // ==========================
   // Sequence generation
   // ==========================
   const SEQ_LEN = 5;

   const logs = await Log.find({userId})
   .sort({timestamp:1});

   let anomalyScore=0;
   let riskLevel="LOW";
   let actionTaken="ALLOW";

   if(logs.length >= SEQ_LEN){

     const features = logs.map(l=>[
       l.timeGap,
       l.ipChange,
       l.deviceChange,
       l.locationChange
     ]);

     const latestSequence =
     features.slice(-SEQ_LEN);

     const mlResponse = await axios.post(
     "http://127.0.0.1:5000/predict",
     {sequence:latestSequence}
     );

     anomalyScore =
     mlResponse.data.anomaly_score;

     if(anomalyScore < 0.3){

       riskLevel="LOW";
       actionTaken="ALLOW";

     }
     else if(anomalyScore < 0.6){

       riskLevel="MEDIUM";
       actionTaken="VERIFY";

     }
     else{

       riskLevel="HIGH";
       actionTaken="BLOCK";

     }

   }

   // ==========================
   // Save login log
   // ==========================
   await Log.create({

     userId,
     action:"login",
     ip,
     device,
     country,
     region,
     city,
     timeGap,
     ipChange,
     deviceChange,
     locationChange,
     anomalyScore,
     riskLevel,
     actionTaken

   });

   // ==========================
   // Update Session
   // ==========================
   await Session.findOneAndUpdate(

     {userId},

     {
       currentRisk:riskLevel,
       lastScore:anomalyScore,
       lastUpdated:Date.now(),
       isActive: actionTaken !== "BLOCK"
     },

     {upsert:true}

   );

   res.json({

     anomalyScore,
     riskLevel,
     actionTaken

   });

 }
 catch(error){

   console.error(error);

   res.status(500).json({
     message:"Risk evaluation failed"
   });

 }

});


// ======================================
// Protected Route Example
// ======================================
app.post("/dashboard",
riskCheckMiddleware,
async(req,res)=>{

 const {userId} = req.body;

 await logUserAction(
 userId,
 "dashboard_access",
 req
 );

 res.json({
   message:"Dashboard opened"
 });

});


// ======================================
// Check Session Status (For Auth Service)
// ======================================
app.get("/session-status/:userId", async(req,res)=>{

 const session =
 await Session.findOne({userId:req.params.userId});

 if(!session){

   return res.json({
     sessionActive:false
   });

 }

 res.json({
   sessionActive:session.isActive,
   riskLevel:session.currentRisk
 });

});


// ======================================
// Start Server
// ======================================
app.listen(PORT, ()=>{

 console.log(
 `VaultID Risk Engine running on port ${PORT}`
 );

});