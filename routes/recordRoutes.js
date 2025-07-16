const express = require("express");
const Record = require("../models/Record");
const auth = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/add", auth, async (req, res) => {
  const { bp, sugar, heartRate } = req.body;
  const record = await Record.create({
    userId: req.user.userId,
    bp,
    sugar,
    heartRate,
  });
  res.json({ message: "Vitals added", record });
});

router.get("/my", auth, async (req, res) => {
  const records = await Record.find({ userId: req.user.userId }).sort({
    createdAt: -1,
  });
  res.json(records);
});

module.exports = router;
