const mongoose = require("mongoose");
const fileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fileName: String,
  s3Key: String,
  fileUrl: String,
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("File", fileSchema);
