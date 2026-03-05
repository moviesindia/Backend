require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const authRoutes     = require("./routes/authRoutes");
const sensorRoutes   = require("./routes/sensorRoutes");
const contactRoutes  = require("./routes/contactRoutes");
const userRoutes     = require("./routes/userRoutes");
const analysisRoutes = require("./routes/analysisRoutes"); // NEW
const inboxRoutes    = require("./routes/inboxRoutes");    // NEW

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("AgriSense API Running 🚀"));

app.use("/api/auth",     authRoutes);
app.use("/api/contact",  contactRoutes);
app.use("/api/sensors",  sensorRoutes);
app.use("/api/user",     userRoutes);
app.use("/api/analysis", analysisRoutes); // NEW
app.use("/api/inbox",    inboxRoutes);    // NEW

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await db.query("SELECT 1");
    console.log("Database Connected ✅");
  } catch (err) {
    console.error("Database Error ❌", err);
  }
});