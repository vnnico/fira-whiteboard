import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

export const User = mongoose.model("User", userSchema);

function mapPublicUser(doc) {
  if (!doc) return null;
  return { id: String(doc._id), username: doc.username };
}

function mapAuthUser(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    username: doc.username,
    password: doc.password,
  };
}

export async function findAuthByUsername(username) {
  const doc = await User.findOne({ username: String(username || "") }).lean();
  return mapAuthUser(doc);
}

export async function findById(id) {
  const doc = await User.findById(String(id || "")).lean();
  return mapPublicUser(doc);
}
