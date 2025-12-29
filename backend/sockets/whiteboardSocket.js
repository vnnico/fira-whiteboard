import {
  getAllBoards,
  upsertElement,
  clearBoard,
  getBoardById,
  addMember,
  ensureRoleForUser,
  getPermissionsForUser,
  setUserRole,
  loadBoardFromDb,
  removeMemberAndRole,
} from "../models/whiteboardStore.js";

import { recordMemberJoin } from "../models/whiteboardModel.js";

// In-memory room presence tracking.
// This lets us show "who is in the room" even if they never join voice.
// roomId -> userId -> { id, username, sockets: Set<socketId> }
const presenceByRoom = new Map();
const locksByRoom = new Map();

function getRoomLocks(roomId) {
  if (!locksByRoom.has(roomId)) {
    locksByRoom.set(roomId, new Map());
  }
  return locksByRoom.get(roomId);
}

function getLocksSnapshot(roomId) {
  const m = locksByRoom.get(roomId);
  if (!m) return {};
  const out = {};
  for (const [elementId, userId] of m.entries()) {
    out[elementId] = String(userId);
  }
  return out;
}

function releaseAllLocksForUser(io, roomId, userId) {
  if (!roomId || userId === null || userId === undefined) return;
  const uid = String(userId);

  const roomLocks = locksByRoom.get(roomId);
  if (!roomLocks || roomLocks.size === 0) return;

  let changed = false;
  for (const [elementId, owner] of roomLocks.entries()) {
    if (String(owner) === uid) {
      roomLocks.delete(elementId);
      changed = true;

      io.to(roomId).emit("element-lock", {
        elementId,
        userId: uid,
        locked: false,
      });
    }
  }

  if (changed && roomLocks.size === 0) {
    locksByRoom.delete(roomId);
  }
}
function getSocketById(io, sid) {
  // Namespace: io.sockets is a Map
  if (io?.sockets && typeof io.sockets.get === "function") {
    return io.sockets.get(sid);
  }
  // Server: io.sockets is Namespace, with sockets Map
  if (io?.sockets?.sockets && typeof io.sockets.sockets.get === "function") {
    return io.sockets.sockets.get(sid);
  }
  return null;
}

function getRoomPresence(roomId) {
  if (!presenceByRoom.has(roomId)) {
    presenceByRoom.set(roomId, new Map());
  }
  return presenceByRoom.get(roomId);
}

function upsertPresence(roomId, user, socketId) {
  const roomPresence = getRoomPresence(roomId);
  const userId = user?.id;
  if (userId === null || userId === undefined) return;

  const key = String(userId);

  const existing = roomPresence.get(key);
  if (!existing) {
    roomPresence.set(key, {
      id: key,
      username: user?.username || "Unknown",
      sockets: new Set([socketId]),
    });
    return;
  }

  existing.username = user?.username || existing.username;
  existing.sockets.add(socketId);
}

function removePresence(roomId, userId, socketId) {
  if (!roomId || userId === null || userId === undefined) return;

  const roomPresence = presenceByRoom.get(roomId);
  if (!roomPresence) return;

  const key = String(userId);

  const existing = roomPresence.get(key);
  if (!existing) return;

  existing.sockets.delete(socketId);
  if (existing.sockets.size === 0) {
    roomPresence.delete(key);

    if (roomPresence.size === 0) {
      presenceByRoom.delete(roomId);
    }

    return true; // user fully removed
  }

  return false; // user masih punya socket lain
}

function emitRoomMembers(io, roomId) {
  const roomPresence = presenceByRoom.get(roomId);
  const members = roomPresence
    ? Array.from(roomPresence.values()).map((m) => {
        const perms = getPermissionsForUser(roomId, m.id);
        return {
          id: String(m.id),
          username: m.username,
          online: true,
          role: perms.role,
        };
      })
    : [];

  io.to(roomId).emit("room-members", { roomId, members });
}

function kickUserFromRoom(io, roomId, targetUserId, byUser) {
  const roomPresence = presenceByRoom.get(roomId);
  if (!roomPresence) return false;

  const target = roomPresence.get(String(targetUserId));
  if (!target) return false;

  // Release any element locks held by the target user before disconnecting.
  releaseAllLocksForUser(io, roomId, String(targetUserId));

  // Emit kicked ke semua socket milik user tsb, lalu disconnect
  for (const sid of target.sockets || []) {
    const s = getSocketById(io, sid);

    if (s) {
      s.emit("kicked", {
        roomId,
        reason: "Removed by host",
        by: { id: byUser?.id, username: byUser?.username },
      });
      s.disconnect(true);
    }
  }

  // Bersihkan presence map
  roomPresence.delete(String(targetUserId));
  if (roomPresence.size === 0) presenceByRoom.delete(roomId);

  // Cleanup role
  // removeMemberAndRole(roomId, String(targetUserId));

  // Broadcast member list update
  emitRoomMembers(io, roomId);
  return true;
}

