import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import bcrypt from "bcryptjs";
import {
  createUser,
  findAuthByUsername,
  findById,
} from "../models/userModel.js";

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "2h",
  });
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export async function register(req, res, next) {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "username and password are required" });
    }

    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({
        message:
          "username must be 3-20 characters and only letters, numbers, underscore",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "password must at least 6 characters",
      });
    }

    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({
        message:
          "password must include uppercase letter, lowercase letter, and number",
      });
    }

    const existing = await findAuthByUsername(username);
    if (existing) {
      return res.status(409).json({ message: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await createUser({
      username,
      passwordHash,
    });

    const token = signToken(newUser);

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "username and password are required" });
    }

    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({
        message:
          "username must be 3-20 characters and only letters, numbers, underscore",
      });
    }

    const user = await findAuthByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      id: user.id,
      username: user.username,
      is_new: user.is_new,
    });
  } catch (err) {
    next(err);
  }
}
