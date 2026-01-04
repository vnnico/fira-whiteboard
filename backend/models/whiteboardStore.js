// Udah ga pake lagi

import { randomUUID } from "crypto";
import { Board, Roles as RoleEnum } from "./whiteboardModel.js";

const boards = new Map();
const persistQueueByRoom = new Map();

export const Roles = RoleEnum;

const DEFAULT_ROLE_FOR_NEW_MEMBER = Roles.EDITOR;

function normalizeBoard(raw) {
  if (!raw) return null;

  const board = {
    roomId: String(raw.roomId),
    title: raw.title || "Untitled Whiteboard",
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
    members: Array.isArray(raw.members) ? raw.members.map(String) : [],
    roles: raw.roles && typeof raw.roles === "object" ? raw.roles : {},
    locked: typeof raw.locked === "boolean" ? raw.locked : false,
    elements: Array.isArray(raw.elements) ? raw.elements : [],
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
  };

  const normRoles = {};
  for (const [k, v] of Object.entries(board.roles || {})) {
    normRoles[String(k)] = v;
  }
  board.roles = normRoles;

  return board;
}

function touch(board) {
  board.updatedAt = new Date();
}

async function persistBoardNow(board) {
  const doc = {
    roomId: board.roomId,
    title: board.title,
    createdBy: board.createdBy,
    members: board.members,
    roles: board.roles,
    locked: board.locked,
    elements: board.elements,
    schemaVersion: 1,
    updatedAt: board.updatedAt,
  };

  await Board.updateOne(
    { roomId: board.roomId },
    {
      $set: doc,
      $setOnInsert: { createdAt: board.createdAt },
    },
    { upsert: true }
  );
}

function schedulePersist(board) {
  const rid = board?.roomId;
  if (!rid) return;

  const prev = persistQueueByRoom.get(rid) || Promise.resolve();
  const next = prev
    .then(() => persistBoardNow(board))
    .catch((err) => console.error("[whiteboardStore] persist error:", err));

  persistQueueByRoom.set(rid, next);
}

// startup loader
export async function initWhiteboardStore() {
  const docs = await Board.find({}).lean();
  for (const doc of docs) {
    const b = normalizeBoard(doc);
    if (b?.roomId) boards.set(b.roomId, b);
  }
  console.log(`[whiteboardStore] loaded boards from DB: ${boards.size}`);
}

export async function createBoard({ createdBy }) {
  const roomId = randomUUID();
  const ownerId = createdBy ? String(createdBy) : null;
  const now = new Date();

  const board = normalizeBoard({
    roomId,
    title: "Untitled Whiteboard",
    createdBy: ownerId,
    members: ownerId ? [ownerId] : [],
    roles: ownerId ? { [ownerId]: Roles.OWNER } : {},
    locked: false,
    elements: [],
    createdAt: now,
    updatedAt: now,
  });

  boards.set(roomId, board);
  await persistBoardNow(board);
  return board;
}

export function getAllBoards() {
  return Array.from(boards.values());
}

export function getBoardById(roomId) {
  return boards.get(String(roomId || "")) || null;
}

export async function loadBoardFromDb(roomId) {
  const rid = String(roomId || "");
  if (!rid) return null;

  const doc = await Board.findOne({ roomId: rid }).lean();
  if (!doc) return null;

  const b = normalizeBoard(doc);
  boards.set(rid, b);
  return b;
}

export function updateBoardTitle(roomId, newTitle) {
  const board = getExistingBoard(roomId);
  if (!board) return null;

  board.title = newTitle || "Untitled Whiteboard";
  touch(board);
  schedulePersist(board);
  return board;
}

function getExistingBoard(roomId) {
  return boards.get(String(roomId)) || null;
}

export function addMember(roomId, userId) {
  const board = getExistingBoard(roomId);
  if (!board || !userId) return board;

  const uid = String(userId);
  if (!board.members.includes(uid)) board.members.push(uid);

  ensureRoleForUser(roomId, uid);

  touch(board);
  schedulePersist(board);
  return board;
}

