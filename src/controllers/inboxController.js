const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ─── FARMER: Get all inbox messages ───────────────────────────────────────────
exports.getFarmerMessages = async (req, res) => {
  try {
    const farmerId = req.user.id;

    const [messages] = await db.query(
      `SELECT 
         em.id, em.analysis_id, em.analysis_type,
         em.message, em.is_read, em.created_at,
         u.full_name AS expert_name,
         ar.image_url, ar.ai_prediction
       FROM expert_messages em
       JOIN users u ON u.id = em.expert_id
       JOIN analysis_records ar ON ar.id = em.analysis_id
       WHERE em.farmer_id = ?
       ORDER BY em.created_at DESC`,
      [farmerId]
    );

    res.status(200).json(messages);
  } catch (error) {
    console.error("getFarmerMessages error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── FARMER: Mark message as read ─────────────────────────────────────────────
exports.markMessageRead = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const { id } = req.params;

    await db.query(
      "UPDATE expert_messages SET is_read = TRUE WHERE id = ? AND farmer_id = ?",
      [id, farmerId]
    );

    res.status(200).json({ message: "Marked as read" });
  } catch (error) {
    console.error("markMessageRead error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── FARMER: Get unread count ──────────────────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  try {
    const farmerId = req.user.id;

    const [[{ count }]] = await db.query(
      "SELECT COUNT(*) as count FROM expert_messages WHERE farmer_id = ? AND is_read = FALSE",
      [farmerId]
    );

    res.status(200).json({ unread: Number(count) });
  } catch (error) {
    console.error("getUnreadCount error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── EXPERT/ADMIN: Send a notice ──────────────────────────────────────────────
exports.sendNotice = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { recipient_id, title, message } = req.body; // recipient_id = null means all

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    await db.query(
      "INSERT INTO notices (id, sender_id, recipient_id, title, message) VALUES (?, ?, ?, ?, ?)",
      [uuidv4(), senderId, recipient_id || null, title, message]
    );

    res.status(201).json({ message: "Notice sent successfully" });
  } catch (error) {
    console.error("sendNotice error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── FARMER: Get notices (global + targeted) ──────────────────────────────────
exports.getFarmerNotices = async (req, res) => {
  try {
    const farmerId = req.user.id;

    const [notices] = await db.query(
      `SELECT 
         n.id, n.title, n.message, n.created_at,
         u.full_name AS sender_name
       FROM notices n
       JOIN users u ON u.id = n.sender_id
       WHERE n.recipient_id IS NULL OR n.recipient_id = ?
       ORDER BY n.created_at DESC`,
      [farmerId]
    );

    res.status(200).json(notices);
  } catch (error) {
    console.error("getFarmerNotices error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── EXPERT: Get all farmers list (for broadcast dropdown) ────────────────────
exports.getFarmersList = async (req, res) => {
  try {
    const [farmers] = await db.query(
      "SELECT id, full_name, email FROM users WHERE role = 'farmer' ORDER BY full_name ASC"
    );

    res.status(200).json(farmers);
  } catch (error) {
    console.error("getFarmersList error:", error);
    res.status(500).json({ message: "Server error" });
  }
};