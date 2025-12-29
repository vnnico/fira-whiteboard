import mongoose from "mongoose";

export const Roles = Object.freeze({
  OWNER: "OWNER",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
});

const rolesValidator = (rolesObj) => {
  if (!rolesObj || typeof rolesObj !== "object") return true;
  const allowed = new Set(Object.values(Roles));
  for (const v of Object.values(rolesObj)) {
    if (!allowed.has(v)) return false;
  }
  return true;
};

const boardSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "Untitled Whiteboard" },
    createdBy: { type: String, default: null },
    members: { type: [String], default: [], index: true },

    roles: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: rolesValidator,
        message: "Invalid role value in roles map",
      },
    },

    locked: { type: Boolean, default: false },

    elements: { type: [mongoose.Schema.Types.Mixed], default: [] },

    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true, versionKey: false }
);

boardSchema.index({ createdBy: 1 });

export async function recordMemberJoin(roomId, userId) {
  const rid = String(roomId || "");
  const uid = String(userId || "");
  if (!rid || !uid) return false;

  const res = await Board.updateOne(
    { roomId: rid },
    { $addToSet: { members: uid }, $set: { updatedAt: new Date() } },
    { upsert: false }
  );

  return res.matchedCount > 0;
}

export const Board = mongoose.model("Board", boardSchema);
