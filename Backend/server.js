const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const geoip = require("geoip-lite");

const Log = require("./log.model");


const app = express();


app.use(express.json());



mongoose.connect("mongodb://127.0.0.1:27017/vaultID")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));



app.post("/login", async (req, res) => {
  try {
    const { userId } = req.body;

    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const device = req.headers["user-agent"];

    // -----------------------------
    // GeoIP
    // -----------------------------
    const geo = geoip.lookup(ip);

    let country = "LOCAL";
    let region = "LOCAL";
    let city = "LOCAL";

    if (geo) {
      country = geo.country;
      region = geo.region;
      city = geo.city;
    }

    const now = Date.now();

    // -----------------------------
    // Last log
    // -----------------------------
    const lastLog = await Log.findOne({ userId }).sort({ timestamp: -1 });

    let timeGap = 0;
    let ipChange = 0;
    let deviceChange = 0;
    let locationChange = 0;

    if (lastLog) {
      timeGap = (now - lastLog.timestamp.getTime()) / 1000;
      ipChange = lastLog.ip !== ip ? 1 : 0;
      deviceChange = lastLog.device !== device ? 1 : 0;
      locationChange = lastLog.country !== country ? 1 : 0;
    }

    // -----------------------------
    // Sequence build
    // -----------------------------
    const SEQ_LEN = 5;
    const logs = await Log.find({ userId }).sort({ timestamp: 1 });

    let anomalyScore = 0;
    let riskLevel = "LOW";
    let actionTaken = "ALLOW";

    if (logs.length >= SEQ_LEN) {
      const features = logs.map(l => [
        l.timeGap,
        l.ipChange,
        l.deviceChange,
        l.locationChange
      ]);

      const latestSequence = features.slice(-SEQ_LEN);

      const mlRes = await axios.post(
        "http://127.0.0.1:5000/predict",
        { sequence: latestSequence }
      );

      anomalyScore = mlRes.data.anomaly_score;

      if (anomalyScore < 0.3) {
        riskLevel = "LOW";
        actionTaken = "ALLOW";
      }
      else if (anomalyScore < 0.6) {
        riskLevel = "MEDIUM";
        actionTaken = "VERIFY";
      }
      else {
        riskLevel = "HIGH";
        actionTaken = "BLOCK";
      }
    }

    // -----------------------------
    // SAVE
    // -----------------------------
    await Log.create({
      userId,
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

    res.json({
      anomalyScore,
      riskLevel,
      actionTaken
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});



app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
