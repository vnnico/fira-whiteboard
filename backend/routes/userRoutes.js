import { Router } from "express";
import { updateMyDisplayName } from "../controllers/userController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.patch("/me/display-name", requireAuth, updateMyDisplayName);

export default router;
