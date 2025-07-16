/* START OF FILE routes/doctorRoutes.js */

const express = require("express");
const AWS = require("aws-sdk"); // For S3 summary, though not directly used for summary generation here
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");
const Record = require("../models/Record");
const File = require("../models/File");
const Note = require("../models/Note");
const Prescription = require("../models/Prescription"); // New: Prescription model
const router = express.Router();

// --- Middleware to ensure only doctors can access these routes ---
router.use(auth); // Apply general authentication first
router.use((req, res, next) => {
  if (req.user.role !== "doctor") {
    return res.status(403).json({ error: "Access denied. Doctors only." });
  }
  next();
});

// --- Helper function to check if a doctor is consulting a patient ---
async function isDoctorConsultingPatient(doctorId, patientId) {
  const doctor = await User.findById(doctorId);
  return doctor && doctor.consultedPatients.includes(patientId);
}

// ✅ Doctor gets a list of their consulted patients
router.get("/my-patients", async (req, res) => {
  const { search } = req.query;
  try {
    const doctor = await User.findById(req.user.userId).select(
      "consultedPatients"
    );
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found." });
    }

    let query = { _id: { $in: doctor.consultedPatients } };

    if (search) {
      // Add search criteria for name or email
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const patients = await User.find(query).select("-password -__v");
    res.json(patients);
  } catch (error) {
    console.error("Error fetching doctor's patients:", error);
    res.status(500).json({ error: "Failed to fetch your patients." });
  }
});

// ✅ Get a specific patient's vitals (Doctor can only see consulted patients)
router.get("/patient/:patientId/vitals", async (req, res) => {
  const { patientId } = req.params;
  if (!(await isDoctorConsultingPatient(req.user.userId, patientId))) {
    return res
      .status(403)
      .json({ error: "Access denied. You are not consulting this patient." });
  }
  try {
    const records = await Record.find({ userId: patientId }).sort({
      createdAt: -1,
    });
    res.json(records);
  } catch (error) {
    console.error("Error fetching patient vitals:", error);
    res.status(500).json({ error: "Failed to fetch patient vitals" });
  }
});

// ✅ Get a specific patient's files (Doctor can only see consulted patients)
router.get("/patient/:patientId/files", async (req, res) => {
  const { patientId } = req.params;
  if (!(await isDoctorConsultingPatient(req.user.userId, patientId))) {
    return res
      .status(403)
      .json({ error: "Access denied. You are not consulting this patient." });
  }
  try {
    const files = await File.find({ userId: patientId }).sort({
      createdAt: -1,
    });
    res.json(files);
  } catch (error) {
    console.error("Error fetching patient files:", error);
    res.status(500).json({ error: "Failed to fetch patient files" });
  }
});

// ✅ Add a note for a patient (Doctor can only add notes for consulted patients)
router.post("/patient/:patientId/notes", async (req, res) => {
  const { patientId } = req.params;
  const { content } = req.body;

  if (!(await isDoctorConsultingPatient(req.user.userId, patientId))) {
    return res
      .status(403)
      .json({ error: "Access denied. You are not consulting this patient." });
  }
  if (!content) {
    return res.status(400).json({ error: "Note content is required." });
  }

  try {
    const note = await Note.create({
      patientId,
      doctorId: req.user.userId,
      content,
    });
    res.status(201).json({ message: "Note added", note });
  } catch (error) {
    console.error("Error adding note:", error);
    res.status(500).json({ error: "Failed to add note" });
  }
});

// ✅ Get notes for a patient (Doctor can only view notes for consulted patients, patients can view their own)
router.get("/patient/:patientId/notes", auth, async (req, res) => {
  const { patientId } = req.params;

  // A patient can view their own notes
  if (req.user.role === "patient" && req.user.userId === patientId) {
    // Continue to fetch notes
  }
  // A doctor can view notes if they are consulting the patient
  else if (
    req.user.role === "doctor" &&
    (await isDoctorConsultingPatient(req.user.userId, patientId))
  ) {
    // Continue to fetch notes
  } else {
    return res
      .status(403)
      .json({ error: "Access denied. Not authorized to view these notes." });
  }

  try {
    const notes = await Note.find({ patientId })
      .sort({ createdAt: -1 })
      .populate("doctorId", "name email"); // Populate doctor's name and email
    res.json(notes);
  } catch (error) {
    console.error("Error fetching patient notes:", error);
    res.status(500).json({ error: "Failed to fetch patient notes." });
  }
});

