const mongoose = require("mongoose");
const recordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  bp: String,
  sugar: String,
  heartRate: String,
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("Record", recordSchema);
