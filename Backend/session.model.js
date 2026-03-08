const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
    userId: String,
    currentRisk: String,
    lastScore: Number,
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    isActive:{
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model("Session",SessionSchema);