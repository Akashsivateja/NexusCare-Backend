/* START OF FILE models/User.js */

const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["patient", "doctor"], default: "patient" },
  specialty: {
    type: String,
    required: function () {
      return this.role === "doctor";
    },
  }, // Doctors can have a specialty
  // New fields for consultations
  consultedDoctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // For patients: doctors they are consulting
  consultedPatients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // For doctors: patients they are consulting
  pendingConsultations: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // For doctors: patients who requested consultation
});
module.exports = mongoose.model("User", userSchema);

/* END OF FILE models/User.js */