function emitPermissionsToUser(io, roomId, userId, role, canEdit, locked) {
  const roomPresence = presenceByRoom.get(roomId);
  if (!roomPresence) return;

  const target = roomPresence.get(String(userId));
  if (!target) return;

  for (const sid of target.sockets || []) {
    const s = getSocketById(io, sid);
    if (s) {
      s.emit("room-permissions", { roomId, role, canEdit, locked });
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function registerWhiteboardHandlers(io, socket) {
  // Helper: dapatkan roomId dari payload atau dari socket.data
  const getRoomId = (roomId) => roomId ?? socket.data?.roomId;

  const emitPermissionDenied = (action, message = "No permission") => {
    const now = Date.now();
    const last = socket.data?.lastPermissionDeniedAt || 0;
    if (now - last < 1500) return; // rate limit
    socket.data.lastPermissionDeniedAt = now;
    socket.emit("permission-denied", { action, message });
  };

  // Handshake: user join ke room tertentu
  socket.on("join-room", async ({ roomId }) => {
    const rid = String(roomId || "");
    if (!rid) return;

    let board = getBoardById(rid);
    if (!board) {
      board = await loadBoardFromDb(rid);
    }

    if (!board) {
      // jangan join room, jangan persist join, jangan kirim whiteboard-state kosong
      socket.emit("board-not-found", { roomId: rid });
      return;
    }

    socket.join(rid);
    socket.data.roomId = rid;

    // Update membership/role + persist join history (board sudah pasti ada)
    if (socket.user && socket.user.id) {
      const uid = String(socket.user.id);

      addMember(rid, uid);
      ensureRoleForUser(rid, uid);

      // Persist "pernah join" (harus return true karena board valid)
      const ok = await recordMemberJoin(rid, uid);
      if (!ok) {
        // extremely defensive: kalau DB gagal/board hilang, jangan lanjut hydrate
        socket.emit("board-not-found", { roomId: rid });
        return;
      }

      const perms = getPermissionsForUser(rid, uid);
      socket.emit("room-permissions", {
        roomId: rid,
        role: perms.role,
        canEdit: perms.canEdit,
        locked: perms.locked,
      });

      socket.data.userId = uid;
      upsertPresence(rid, socket.user, socket.id);
      emitRoomMembers(io, rid);
    }

    // Hydration state (board valid)
    const locks = getLocksSnapshot(rid);
    socket.emit("whiteboard-state", {
      elements: board.elements || [],
      title: board.title || "Untitled Whiteboard",
      locks,
    });
  });

  socket.on("title-update", ({ roomId, title }) => {
    socket.to(roomId).emit("title-update", { title });
  });

  socket.on("element-update", (data) => {
    const { roomId, element, isFinal } = data || {};
    const resolvedRoomId = getRoomId(roomId);
    if (!resolvedRoomId || !element) return;

    const perms = getPermissionsForUser(resolvedRoomId, socket.user?.id);
    if (!perms.canEdit) {
      emitPermissionDenied("element-update", "View-only mode");
      return;
    }

    const requesterId = String(socket.user?.id ?? "");
    const roomLocks = locksByRoom.get(resolvedRoomId);
    const lockOwner = roomLocks?.get(String(element.id));

    if (lockOwner && String(lockOwner) !== requesterId) {
      emitPermissionDenied(
        "element-update",
        "Element is locked by another user"
      );
      return;
    }

    socket.to(resolvedRoomId).emit("element-update", { element });

    if (isFinal) {
      upsertElement(resolvedRoomId, element);
    }
  });

  socket.on("whiteboard-clear", ({ roomId, isFinal }) => {
    const resolvedRoomId = getRoomId(roomId);
    if (!resolvedRoomId) return;

    const perms = getPermissionsForUser(resolvedRoomId, socket.user?.id);
    if (!perms.canEdit) {
      emitPermissionDenied("whiteboard-clear", "View-only mode");
      return;
    }

    socket.to(resolvedRoomId).emit("whiteboard-clear");

    if (isFinal) {
      clearBoard(resolvedRoomId);
    }
  });

  socket.on("cursor-position", ({ roomId, x, y }) => {
    const resolvedRoomId = getRoomId(roomId);
    if (!resolvedRoomId || typeof x !== "number" || typeof y !== "number")
      return;

    socket.to(resolvedRoomId).emit("cursor-position", {
      x,
      y,
      userId: String(socket.user?.id ?? socket.data?.userId ?? socket.id),
      username: socket.user?.username || "Unknown",
    });
  });

  socket.on("element-lock", (payload, ack) => {
    const { roomId, elementId, locked } = payload || {};
    const resolvedRoomId = getRoomId(roomId);
    if (!resolvedRoomId || !elementId) {
      if (typeof ack === "function") ack({ ok: false, reason: "bad-request" });
      return;
    }

    const perms = getPermissionsForUser(resolvedRoomId, socket.user?.id);
    if (!perms.canEdit) {
      emitPermissionDenied("element-lock", "View-only mode");
      if (typeof ack === "function")
        ack({ ok: false, reason: "no-permission" });
      return;
    }

    const requesterId = String(socket.user?.id ?? socket.data?.userId ?? "");
    const roomLocks = getRoomLocks(resolvedRoomId);
    const currentOwner = roomLocks.get(String(elementId));

    // Acquire lock
    if (locked) {
      if (currentOwner && String(currentOwner) !== requesterId) {
        // Someone else already owns it. Sync requester to the current owner.
        socket.emit("element-lock", {
          elementId,
          userId: String(currentOwner),
          locked: true,
        });
        if (typeof ack === "function") {
          ack({ ok: false, reason: "locked", owner: String(currentOwner) });
        }
        return;
      }

      roomLocks.set(String(elementId), requesterId);
      io.to(resolvedRoomId).emit("element-lock", {
        elementId,
        userId: requesterId,
        locked: true,
      });
      if (typeof ack === "function") ack({ ok: true, owner: requesterId });
      return;
    }

    // Release lock
    if (!currentOwner) {
      if (typeof ack === "function") ack({ ok: true, owner: null });
      return;
    }

    if (String(currentOwner) !== requesterId) {
      socket.emit("element-lock", {
        elementId,
        userId: String(currentOwner),
        locked: true,
      });
      if (typeof ack === "function") {
        ack({ ok: false, reason: "not-owner", owner: String(currentOwner) });
      }
      return;
    }

    roomLocks.delete(String(elementId));
    if (roomLocks.size === 0) locksByRoom.delete(resolvedRoomId);

    io.to(resolvedRoomId).emit("element-lock", {
      elementId,
      userId: requesterId,
      locked: false,
    });
    if (typeof ack === "function") ack({ ok: true, owner: null });
  });

  socket.on("moderation:kick", ({ roomId, targetUserId }) => {
    const resolvedRoomId = getRoomId(roomId);
    if (!resolvedRoomId || !targetUserId) return;

    // Only OWNER can kick
    const perms = getPermissionsForUser(resolvedRoomId, socket.user?.id);
    if (perms.role !== "OWNER") {
      emitPermissionDenied("moderation:kick", "Only owner can kick");
      return;
    }

    const tid = String(targetUserId);
    const selfId = String(socket.user?.id);

    // Prevent self-kick
    if (tid === selfId) {
      emitPermissionDenied("moderation:kick", "You cannot kick yourself");
      return;
    }

    const ok = kickUserFromRoom(io, resolvedRoomId, tid, socket.user);
    if (!ok) {
      socket.emit("permission-denied", {
        action: "moderation:kick",
        message: "User not found in room",
      });
    }
  });
  socket.on("moderation:set-role", ({ roomId, targetUserId, role }) => {
    const resolvedRoomId = getRoomId(roomId);
    if (!resolvedRoomId || !targetUserId || !role) return;

    // Only OWNER can set roles
    const myPerms = getPermissionsForUser(resolvedRoomId, socket.user?.id);
    if (myPerms.role !== "OWNER") {
      emitPermissionDenied(
        "moderation:set-role",
        "Only owner can change roles"
      );
      return;
    }

    const tid = String(targetUserId);
    const selfId = String(socket.user?.id);

    // Don't allow changing self role here (avoid edge cases)
    if (tid === selfId) {
      emitPermissionDenied(
        "moderation:set-role",
        "Cannot change your own role"
      );
      return;
    }

    // Only allow EDITOR or VIEWER (keep OWNER single)
    if (role !== "EDITOR" && role !== "VIEWER") {
      emitPermissionDenied("moderation:set-role", "Invalid role");
      return;
    }

    // persist role in store
    setUserRole(resolvedRoomId, tid, role);

    // refresh list for everyone
    emitRoomMembers(io, resolvedRoomId);

    // push permission update to target
    const perms = getPermissionsForUser(resolvedRoomId, tid);
    emitPermissionsToUser(
      io,
      resolvedRoomId,
      tid,
      perms.role,
      perms.canEdit,
      perms.locked
    );
  });

  socket.on("disconnect", () => {
    const roomId = getRoomId();
    if (!roomId) return;

    // Release any element locks held by this user in the room.
    const userId = socket.data?.userId ?? socket.user?.id;
    if (userId) {
      releaseAllLocksForUser(io, roomId, userId);
    }

    // Update room presence list
    const presenceUserId = socket.data?.userId;
    if (presenceUserId) {
      const fullyLeft = removePresence(roomId, presenceUserId, socket.id);

      // Cleanup role & membership HANYA kalau user benar-benar keluar (socket terakhir)
      // if (fullyLeft) {
      //   removeMemberAndRole(roomId, presenceUserId);
      // }

      emitRoomMembers(io, roomId);
    }

    // Use app userId for lock cleanup on clients; also include socketId for compatibility.
    io.to(roomId).emit("user-disconnected", {
      userId: String(userId ?? socket.id),
      socketId: socket.id,
    });
  });
}
