/* START OF FILE models/Note.js */

const mongoose = require("mongoose");
const noteSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: String,
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("Note", noteSchema);

/* END OF FILE models/Note.js */
