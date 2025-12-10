// Note: Kita butuh akses ke 'boards' Map untuk filter,
// atau buat fungsi getAllBoards di store.js (lebih rapi).
// Anggap kita export 'getAllBoards' dari store.js yang return Array.from(boards.values())

// Kalau malas ubah store, import map nya langsung (tapi tidak best practice).
// Mari kita asumsikan di store.js anda tambah:
// export function getAllBoards() { return Array.from(boards.values()); }

import {
  getAllBoards,
  updateBoardTitle,
  createBoard,
  getBoardById,
} from "../models/whiteboardStore.js";

// GET /api/whiteboards/:roomId
export async function getWhiteboard(req, res, next) {
  try {
    const { roomId } = req.params;
    const board = getBoardById(roomId);
    if (!board) return res.status(404).json({ message: "Board not found" });

    res.status(200).json({ board });
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