// ✅ Doctor creates a prescription for a patient
router.post("/patient/:patientId/prescriptions", async (req, res) => {
  const { patientId } = req.params;
  const { medications, instructions } = req.body;

  if (!(await isDoctorConsultingPatient(req.user.userId, patientId))) {
    return res
      .status(403)
      .json({ error: "Access denied. You are not consulting this patient." });
  }
  if (!medications || !instructions) {
    return res
      .status(400)
      .json({ error: "Medications and instructions are required." });
  }

  try {
    const prescription = await Prescription.create({
      patientId,
      doctorId: req.user.userId,
      medications,
      instructions,
    });
    res
      .status(201)
      .json({ message: "Prescription issued successfully.", prescription });
  } catch (error) {
    console.error("Error issuing prescription:", error);
    res.status(500).json({ error: "Failed to issue prescription." });
  }
});

// ✅ Patient views their prescriptions
router.get("/my-prescriptions", async (req, res) => {
  if (req.user.role !== "patient") {
    return res
      .status(403)
      .json({ error: "Only patients can view their prescriptions." });
  }
  try {
    const prescriptions = await Prescription.find({
      patientId: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .populate("doctorId", "name email"); // Populate doctor info
    res.json(prescriptions);
  } catch (error) {
    console.error("Error fetching patient prescriptions:", error);
    res.status(500).json({ error: "Failed to fetch your prescriptions." });
  }
});

// ✅ Doctor gets a summarized health record for a patient (using LLM - Mistral placeholder)
router.get("/patient/:patientId/summary", async (req, res) => {
  const { patientId } = req.params;
  if (!(await isDoctorConsultingPatient(req.user.userId, patientId))) {
    return res
      .status(403)
      .json({ error: "Access denied. You are not consulting this patient." });
  }

  try {
    // Fetch all relevant data for the patient
    const patient = await User.findById(patientId).select("name email role");
    const vitals = await Record.find({ userId: patientId }).sort({
      createdAt: 1,
    });
    const files = await File.find({ userId: patientId }).sort({ createdAt: 1 });
    const notes = await Note.find({ patientId })
      .sort({ createdAt: 1 })
      .populate("doctorId", "name");

    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    // Format data for LLM input
    let prompt = `Generate a concise health summary for the patient '${patient.name}' (Email: ${patient.email}).\n\n`;
    prompt +=
      "Include current and past health conditions based on the provided data. Highlight any significant trends or concerns.\n\n";

    if (vitals.length > 0) {
      prompt += "Vitals History:\n";
      vitals.forEach((v) => {
        prompt += `- ${new Date(v.createdAt).toLocaleDateString()}: BP ${
          v.bp
        }, Sugar ${v.sugar}, HR ${v.heartRate}\n`;
      });
      prompt += "\n";
    }

    if (notes.length > 0) {
      prompt += "Doctor's Notes:\n";
      notes.forEach((n) => {
        prompt += `- ${new Date(n.createdAt).toLocaleDateString()} (Dr. ${
          n.doctorId ? n.doctorId.name : "Unknown"
        }): ${n.content}\n`;
      });
      prompt += "\n";
    }

    if (files.length > 0) {
      prompt += "Uploaded Files (names):\n";
      files.forEach((f) => {
        prompt += `- ${f.fileName} (${new Date(
          f.createdAt
        ).toLocaleDateString()})\n`;
      });
      prompt += "\n";
    }

    prompt +=
      "Based on this, provide a concise summary of the patient's health status, key health events, and any notable observations. Focus on clinically relevant information.";

    // --- MISTRAL LLM API Call Placeholder ---
    // You'll need to set up your Mistral API key in your .env file
    // and potentially install 'node-fetch' if not already available
    // npm install node-fetch (if using older Node.js or not in a module environment)

    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey) {
      return res
        .status(500)
        .json({ error: "Mistral API Key not configured on server." });
    }

    const mistralApiUrl = "https://api.mistral.ai/v1/chat/completions"; // Check Mistral's current API endpoint

    const mistralResponse = await fetch(mistralApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-tiny", // Or "mistral-medium", "mistral-large" depending on your needs and budget
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500, // Limit the summary length
      }),
    });

    const mistralData = await mistralResponse.json();

    if (
      mistralResponse.ok &&
      mistralData.choices &&
      mistralData.choices.length > 0
    ) {
      const summary = mistralData.choices[0].message.content;
      res.json({ summary });
    } else {
      console.error("Mistral API error:", mistralData);
      res
        .status(500)
        .json({
          error: mistralData.error
            ? mistralData.error.message
            : "Failed to generate summary from AI.",
        });
    }
  } catch (error) {
    console.error("Error generating health summary:", error);
    res
      .status(500)
      .json({
        error: "Failed to generate health summary due to server error.",
      });
  }
});

module.exports = router;

/* END OF FILE routes/doctorRoutes.js */
