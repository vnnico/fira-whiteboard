// src/routes/whiteboardRoutes.js
import { Router } from "express";
import {
  createWhiteboard,
  getWhiteboards,
  getWhiteboard,
  updateTitle,
} from "../controllers/whiteboardController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// create new whiteboard room
router.post("/", requireAuth, getWhiteboards);
router.post("/create", requireAuth, createWhiteboard);
router.get("/:roomId", requireAuth, getWhiteboard);
// update title
router.patch("/:roomId/title", requireAuth, updateTitle);
export default router;
