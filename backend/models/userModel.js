import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    is_new: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

export const User = mongoose.model("User", userSchema);

function mapPublicUser(doc) {
  if (!doc) return null;
  return { id: String(doc._id), username: doc.username, is_new: doc.is_new };
}

function mapAuthUser(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    username: doc.username,
    password: doc.password,
  };
}

export async function createUser({ id, username, passwordHash }) {
  const doc = await User.create({
    username: String(username),
    password: String(passwordHash),
  });

  return { id: String(doc._id), username: doc.username };
}

export async function findAuthByUsername(username) {
  const doc = await User.findOne({ username: String(username || "") }).lean();
  return mapAuthUser(doc);
}

export async function findById(id) {
  const doc = await User.findById(String(id || "")).lean();
  console.log(doc);
  return mapPublicUser(doc);
}

export async function updateIsNew(id) {
  const doc = await User.findByIdAndUpdate(
    String(id),
    { $set: { is_new: false } },
    { new: true }, // return dokumen setelah update
  ).lean();

  if (!doc) return null;

  console.log(doc);

  return {
    id: String(doc._id),
    username: doc.username,
    is_new: doc.is_new,
  };
}