// keep for “remove permanently”, jangan dipakai untuk disconnect/kick
export function removeMemberAndRole(roomId, userId) {
  const board = getExistingBoard(roomId);
  if (!board || userId === null || userId === undefined) return board;

  const uid = String(userId);
  if (board.createdBy && String(board.createdBy) === uid) return board;

  board.members = (board.members || []).filter((m) => String(m) !== uid);
  if (board.roles && board.roles[uid]) delete board.roles[uid];

  touch(board);
  schedulePersist(board);
  return board;
}

export function ensureRoleForUser(roomId, userId) {
  const board = getExistingBoard(roomId);
  if (!board) return { role: Roles.VIEWER, canEdit: false, locked: false };

  const uid = userId ? String(userId) : "";
  if (!uid)
    return { role: Roles.VIEWER, canEdit: false, locked: !!board.locked };

  if (board.createdBy && String(board.createdBy) === uid) {
    board.roles[uid] = Roles.OWNER;
    if (!board.members.includes(uid)) board.members.push(uid);
    touch(board);
    schedulePersist(board);
    return getPermissionsForUser(roomId, uid);
  }

  if (!board.roles[uid]) board.roles[uid] = DEFAULT_ROLE_FOR_NEW_MEMBER;
  if (!board.members.includes(uid)) board.members.push(uid);

  touch(board);
  schedulePersist(board);
  return getPermissionsForUser(roomId, uid);
}

export function getUserRole(roomId, userId) {
  const board = getExistingBoard(roomId);
  if (!board) return Roles.VIEWER;

  const uid = userId ? String(userId) : "";
  if (!uid) return Roles.VIEWER;

  if (board.createdBy && String(board.createdBy) === uid) return Roles.OWNER;
  return board.roles?.[uid] || DEFAULT_ROLE_FOR_NEW_MEMBER;
}

export function getPermissionsForUser(roomId, userId) {
  const board = getExistingBoard(roomId);
  if (!board) return { role: Roles.VIEWER, canEdit: false, locked: false };

  const role = getUserRole(roomId, userId);
  const locked = !!board.locked;
  const canEdit = role === Roles.OWNER || (role === Roles.EDITOR && !locked);

  return { role, canEdit, locked };
}

export function setUserRole(roomId, targetUserId, role) {
  const board = getExistingBoard(roomId);
  if (!board || !targetUserId) return board;

  const tid = String(targetUserId);
  if (board.createdBy && String(board.createdBy) === tid) {
    board.roles[tid] = Roles.OWNER;
    touch(board);
    schedulePersist(board);
    return board;
  }

  const valid = Object.values(Roles).includes(role);
  if (!valid) return board;

  board.roles[tid] = role;
  if (!board.members.includes(tid)) board.members.push(tid);

  touch(board);
  schedulePersist(board);
  return board;
}

export function setBoardLocked(roomId, locked) {
  const board = getExistingBoard(roomId);
  if (!board) return null;

  board.locked = !!locked;
  touch(board);
  schedulePersist(board);
  return board;
}

export function upsertElement(roomId, element) {
  const board = getExistingBoard(roomId);
  if (!board || !element?.id) return board;

  const idx = board.elements.findIndex((el) => el?.id === element.id);
  if (idx === -1) board.elements.push(element);
  else board.elements[idx] = element;

  touch(board);
  schedulePersist(board);
  return board;
}

export function clearBoard(roomId) {
  const board = getExistingBoard(roomId);
  if (!board) return null;

  board.elements = [];
  touch(board);
  schedulePersist(board);
  return board;
}

export async function deleteBoard(roomId) {
  const rid = String(roomId || "");
  if (!rid) return false;

  boards.delete(rid);
  persistQueueByRoom.delete(rid);

  // remove from DB
  const result = await Board.deleteOne({ roomId: rid });
  return (result?.deletedCount || 0) > 0;
}
