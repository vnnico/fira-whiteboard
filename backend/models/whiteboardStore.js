// src/models/whiteboardStore.js
import { randomUUID } from "crypto";

const boards = new Map();
// key: roomId, value: { roomId, createdBy, createdAt, elements: [] }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createBoard({ createdBy }) {
  const roomId = randomUUID();
  console.log("Creating board...");
  const board = {
    roomId,
    title: "Untitled Whiteboard",
    createdBy: createdBy || null,
    members: createdBy ? [createdBy] : [],
    createdAt: new Date(),
    elements: [],
  };
  boards.set(roomId, board);
  await sleep(5000);
  console.log("Done");
  console.log(board);
  return board;
}

// ambil semua board
export function getAllBoards() {
  return Array.from(boards.values());
}

// kalau butuh 1 board by roomId, bisa tambah ini:
export function getBoardById(roomId) {
  return boards.get(roomId) || null;
}

// Fungsi untuk update title
export function updateBoardTitle(roomId, newTitle) {
  const board = boards.get(roomId);
  if (board) {
    board.title = newTitle;
  }
  return board;
}

export function addMember(roomId, userId) {
  const board = boards.get(roomId);
  if (board && userId && !board.members.includes(userId)) {
    board.members.push(userId);
  }
  console.log("*******");
  console.log("Add new member: ", userId);
  console.log("Current boards: ", board);
  console.log("*******");
  return board;
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
