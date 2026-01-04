import { randomUUID } from "crypto";
import { Board, Roles } from "../models/whiteboardModel.js";
import { getWhiteboardNamespace } from "../sockets/index.js";

// GET /api/whiteboards/:roomId/exists  (NO auth)
export async function checkWhiteboardExists(req, res, next) {
  try {
    const rid = String(req.params.roomId || "").trim();
    if (!rid) return res.status(400).json({ message: "Missing roomId" });

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        rid
      );
    if (!isUuid) {
      return res.status(200).json({ exists: false });
    }

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

    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const existing = await Board.findOne({ roomId: rid })
      .select("roomId createdBy roles")
      .lean();

    if (!existing) return res.status(404).json({ message: "Board not found" });

    const isOwner =
      (existing.createdBy && String(existing.createdBy) === userId) ||
      String(existing.roles?.[userId] || "") === Roles.OWNER;

    if (!isOwner) return res.status(403).json({ message: "Forbidden" });

    const nextTitle =
      String(req.body?.title || "").trim() || "Untitled Whiteboard";

    if (nextTitle.length > 50)
      return res.status(400).json({ message: "Title is too long (max 50)" });

    const board = await Board.findOneAndUpdate(
      { roomId: rid },
      { $set: { title: nextTitle, updatedAt: new Date() } },
      { new: true }
    )
      .select("roomId title createdBy members locked createdAt updatedAt")
      .lean();

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
