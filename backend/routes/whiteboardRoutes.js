// src/routes/whiteboardRoutes.js
import { Router } from "express";
import {
  createWhiteboard,
  getWhiteboards,
} from "../controllers/whiteboardController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// create new whiteboard room
router.post("/", requireAuth, getWhiteboards);
router.post("/create", requireAuth, createWhiteboard);

export default router;
