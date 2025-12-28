// backend/routes/livekitRoutes.js
import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  createToken,
  moderateMute,
  moderateDeafen,
} from "../controllers/voiceController.js";

const router = Router();

router.post("/token", requireAuth, createToken);
router.post("/moderate/mute", requireAuth, moderateMute);
router.post("/moderate/deafen", requireAuth, moderateDeafen);

export default router;
