import { randomUUID } from "crypto";
import { Board, Roles } from "../models/whiteboardModel.js";
import { getWhiteboardNamespace } from "../sockets/index.js";

// GET /api/whiteboards/:roomId/exists  (NO auth)
export async function checkWhiteboardExists(req, res, next) {
  try {
    const rid = String(req.params.roomId || "");
    if (!rid) return res.status(400).json({ message: "Missing roomId" });

    const exists = await Board.exists({ roomId: rid });
    if (!exists) return res.status(404).json({ exists: false });

    return res.status(200).json({ exists: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/whiteboards/:roomId/meta (auth)
export async function getWhiteboardMeta(req, res, next) {
  try {
    const rid = String(req.params.roomId || "");
    if (!rid) return res.status(400).json({ message: "Missing roomId" });

    const board = await Board.findOne({ roomId: rid })
      .select("roomId title createdBy locked")
      .lean();

    if (!board) return res.status(404).json({ message: "Board not found" });

    return res.status(200).json({
      roomId: String(board.roomId),
      title: board.title || "Untitled Whiteboard",
      createdBy: String(board.createdBy),
      locked: !!board.locked,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/whiteboards (auth) - list dashboard
export async function getWhiteboards(req, res, next) {
  try {
    const userId = String(req.user.id);

    const myWhiteboards = await Board.find({ createdBy: userId })
      .select("roomId title createdBy members locked createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    const joinedWhiteboards = await Board.find({
      members: userId,
      createdBy: { $ne: userId },
    })
      .select("roomId title createdBy members locked createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({ myWhiteboards, joinedWhiteboards });
  } catch (err) {
    next(err);
  }
}

// POST /api/whiteboards/create (auth)
export async function createWhiteboard(req, res, next) {
  try {
    const userId = String(req.user.id);
    const roomId = randomUUID();

    const board = await Board.create({
      roomId,
      title: "Untitled Whiteboard",
      createdBy: userId,
      members: [userId],
      roles: { [userId]: Roles.OWNER },
      locked: false,
      elements: [],
      schemaVersion: 1,
    });

    return res.status(201).json({
      roomId: board.roomId,
      whiteboard: {
        roomId: board.roomId,
        title: board.title,
        createdBy: board.createdBy,
        members: board.members,
        locked: !!board.locked,
        createdAt: board.createdAt,
        elements: board.elements,
      },
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/whiteboards/:roomId/title (auth)
export async function updateTitle(req, res, next) {
  try {
    const rid = String(req.params.roomId || "");
    if (!rid) return res.status(400).json({ message: "Missing roomId" });

    const nextTitle =
      String(req.body?.title || "").trim() || "Untitled Whiteboard";

    const board = await Board.findOneAndUpdate(
      { roomId: rid },
      { $set: { title: nextTitle, updatedAt: new Date() } },
      { new: true }
    )
      .select("roomId title createdBy members locked createdAt updatedAt")
      .lean();

    if (!board) return res.status(404).json({ message: "Board not found" });

    // broadcast realtime title update to room
    const ns = getWhiteboardNamespace();
    if (ns) ns.to(rid).emit("title-update", { title: board.title });

    return res.status(200).json({ board });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/whiteboards/:roomId (auth)
export async function deleteWhiteboard(req, res, next) {
  try {
    const userId = String(req.user.id);
    const rid = String(req.params.roomId || "");
    if (!rid) return res.status(400).json({ message: "Missing roomId" });

    const board = await Board.findOne({ roomId: rid })
      .select("roomId createdBy")
      .lean();

    if (!board) return res.status(404).json({ message: "Board not found" });
    if (String(board.createdBy) !== userId)
      return res.status(403).json({ message: "Forbidden" });

    await Board.deleteOne({ roomId: rid });

    // Kick everyone inside the room and force them out
    const ns = getWhiteboardNamespace();
    if (ns) {
      ns.to(rid).emit("board-deleted", { roomId: rid });

      const sockets = await ns.in(rid).fetchSockets();
      for (const s of sockets) {
        try {
          s.emit("kicked", { roomId: rid, reason: "Board was deleted" });
          s.disconnect(true);
        } catch {}
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}
