const express = require("express");
const router = express.Router();
const multer = require("multer");

const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const {
  uploadAnalysis,
  getMyAnalyses,
  getPendingQueue,
  getAnalysisDetail,
  submitFeedback,
  getExpertHistory,
} = require("../controllers/analysisController");

// Multer — store file in memory so we can stream to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

// ── Farmer routes ──────────────────────────────────────────────────────────────
// POST /api/analysis/upload  — farmer uploads image
router.post(
  "/upload",
  authMiddleware,
  roleMiddleware(["farmer"]),
  upload.single("image"),
  uploadAnalysis
);

// GET /api/analysis/my  — farmer gets own history
router.get(
  "/my",
  authMiddleware,
  roleMiddleware(["farmer"]),
  getMyAnalyses
);

// ── Expert routes ──────────────────────────────────────────────────────────────
// GET /api/analysis/queue  — expert gets pending queue
router.get(
  "/queue",
  authMiddleware,
  roleMiddleware(["expert", "admin"]),
  getPendingQueue
);

// GET /api/analysis/:id  — expert gets full detail (with sensor snapshot)
router.get(
  "/:id",
  authMiddleware,
  roleMiddleware(["expert", "admin"]),
  getAnalysisDetail
);

// POST /api/analysis/:id/feedback  — expert submits advice
router.post(
  "/:id/feedback",
  authMiddleware,
  roleMiddleware(["expert", "admin"]),
  submitFeedback
);

// GET /api/analysis/expert/history  — expert's submitted reviews
router.get(
  "/expert/history",
  authMiddleware,
  roleMiddleware(["expert", "admin"]),
  getExpertHistory
);

module.exports = router;