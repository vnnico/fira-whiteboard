import { Router } from "express";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import voiceRoutes from "./voiceRoutes.js";
import whiteboardRoutes from "./whiteboardRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/whiteboards", whiteboardRoutes);
router.use("/voice", voiceRoutes);
export default router;
