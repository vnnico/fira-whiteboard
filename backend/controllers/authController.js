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

export async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    const user = await findByUsername(username);

    console.log(user);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
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

export async function getMe(req, res, next) {
  try {
    const user = await findById(req.user.id);
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
