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

export function authSocketMiddleware(socket, next) {
  try {
    const token = socket?.handshake?.auth?.token;

    if (!token) {
      const err = new Error("Unauthorized: missing token");
      err.data = { code: "MISSING_TOKEN" };
      return next(err);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      const err = new Error("Server misconfigured: missing JWT_SECRET");
      err.data = { code: "MISSING_JWT_SECRET" };
      return next(err);
    }

    const decoded = jwt.verify(token, secret);

    const userId = decoded?.sub;
    const username = decoded?.username || "Unknown";

    if (!userId) {
      const err = new Error("Unauthorized: invalid token payload");
      err.data = { code: "INVALID_TOKEN_PAYLOAD" };
      return next(err);
    }

    socket.user = {
      id: String(userId),
      username: String(username),
    };

    return next();
  } catch (e) {
    const err = new Error("Unauthorized: invalid token");
    err.data = { code: "INVALID_TOKEN" };
    return next(err);
  }
}
