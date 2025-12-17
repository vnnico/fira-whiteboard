// backend/routes/livekitRoutes.js
import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { createToken } from "../controllers/voiceController.js";

const router = Router();

router.post("/token", requireAuth, createToken);

export default router;
