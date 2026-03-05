const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const {
  getFarmerMessages,
  markMessageRead,
  getUnreadCount,
  sendNotice,
  getFarmerNotices,
  getFarmersList,
} = require("../controllers/inboxController");

// ── Farmer routes ──────────────────────────────────────────────────────────────
// GET /api/inbox/messages  — all expert messages for logged-in farmer
router.get(
  "/messages",
  authMiddleware,
  roleMiddleware(["farmer"]),
  getFarmerMessages
);

// PATCH /api/inbox/messages/:id/read  — mark a message as read
router.patch(
  "/messages/:id/read",
  authMiddleware,
  roleMiddleware(["farmer"]),
  markMessageRead
);

// GET /api/inbox/unread  — unread message count
router.get(
  "/unread",
  authMiddleware,
  roleMiddleware(["farmer"]),
  getUnreadCount
);

// GET /api/inbox/notices  — notices for logged-in farmer (global + targeted)
router.get(
  "/notices",
  authMiddleware,
  roleMiddleware(["farmer"]),
  getFarmerNotices
);

// ── Expert/Admin routes ────────────────────────────────────────────────────────
// POST /api/inbox/notices  — send a notice
router.post(
  "/notices",
  authMiddleware,
  roleMiddleware(["expert", "admin"]),
  sendNotice
);

// GET /api/inbox/farmers  — list all farmers (for broadcast dropdown)
router.get(
  "/farmers",
  authMiddleware,
  roleMiddleware(["expert", "admin"]),
  getFarmersList
);

module.exports = router;