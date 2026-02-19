import { findById, updateIsNew } from "../models/userModel.js";

export async function onboarding(req, res, next) {
  try {
    const user = await findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.is_new)
      return res.status(400).json({ message: "Invalid Request" });

    await updateIsNew(user.id);

    return res.status(200).json({ message: "Updated successfully" });
  } catch (err) {
    next(err);
  }
}
