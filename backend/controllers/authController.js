import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import {
  findByUsername,
  findById,
  generateRandomDisplayName,
} from "../models/userModel.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "2h",
  });
}

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    await sleep(3000);

    const user = findByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // jika displayName belum ada format User-xxxxxx, generate
    if (!user.displayName?.startsWith("User-")) {
      user.displayName = generateRandomDisplayName();
    }

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
export async function getMe(req, res, next) {
  try {
    const user = findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    });
  } catch (err) {
    next(err);
  }
}
