import { updateDisplayName } from "../models/userModel.js";

export async function updateMyDisplayName(req, res, next) {
  try {
    const { displayName } = req.body;
    if (!displayName?.trim()) {
      return res.status(400).json({ message: "Display name is required" });
    }

    const updated = await updateDisplayName(req.user.id, displayName.trim());
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
    });
  } catch (err) {
    next(err);
  }
}
