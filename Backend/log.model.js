const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
    userId: String,
    action: String,

    // --------------------------
    // Raw environment info
    // --------------------------
    ip: String,
    device: String,
    country: String,
    region: String,
    city: String,

    timestamp: {
        type: Date,
        default: Date.now
    },

    // --------------------------
    // Behavioral features (ML input)
    // --------------------------
    timeGap: Number,
    ipChange: Number,
    deviceChange: Number,
    locationChange: Number,

    // ==========================
    // 🔥 NEW — AI Decision Fields
    // ==========================
    anomalyScore: Number,          // raw ML probability
    riskLevel: String,             // LOW / MEDIUM / HIGH
    actionTaken: String            // ALLOW / VERIFY / BLOCK
});

module.exports = mongoose.model("Log", LogSchema);
