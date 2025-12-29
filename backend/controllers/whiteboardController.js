import {
  getAllBoards,
  updateBoardTitle,
  createBoard,
  getBoardById,
  loadBoardFromDb,
  deleteBoard,
} from "../models/whiteboardStore.js";
import { Board } from "../models/whiteboardModel.js";

import { getWhiteboardNameSpace } from "../sockets/index.js";

// GET /api/whiteboards/:roomId/exists

export async function checkWhiteboardExists(req, res, next) {
  try {
    const rid = String(req.params.roomId || "");
    if (!rid) return res.status(400).json({ message: "Missing roomId" });

    let board = getBoardById(rid);

    console.log(board);
    if (!board) board = await loadBoardFromDb(rid);

    if (!board) return res.status(404).json({ exists: false });
    return res.status(200).json({ exists: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/whiteboards/:roomId
export async function getWhiteboard(req, res, next) {
  try {
    const userId = String(req.user.id);

    // Ambil semua board yang dibuat oleh user, atau user pernah join (members)
    const boards = await Board.find({
      $or: [{ createdBy: userId }, { members: userId }],
    })
      .select("roomId title createdBy members createdAt updatedAt locked")
      .sort({ updatedAt: -1 })
      .lean();

    const myWhiteboards = boards.filter((b) => String(b.createdBy) === userId);

    const joinedWhiteboards = boards.filter(
      (b) =>
        String(b.createdBy) !== userId && (b.members || []).includes(userId)
    );

    res.status(200).json({ myWhiteboards, joinedWhiteboards });
  } catch (err) {
    next(err);
  }
}

export async function getWhiteboardMeta(req, res, next) {
  try {
    const rid = String(req.params.roomId || "");
    if (!rid) return res.status(400).json({ message: "Missing roomId" });

    let board = getBoardById(rid);
    if (!board) board = await loadBoardFromDb(rid);

    if (!board) return res.status(404).json({ message: "Board not found" });

    return res.status(200).json({
      roomId: board.roomId,
      title: board.title,
      createdBy: board.createdBy,
      locked: !!board.locked,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/whiteboards
export async function getWhiteboards(req, res, next) {
  try {
    const userId = req.user.id;
    const allBoards = getAllBoards();

    console.log("Get all boards: ", allBoards);
    const myWhiteboards =
      allBoards.length > 0
        ? allBoards?.filter((b) => b.createdBy === userId)
        : [];
    const joinedWhiteboards =
      allBoards.length > 0
        ? allBoards?.filter(
            (b) => b.members.includes(userId) && b.createdBy !== userId
          )
        : [];

    console.log(allBoards);

    res.status(200).json({
      myWhiteboards,
      joinedWhiteboards,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/whiteboards/:roomId/title (API BARU)
export async function updateTitle(req, res, next) {
  try {
    const { roomId } = req.params;
    const { title } = req.body;

    // Validasi ownership bisa ditambah di sini
    const board = updateBoardTitle(roomId, title);

    if (!board) return res.status(404).json({ message: "Board not found" });
    getWhiteboardNameSpace()
      ?.to(roomId)
      .emit("title-update", { title: board.title });

    res.status(200).json({ board });
  } catch (err) {
    next(err);
  }
}

// POST /api/whiteboards/create
export async function createWhiteboard(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const board = await createBoard({ createdBy: userId });

    res.status(201).json({
      roomId: board.roomId,
      whiteboard: {
        roomId: board.roomId,
        title: board.title,
        members: board.members,
        createdBy: board.createdBy,
        createdAt: board.createdAt,
        elements: board.elements,
      },
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/whiteboards/:roomId
export async function deleteWhiteboard(req, res, next) {
  try {
    const userId = String(req.user.id);
    const { roomId } = req.params;

    let board = getBoardById(roomId);
    if (!board) board = await loadBoardFromDb(roomId);

    if (!board) return res.status(404).json({ message: "Board not found" });
    if (String(board.createdBy) !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await deleteBoard(roomId);

    getWhiteboardNameSpace()?.to(roomId).emit("board-deleted", { roomId });

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}
