/* START OF FILE routes/patientRoutes.js */

const express = require("express");
const auth = require("../middleware/authMiddleware"); // Assuming authMiddleware.js is in ../middleware
const Note = require("../models/Note");               // Assuming Note.js is in ../models
const Prescription = require("../models/Prescription"); // Assuming Prescription.js is in ../models
const router = express.Router();

// All routes in this file require authentication
router.use(auth); // This applies the auth middleware to all routes defined below in this file.

// ✅ Patient views their own notes
router.get("/:patientId/notes", async (req, res) => {
    const { patientId } = req.params;

    // Ensure the requesting user is the patient themselves
    // req.user.userId comes from the JWT token decoded by auth middleware
    if (req.user.role !== "patient" || req.user.userId !== patientId) {
        return res.status(403).json({ error: "Access denied. Not authorized to view these notes." });
    }

    try {
        const notes = await Note.find({ patientId: req.user.userId }) // Filter by logged-in patient's ID
                                .sort({ createdAt: -1 })
                                .populate('doctorId', 'name email'); // Get doctor's name and email
        res.json(notes);
    } catch (error) {
        console.error("Error fetching patient notes:", error);
        res.status(500).json({ error: "Failed to fetch patient notes." });
    }
});

// ✅ Patient views their own prescriptions
router.get("/:patientId/prescriptions", async (req, res) => {
    const { patientId } = req.params;

    // Ensure the requesting user is the patient themselves
    if (req.user.role !== "patient" || req.user.userId !== patientId) {
        return res.status(403).json({ error: "Access denied. Not authorized to view these prescriptions." });
    }

    try {
        const prescriptions = await Prescription.find({ patientId: req.user.userId }) // Filter by logged-in patient's ID
                                            .sort({ createdAt: -1 })
                                            .populate('doctorId', 'name email'); // Get doctor's name and email
        res.json(prescriptions);
    } catch (error) {
        console.error("Error fetching patient prescriptions:", error);
        res.status(500).json({ error: "Failed to fetch your prescriptions." });
    }
});

module.exports = router;
/* END OF FILE routes/patientRoutes.js */
