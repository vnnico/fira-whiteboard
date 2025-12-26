// src/models/whiteboardStore.js
import { randomUUID } from "crypto";

const boards = new Map();
// key: roomId, value: { roomId, createdBy, createdAt, elements: [] }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const Roles = Object.freeze({
  OWNER: "OWNER",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
});

const DEFAULT_ROLE_FOR_NEW_MEMBER = Roles.VIEWER;

function ensureBoard(roomId) {
  let board = boards.get(roomId);

  if (!board) {
    board = {
      roomId,
      title: "Untitled Whiteboard",
      createdBy: null,
      members: [],
      createdAt: new Date(),
      elements: [],
      roles: {},
      locked: false,
    };
    boards.set(roomId, board);
  }

  if (!board.title) board.title = "Untitled Whiteboard";
  if (!Array.isArray(board.members)) board.members = [];
  if (!Array.isArray(board.elements)) board.elements = [];
  if (!board.roles || typeof board.roles !== "object") board.roles = {};
  if (typeof board.locked !== "boolean") board.locked = false;

  return board;
}
export async function createBoard({ createdBy }) {
  const roomId = randomUUID();
  const ownerId = createdBy ? String(createdBy) : null;

  await sleep(5000);

  console.log("Creating board...");
  const board = {
    roomId,
    title: "Untitled Whiteboard",
    createdBy: createdBy || null,
    members: createdBy ? [createdBy] : [],
    createdAt: new Date(),
    elements: [],
    roles: ownerId ? { [ownerId]: Roles.OWNER } : {},
    locked: false,
  };
  boards.set(roomId, board);
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
  const board = ensureBoard(roomId);
  if (!userId) return board;

  if (!board.members.includes(userId)) {
    board.members.push(userId);
  }

  // ensure role
  ensureRoleForUser(roomId, userId);

  console.log("*******");
  console.log("Add new member: ", userId);
  console.log("Current boards: ", board);
  console.log("*******");
  return board;
}

export function removeMemberAndRole(roomId, userId) {
  const board = ensureBoard(roomId);
  if (!userId) return board;

  const uid = String(userId);

  // Jangan hapus OWNER (createdBy)
  if (board.createdBy && String(board.createdBy) === uid) {
    return board;
  }

  // Hapus dari members
  board.members = (board.members || []).filter((m) => String(m) !== uid);

  // Hapus role agar reset ke default saat join lagi
  if (board.roles && board.roles[uid]) {
    delete board.roles[uid];
  }

  return board;
}

/**
 * Pastikan user punya role di board:
 * - createdBy => OWNER
 * - selain itu default VIEWER (minimal untuk demo)
 */
export function ensureRoleForUser(roomId, userId) {
  const board = ensureBoard(roomId);
  if (!userId)
    return { role: Roles.VIEWER, canEdit: false, locked: !!board.locked };

  const uid = String(userId);

  // owner normalization
  if (board.createdBy && String(board.createdBy) === uid) {
    board.roles[uid] = Roles.OWNER;
    if (!board.members.includes(userId)) board.members.push(userId);
    return getPermissionsForUser(roomId, userId);
  }

  if (!board.roles[uid]) {
    board.roles[uid] = DEFAULT_ROLE_FOR_NEW_MEMBER;
  }

  if (!board.members.includes(userId)) board.members.push(userId);

  return getPermissionsForUser(roomId, userId);
}

export function getUserRole(roomId, userId) {
  const board = ensureBoard(roomId);
  if (!userId) return Roles.VIEWER;

  const uid = String(userId);
  if (board.createdBy && String(board.createdBy) === uid) return Roles.OWNER;

  return board.roles?.[uid] || DEFAULT_ROLE_FOR_NEW_MEMBER;
}

export function getPermissionsForUser(roomId, userId) {
  const board = ensureBoard(roomId);
  const role = getUserRole(roomId, userId);
  const locked = !!board.locked;

  const canEdit = role === Roles.OWNER || (role === Roles.EDITOR && !locked);

  return { role, canEdit, locked };
}

export function setUserRole(roomId, targetUserId, role) {
  const board = ensureBoard(roomId);
  if (!targetUserId) return board;

  const tid = String(targetUserId);

  // jangan pernah downgrade owner
  if (board.createdBy && String(board.createdBy) === tid) {
    board.roles[tid] = Roles.OWNER;
    return board;
  }

  const valid = Object.values(Roles).includes(role);
  if (!valid) return board;

  board.roles[tid] = role;
  if (!board.members.includes(targetUserId)) board.members.push(targetUserId);
  return board;
}

export function setBoardLocked(roomId, locked) {
  const board = ensureBoard(roomId);
  board.locked = !!locked;
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
