import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    displayName: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

export const User = mongoose.model("User", userSchema);

function mapUser(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    username: doc.username,
    password: doc.password,
    displayName: doc.displayName,
  };
}

export async function findByUsername(username) {
  const doc = await User.findOne({ username: String(username || "") }).lean();
  return mapUser(doc);
}

export async function findById(id) {
  const doc = await User.findById(String(id || "")).lean();
  return mapUser(doc);
}

export async function updateDisplayName(id, newName) {
  const doc = await User.findByIdAndUpdate(
    String(id || ""),
    { $set: { displayName: newName } },
    { new: true }
  ).lean();

  return mapUser(doc);
}

export function generateRandomDisplayName() {
  const random = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  return `User-${random}`;
}
