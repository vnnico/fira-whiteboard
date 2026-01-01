// src/routes/whiteboardRoutes.js
import { Router } from "express";
import {
  createWhiteboard,
  getWhiteboards,
  getWhiteboardMeta,
  updateTitle,
  checkWhiteboardExists,
  deleteWhiteboard,
} from "../controllers/whiteboardController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// create new whiteboard room
router.post("/", requireAuth, getWhiteboards);
router.post("/create", requireAuth, createWhiteboard);
router.get("/:roomId/exists", checkWhiteboardExists);
router.get("/:roomId/meta", requireAuth, getWhiteboardMeta);
// update title
router.patch("/:roomId/title", requireAuth, updateTitle);
router.delete("/:roomId", requireAuth, deleteWhiteboard);

export default router;
