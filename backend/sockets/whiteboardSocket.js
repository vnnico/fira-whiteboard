import {
  getAllBoards,
  upsertElement,
  clearBoard,
  getBoardById,
  addMember,
  ensureRoleForUser,
  getPermissionsForUser,
  setUserRole,
} from "../models/whiteboardStore.js";

// In-memory room presence tracking.
// This lets us show "who is in the room" even if they never join voice.
// roomId -> userId -> { id, username, sockets: Set<socketId> }
const presenceByRoom = new Map();

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
  }

  if (roomPresence.size === 0) {
    presenceByRoom.delete(roomId);
  }
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
  roomPresence.delete(targetUserId);
  if (roomPresence.size === 0) presenceByRoom.delete(roomId);

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
    if (!roomId) return;

    socket.join(roomId);
    socket.data.roomId = roomId;
    const count = await io.in(roomId).fetchSockets();

    console.log(`A user :${socket.user.username} just joined room : ${roomId}`);
    console.log(
      `Now room :${roomId} has total number of ${count.length}connected users `
    );
    console.log("==========");

    if (socket.user && socket.user.id) {
      addMember(roomId, socket.user.id);

      // ensure role & send permission snapshot
      ensureRoleForUser(roomId, socket.user.id);
      const perms = getPermissionsForUser(roomId, socket.user.id);

      socket.emit("room-permissions", {
        roomId,
        role: perms.role,
        canEdit: perms.canEdit,
        locked: perms.locked,
      });

      // Track room presence (untuk participant list UI)
      socket.data.userId = String(socket.user.id);
      upsertPresence(roomId, socket.user, socket.id);
      emitRoomMembers(io, roomId);
    }

    const board = getBoardById(roomId);

    // Kirim elements + title
    socket.emit("whiteboard-state", {
      elements: board?.elements || [],
      title: board?.title || "Untitled Whiteboard",
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
      userId: socket.id,
    });
  });

  socket.on("element-lock", ({ roomId, elementId, userId, locked }) => {
    const resolvedRoomId = getRoomId(roomId);
    if (!resolvedRoomId || !elementId) return;

    const perms = getPermissionsForUser(resolvedRoomId, socket.user?.id);
    if (!perms.canEdit) {
      emitPermissionDenied("element-lock", "View-only mode");
      return;
    }

    socket.to(resolvedRoomId).emit("element-lock", {
      elementId,
      userId,
      locked: !!locked,
    });
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

    // Update room presence list
    const userId = socket.data?.userId;
    if (userId) {
      removePresence(roomId, userId, socket.id);
      emitRoomMembers(io, roomId);
    }

    io.to(roomId).emit("user-disconnected", { userId: socket.id });
  });
}
