const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("../config/cloudinary");

// Mock AI predictions (replace with real AI model later)
const MOCK_PREDICTIONS = [
  "Nitrogen deficiency detected. Soil pH slightly low at 5.8. Consider adding urea fertilizer.",
  "Soil appears healthy. Maintain current irrigation schedule and fertilization routine.",
  "High moisture content detected. Risk of root rot if waterlogging persists.",
  "Potassium levels appear low based on visual indicators. Phosphorus seems adequate.",
  "Seeds appear healthy with good germination potential. No visible signs of fungal infection.",
  "Possible fungal coating on seed surface. Germination rate may be reduced.",
];

const getMockPrediction = () =>
  MOCK_PREDICTIONS[Math.floor(Math.random() * MOCK_PREDICTIONS.length)];

// ─── FARMER: Upload image & create analysis record ────────────────────────────
exports.uploadAnalysis = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const { type } = req.body; // 'soil' or 'seed'

    if (!type || !["soil", "seed"].includes(type)) {
      return res.status(400).json({ message: "type must be 'soil' or 'seed'" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    // Upload to Cloudinary (file is in memory buffer via multer memoryStorage)
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "agrisense/analysis",
          resource_type: "image",
          transformation: [{ width: 1200, crop: "limit", quality: "auto" }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const aiPrediction = getMockPrediction();
    const id = uuidv4();

    await db.query(
      `INSERT INTO analysis_records 
       (id, farmer_id, type, image_url, image_public_id, ai_prediction, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [id, farmerId, type, uploadResult.secure_url, uploadResult.public_id, aiPrediction]
    );

    res.status(201).json({
      message: "Analysis submitted successfully",
      analysis: {
        id,
        type,
        image_url: uploadResult.secure_url,
        ai_prediction: aiPrediction,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("uploadAnalysis error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── FARMER: Get own analysis history ─────────────────────────────────────────
exports.getMyAnalyses = async (req, res) => {
  try {
    const farmerId = req.user.id;

    const [records] = await db.query(
      `SELECT 
         ar.id, ar.type, ar.image_url, ar.ai_prediction,
         ar.expert_feedback, ar.expert_verified, ar.status,
         ar.created_at, ar.reviewed_at,
         u.full_name AS expert_name
       FROM analysis_records ar
       LEFT JOIN users u ON u.id = ar.expert_id
       WHERE ar.farmer_id = ?
       ORDER BY ar.created_at DESC`,
      [farmerId]
    );

    res.status(200).json(records);
  } catch (error) {
    console.error("getMyAnalyses error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── EXPERT: Get pending queue ─────────────────────────────────────────────────
exports.getPendingQueue = async (req, res) => {
  try {
    const [records] = await db.query(
      `SELECT 
         ar.id, ar.type, ar.image_url, ar.ai_prediction,
         ar.created_at, ar.status,
         u.id AS farmer_id, u.full_name AS farmer_name, u.email AS farmer_email
       FROM analysis_records ar
       JOIN users u ON u.id = ar.farmer_id
       WHERE ar.status = 'pending'
       ORDER BY ar.created_at ASC`,
      []
    );

    res.status(200).json(records);
  } catch (error) {
    console.error("getPendingQueue error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── EXPERT: Get single analysis detail (with sensor snapshot) ────────────────
exports.getAnalysisDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [records] = await db.query(
      `SELECT 
         ar.id, ar.type, ar.image_url, ar.ai_prediction,
         ar.expert_feedback, ar.status, ar.created_at,
         u.id AS farmer_id, u.full_name AS farmer_name, u.email AS farmer_email
       FROM analysis_records ar
       JOIN users u ON u.id = ar.farmer_id
       WHERE ar.id = ?`,
      [id]
    );

    if (records.length === 0) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    const record = records[0];

    // Fetch latest sensor reading for this farmer (closest timestamp to submission)
    const [sensorData] = await db.query(
      `SELECT sr.moisture_level, sr.temperature, sr.ph_level,
              sr.nitrogen, sr.phosphorus, sr.potassium, sr.recorded_at
       FROM sensor_readings sr
       JOIN sensors s ON s.id = sr.sensor_id
       WHERE s.farmer_id = ?
       ORDER BY ABS(TIMESTAMPDIFF(SECOND, sr.recorded_at, ?)) ASC
       LIMIT 1`,
      [record.farmer_id, record.created_at]
    );

    res.status(200).json({
      ...record,
      sensor_data: sensorData.length > 0 ? {
        moisture:    Number(sensorData[0].moisture_level),
        temperature: Number(sensorData[0].temperature),
        ph:          Number(sensorData[0].ph_level),
        nitrogen:    Number(sensorData[0].nitrogen),
        phosphorus:  Number(sensorData[0].phosphorus),
        potassium:   Number(sensorData[0].potassium),
        recorded_at: sensorData[0].recorded_at,
      } : null,
    });
  } catch (error) {
    console.error("getAnalysisDetail error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── EXPERT: Submit feedback ───────────────────────────────────────────────────
exports.submitFeedback = async (req, res) => {
  try {
    const expertId = req.user.id;
    const { id } = req.params; // analysis_id
    const { feedback } = req.body;

    if (!feedback || feedback.trim().length < 10) {
      return res.status(400).json({ message: "Feedback must be at least 10 characters" });
    }

    // Verify analysis exists and is still pending
    const [records] = await db.query(
      "SELECT id, farmer_id, type FROM analysis_records WHERE id = ?",
      [id]
    );
    if (records.length === 0) {
      return res.status(404).json({ message: "Analysis not found" });
    }
    const analysis = records[0];

    if (analysis.status === "reviewed") {
      return res.status(400).json({ message: "This analysis has already been reviewed" });
    }

    // Update the analysis record
    await db.query(
      `UPDATE analysis_records 
       SET expert_feedback = ?, expert_id = ?, expert_verified = TRUE,
           status = 'reviewed', reviewed_at = NOW()
       WHERE id = ?`,
      [feedback.trim(), expertId, id]
    );

    // Get expert name for the inbox message
    const [experts] = await db.query(
      "SELECT full_name FROM users WHERE id = ?",
      [expertId]
    );

    // Create inbox message for the farmer
    await db.query(
      `INSERT INTO expert_messages 
       (id, analysis_id, farmer_id, expert_id, analysis_type, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), id, analysis.farmer_id, expertId, analysis.type, feedback.trim()]
    );

    res.status(200).json({ message: "Feedback submitted successfully" });
  } catch (error) {
    console.error("submitFeedback error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── EXPERT: Get submitted review history ─────────────────────────────────────
exports.getExpertHistory = async (req, res) => {
  try {
    const expertId = req.user.id;

    const [records] = await db.query(
      `SELECT 
         ar.id, ar.type, ar.image_url, ar.ai_prediction,
         ar.expert_feedback, ar.reviewed_at,
         u.full_name AS farmer_name, u.email AS farmer_email
       FROM analysis_records ar
       JOIN users u ON u.id = ar.farmer_id
       WHERE ar.expert_id = ?
       ORDER BY ar.reviewed_at DESC`,
      [expertId]
    );

    res.status(200).json(records);
  } catch (error) {
    console.error("getExpertHistory error:", error);
    res.status(500).json({ message: "Server error" });
  }
};