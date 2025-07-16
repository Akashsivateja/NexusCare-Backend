/* START OF FILE models/Prescription.js */

const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  medications: { type: String, required: true }, // Multiline text for medications
  instructions: { type: String, required: true }, // Multiline text for instructions
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Prescription", prescriptionSchema);
