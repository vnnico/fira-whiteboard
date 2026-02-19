import { Router } from "express";

import { requireAuth } from "../middleware/authMiddleware.js";
import { onboarding } from "../controllers/userController.js";

const router = Router();

router.post("/onboarding", requireAuth, onboarding);

export default router;
