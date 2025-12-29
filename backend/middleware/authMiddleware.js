import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { findById } from "../models/userModel.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.split(" ");

  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findById(payload.sub);

    if (!user) return res.status(401).json({ message: "Invalid token user" });

    req.user = { id: user.id, username: user.username };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
