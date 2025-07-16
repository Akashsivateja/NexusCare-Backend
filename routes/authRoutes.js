/* START OF FILE routes/authRoutes.js */

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  const { name, email, password, role, specialty } = req.body; // Added specialty
  try {
    const hashed = await bcrypt.hash(password, 10);
    const userData = { name, email, password: hashed, role };
    if (role === "doctor" && specialty) {
      // Include specialty for doctors
      userData.specialty = specialty;
    }
    const user = await User.create(userData);
    res.status(201).json({ message: "User created" });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      res
        .status(400)
        .json({ error: "Email already used. Please use a different email." });
    } else {
      console.error("Registration error:", error);
      res
        .status(500)
        .json({ error: "Registration failed due to server error." });
    }
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" } // Add token expiration for security
  );
  // ✅ Send back the user's role and name (and specialty for doctor)
  res.json({
    token,
    role: user.role,
    name: user.name,
    specialty: user.specialty,
  });
});

module.exports = router;
