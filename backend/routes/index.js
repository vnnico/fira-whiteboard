import { Router } from "express";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import whiteboardRoutes from "./whiteboardRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/whiteboards", whiteboardRoutes);

export default router;
