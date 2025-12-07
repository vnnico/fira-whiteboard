// src/models/whiteboardStore.js
import { randomUUID } from "crypto";

const boards = new Map();
// key: roomId, value: { roomId, createdBy, createdAt, elements: [] }

export function createBoard({ createdBy }) {
  const roomId = randomUUID();
  const board = {
    roomId,
    createdBy: createdBy || null,
    createdAt: new Date(),
    elements: [],
  };
  boards.set(roomId, board);
  return board;
}

export function getBoard(roomId) {
  return boards.get(roomId) || null;
}

export function upsertElement(roomId, element) {
  let board = boards.get(roomId);
  if (!board) {
    // Kalau board belum ada, buat minimal (supaya flow tetap jalan)
    board = {
      roomId,
      createdBy: null,
      createdAt: new Date(),
      elements: [],
    };
    boards.set(roomId, board);
  }

  const idx = board.elements.findIndex((el) => el.id === element.id);
  if (idx === -1) {
    board.elements.push(element);
  } else {
    board.elements[idx] = element;
  }
  return board;
}

export function clearBoard(roomId) {
  const board = boards.get(roomId);
  if (board) {
    board.elements = [];
  }
  return board;
}
