import { createBoard } from "../models/whiteboardStore.js";

const dummyWhiteboards = [
  { id: "wb-1", title: "Untitled", updatedAt: "May 7 by Nic" },
  { id: "wb-2", title: "Untitled", updatedAt: "May 7 by Nic" },
  { id: "wb-3", title: "Concept Sketch", updatedAt: "May 8 by Nic" },
];

// POST /api/whiteboards
export async function getWhiteboards(req, res, next) {
  try {
    res.status(200).json({
      whiteboards: dummyWhiteboards,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/whiteboards/create
export async function createWhiteboard(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const board = createBoard({ createdBy: userId });

    res.status(201).json({
      roomId: board.roomId,
      whiteboard: {
        roomId: board.roomId,
        createdBy: board.createdBy,
        createdAt: board.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}
