/* START OF FILE server.js */

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const fileUpload = require("express-fileupload");

const authRoutes = require("./routes/authRoutes");
const recordRoutes = require("./routes/recordRoutes");
const fileRoutes = require("./routes/fileRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const consultationRoutes = require("./routes/consultationRoutes"); // ✅ New: Import consultation routes

dotenv.config();
const app = express();

// ✅ Configure CORS to allow your frontend URL
app.use(
  cors({
    origin: "https://nexuscare-frontend.onrender.com", // 🔁 Replace with your actual frontend URL
    credentials: true,
  })
);

// ✅ Middleware
app.use(express.json());
app.use(fileUpload({ useTempFiles: true }));

// ✅ Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ API Routes
app.use("/api/auth", authRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/consultations", consultationRoutes); // ✅ New: Add consultation routes

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
