import { updateDisplayName } from "../models/userModel.js";

// PATCH /api/users/me/display-name
export async function updateMyDisplayName(req, res, next) {
  try {
    const { displayName } = req.body;
    if (!displayName?.trim()) {
      return res.status(400).json({ message: "Display name is required" });
    }

    const updated = updateDisplayName(req.user.id, displayName.trim());
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
    });
  } catch (err) {
    next(err);
  }
}
