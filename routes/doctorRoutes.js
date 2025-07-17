/* START OF FILE routes/doctorRoutes.js */

const express = require("express");
const AWS = require("aws-sdk");
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");
const Record = require("../models/Record");
const File = require("../models/File");
const Note = require("../models/Note");
const Prescription = require("../models/Prescription");
const router = express.Router();

router.use(auth);
router.use((req, res, next) => {
  if (req.user.role !== "doctor") {
    return res.status(403).json({ error: "Access denied. Doctors only." });
  }
  next();
});

async function isDoctorConsultingPatient(doctorId, patientId) {
  const doctor = await User.findById(doctorId);
  return doctor && doctor.consultedPatients.includes(patientId);
}

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

router.get("/patient/:patientId/notes", async (req, res) => {
  const { patientId } = req.params;

  if (
    req.user.role === "doctor" &&
    (await isDoctorConsultingPatient(req.user.userId, patientId))
  ) {
    try {
      const notes = await Note.find({ patientId })
        .sort({ createdAt: -1 })
        .populate("doctorId", "name email");
      res.json(notes);
    } catch (error) {
      console.error("Error fetching patient notes:", error);
      res.status(500).json({ error: "Failed to fetch patient notes." });
    }
  } else {
    return res
      .status(403)
      .json({ error: "Access denied. Not authorized to view these notes." });
  }
});

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

router.get("/patient/:patientId/summary", async (req, res) => {
  const { patientId } = req.params;
  if (!(await isDoctorConsultingPatient(req.user.userId, patientId))) {
    return res
      .status(403)
      .json({ error: "Access denied. You are not consulting this patient." });
  }

  try {
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

    const mistralApiKey = process.env.MISTRAL_API_KEY;

    console.log("Mistral API Key Check:", mistralApiKey ? "Key found" : "Key NOT found (undefined)");

    if (!mistralApiKey) {
      return res
        .status(500)
        .json({ error: "Mistral API Key not configured on server." });
    }

    // ✅ Crucial Fix: Ensure this URL is exactly correct
    const mistralApiUrl = "https://api.mistral.ai/v1/chat/completions";

    console.log("Sending prompt to Mistral AI:", prompt.substring(0, 500) + "...");

    try { // Added try-catch around the fetch call for better error handling
        const mistralResponse = await fetch(mistralApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mistralApiKey}`,
          },
          body: JSON.stringify({
            model: "open-mistral-7b",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        console.log("Mistral raw response status:", mistralResponse.status, mistralResponse.statusText);

        const mistralData = await mistralResponse.json();

        console.log("Mistral full response data:", JSON.stringify(mistralData, null, 2));

        if (
          mistralResponse.ok &&
          mistralData.choices &&
          mistralData.choices.length > 0
        ) {
          const summary = mistralData.choices[0].message.content;
          res.json({ summary });
        } else {
          // This console.error is what you need to check in Render logs
          console.error("Mistral API error (from Mistral response):", mistralData);
          res.status(500).json({
            error: mistralData.error
              ? mistralData.error.message
              : "Failed to generate summary from AI (unexpected response).",
          });
        }
    } catch (fetchError) { // Catch network errors during the fetch itself
        console.error("Error during fetch to Mistral API:", fetchError);
        res.status(500).json({
            error: "Network error when connecting to Mistral AI. Please check URL or network.",
        });
    }
  } catch (error) {
    console.error("Error generating health summary (main catch block):", error);
    res.status(500).json({
      error: "Failed to generate health summary due to server error.",
    });
  }
});

module.exports = router;
/* END OF FILE routes/doctorRoutes.js */
