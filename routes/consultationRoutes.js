/* START OF FILE routes/consultationRoutes.js */

const express = require("express");
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");
const router = express.Router();

// Middleware to ensure user is authenticated for all routes in this file
router.use(auth);

// ✅ Patient searches for doctors
router.get("/search-doctors", async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Search query is required." });
  }
  try {
    // Find doctors whose name or specialty matches the query (case-insensitive)
    const doctors = await User.find({
      role: "doctor",
      $or: [
        { name: { $regex: query, $options: "i" } },
        { specialty: { $regex: query, $options: "i" } },
      ],
    }).select("name email specialty");

    // Enhance doctors list with consultation status for the requesting patient
    const patient = await User.findById(req.user.userId);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    const enhancedDoctors = doctors.map((doctor) => ({
      _id: doctor._id,
      name: doctor.name,
      email: doctor.email,
      specialty: doctor.specialty,
      isConsulted: patient.consultedDoctors.includes(doctor._id),
      isPending: patient.pendingConsultations.includes(doctor._id),
    }));

    res.json(enhancedDoctors);
  } catch (error) {
    console.error("Error searching doctors:", error);
    res.status(500).json({ error: "Failed to search doctors." });
  }
});

// ✅ Patient requests consultation with a doctor
router.post("/request/:doctorId", async (req, res) => {
  if (req.user.role !== "patient") {
    return res
      .status(403)
      .json({ error: "Only patients can request consultations." });
  }
  const { doctorId } = req.params;

  try {
    const patient = await User.findById(req.user.userId);
    const doctor = await User.findById(doctorId);

    if (!patient || !doctor || doctor.role !== "doctor") {
      return res.status(404).json({ error: "Patient or Doctor not found." });
    }

    // Check if already consulted
    if (patient.consultedDoctors.includes(doctorId)) {
      return res
        .status(400)
        .json({ error: "You are already consulting this doctor." });
    }
    // Check if request is already pending
    if (patient.pendingConsultations.includes(doctorId)) {
      return res
        .status(400)
        .json({ error: "Consultation request already pending." });
    }
    if (doctor.pendingConsultations.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ error: "Consultation request already pending for doctor." });
    }

    // Add patient to doctor's pending consultations
    doctor.pendingConsultations.push(patient._id);
    await doctor.save();

    // Add doctor to patient's pending requests
    patient.pendingConsultations.push(doctor._id);
    await patient.save();

    res.status(200).json({ message: "Consultation request sent to doctor." });
  } catch (error) {
    console.error("Error requesting consultation:", error);
    res.status(500).json({ error: "Failed to send consultation request." });
  }
});

// ✅ Doctor gets pending consultation requests
router.get("/pending", async (req, res) => {
  if (req.user.role !== "doctor") {
    return res
      .status(403)
      .json({ error: "Only doctors can view pending requests." });
  }

  try {
    const doctor = await User.findById(req.user.userId).populate(
      "pendingConsultations",
      "name email"
    );
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found." });
    }
    res.json(doctor.pendingConsultations);
  } catch (error) {
    console.error("Error fetching pending consultations:", error);
    res.status(500).json({ error: "Failed to fetch pending consultations." });
  }
});

// ✅ Doctor responds to a consultation request (accept/reject)
router.post("/respond/:patientId", async (req, res) => {
  if (req.user.role !== "doctor") {
    return res
      .status(403)
      .json({ error: "Only doctors can respond to consultations." });
  }
  const { patientId } = req.params;
  const { action } = req.body; // 'accept' or 'reject'

  try {
    const doctor = await User.findById(req.user.userId);
    const patient = await User.findById(patientId);

    if (!doctor || !patient) {
      return res.status(404).json({ error: "Doctor or Patient not found." });
    }

    // Remove patient from doctor's pending consultations
    doctor.pendingConsultations = doctor.pendingConsultations.filter(
      (id) => id.toString() !== patientId
    );
    // Remove doctor from patient's pending requests
    patient.pendingConsultations = patient.pendingConsultations.filter(
      (id) => id.toString() !== req.user.userId
    );

    if (action === "accept") {
      // Add patient to doctor's consulted patients if not already there
      if (!doctor.consultedPatients.includes(patientId)) {
        doctor.consultedPatients.push(patientId);
      }
      // Add doctor to patient's consulted doctors if not already there
      if (!patient.consultedDoctors.includes(req.user.userId)) {
        patient.consultedDoctors.push(req.user.userId);
      }
      await doctor.save();
      await patient.save();
      res.status(200).json({ message: "Consultation accepted." });
    } else if (action === "reject") {
      await doctor.save();
      await patient.save();
      res.status(200).json({ message: "Consultation rejected." });
    } else {
      res.status(400).json({ error: "Invalid action." });
    }
  } catch (error) {
    console.error("Error responding to consultation:", error);
    res.status(500).json({ error: "Failed to respond to consultation." });
  }
});

// ✅ Patient views their consulted doctors
router.get("/my-doctors", async (req, res) => {
  if (req.user.role !== "patient") {
    return res
      .status(403)
      .json({ error: "Only patients can view their doctors." });
  }
  try {
    const patient = await User.findById(req.user.userId).populate(
      "consultedDoctors",
      "name email specialty"
    );
    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }
    res.json(patient.consultedDoctors);
  } catch (error) {
    console.error("Error fetching patient's doctors:", error);
    res.status(500).json({ error: "Failed to fetch your doctors." });
  }
});

module.exports = router;

/* END OF FILE routes/consultationRoutes.js */
