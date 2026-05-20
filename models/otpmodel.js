const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  otp: String,

  expiresAt: Date,
});

module.exports = mongoose.model("Otp", otpSchema);