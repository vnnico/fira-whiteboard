import { Board, Roles } from "../models/whiteboardModel.js";
import { isBoardMember } from "../utils/boardMembership.js";

const DEFAULT_ROLE_FOR_NEW_MEMBER = Roles.VIEWER;
const MIN_TIMER_MS = 5 * 60 * 1000;
const MAX_TIMER_MS = 120 * 60 * 1000;

const presenceByRoom = new Map();
const locksByRoom = new Map();

const timerStateByRoom = new Map();
const timerTimeoutByRoom = new Map();

// runtime snapshot role online
const rolesByRoom = new Map();
// runtime snapshot locked flag
const boardLockedByRoom = new Map();

function getRoomRoles(roomId) {
  const rid = String(roomId);
  if (!rolesByRoom.has(rid)) rolesByRoom.set(rid, new Map());
  return rolesByRoom.get(rid);
}

function setRoleForUser(roomId, userId, role) {
  getRoomRoles(roomId).set(String(userId), String(role || Roles.VIEWER));
}

function getRoleForUser(roomId, userId) {
  const m = rolesByRoom.get(String(roomId));
  return m?.get(String(userId)) || Roles.VIEWER;
}

function setBoardLocked(roomId, locked) {
  boardLockedByRoom.set(String(roomId), !!locked);
}
function getBoardLocked(roomId) {
  return !!boardLockedByRoom.get(String(roomId));
}

function getPermissionsForUser(roomId, userId) {
  const rid = String(roomId || "");
  const uid = String(userId || "");
  const role = getRoleForUser(rid, uid);
  const locked = getBoardLocked(rid);
  const canEdit = role === Roles.OWNER || (role === Roles.EDITOR && !locked);
  return { role, canEdit, locked };
}

function getRoomLocks(roomId) {
  const rid = String(roomId);
  if (!locksByRoom.has(rid)) locksByRoom.set(rid, new Map());
  return locksByRoom.get(rid);
}

function getLocksSnapshot(roomId) {
  const m = locksByRoom.get(String(roomId));
  if (!m) return {};
  const out = {};
  for (const [elementId, userId] of m.entries()) {
    out[String(elementId)] = String(userId);
  }
  return out;
}

async function upsertElementInDb(roomId, element) {
  const rid = String(roomId || "");
  const elementId = String(element?.id || "");
  if (!rid || !elementId) return;

  if (element?.isDeleted) {
    await Board.updateOne(
      { roomId: rid },
      {
        $pull: { elements: { id: elementId } },
        $set: { updatedAt: new Date() },
      },
    );
    return;
  }

  const now = new Date();

  const updated = await Board.updateOne(
    { roomId: rid, "elements.id": elementId },
    { $set: { "elements.$": element, updatedAt: now } },
  );

  if ((updated?.matchedCount || 0) === 0) {
    await Board.updateOne(
      { roomId: rid },
      { $push: { elements: element }, $set: { updatedAt: now } },
    );
  }
}

async function clearBoardInDb(roomId) {
  const rid = String(roomId || "");
  if (!rid) return;
  await Board.updateOne(
    { roomId: rid },
    { $set: { elements: [], updatedAt: new Date() } },
  );
}

function releaseAllLocksForUser(io, roomId, userId) {
  const rid = String(roomId || "");
  const uid = String(userId || "");
  if (!rid || !uid) return;

  const roomLocks = locksByRoom.get(rid);
  if (!roomLocks || roomLocks.size === 0) return;

  let changed = false;
  for (const [elementId, owner] of roomLocks.entries()) {
    if (String(owner) === uid) {
      roomLocks.delete(elementId);
      changed = true;

      io.to(rid).emit("element-lock", {
        elementId: String(elementId),
        userId: uid,
        locked: false,
      });
    }
  }

  if (changed && roomLocks.size === 0) locksByRoom.delete(rid);
}

function getSocketById(io, sid) {
  if (io?.sockets && typeof io.sockets.get === "function") {
    return io.sockets.get(sid);
  }
  if (io?.sockets?.sockets && typeof io.sockets.sockets.get === "function") {
    return io.sockets.sockets.get(sid);
  }
  return null;
}

function getRoomPresence(roomId) {
  const rid = String(roomId);
  if (!presenceByRoom.has(rid)) presenceByRoom.set(rid, new Map());
  return presenceByRoom.get(rid);
}

function upsertPresence(roomId, user, socketId) {
  const rid = String(roomId);
  const roomPresence = getRoomPresence(rid);

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
  const rid = String(roomId || "");
  if (!rid || userId === null || userId === undefined) return false;

  const roomPresence = presenceByRoom.get(rid);
  if (!roomPresence) return false;

  const key = String(userId);
  const existing = roomPresence.get(key);
  if (!existing) return false;

  existing.sockets.delete(socketId);

  if (existing.sockets.size === 0) {
    roomPresence.delete(key);
    if (roomPresence.size === 0) presenceByRoom.delete(rid);
    return true;
  }

  return false;
}

function getTimerState(roomId) {
  return (
    timerStateByRoom.get(String(roomId)) || {
      running: false,
      endAt: null,
      durationMs: null,
      startedBy: null,
    }
  );
}

function clearTimerTimeout(roomId) {
  const rid = String(roomId);
  const t = timerTimeoutByRoom.get(rid);
  if (t) clearTimeout(t);
  timerTimeoutByRoom.delete(rid);
}

function broadcastTimerState(io, roomId) {
  const rid = String(roomId);
  const state = getTimerState(rid);
  io.to(rid).emit("timer:state", { roomId: rid, ...state });
}

function stopTimer(io, roomId) {
  const rid = String(roomId);
  clearTimerTimeout(rid);
  timerStateByRoom.set(rid, {
    running: false,
    endAt: null,
    durationMs: null,
    startedBy: null,
  });
  broadcastTimerState(io, rid);
}

function endSessionByTimer(io, roomId) {
  const rid = String(roomId);
  stopTimer(io, rid);
  io.to(rid).emit("session:ended", { roomId: rid, reason: "timer" });
}

function emitRoomMembers(io, roomId) {
  const rid = String(roomId);
  const roomPresence = presenceByRoom.get(rid);

  const members = roomPresence
    ? Array.from(roomPresence.values()).map((m) => {
        const perms = getPermissionsForUser(rid, m.id);
        return {
          id: String(m.id),
          username: m.username,
          online: true,
          role: perms.role,
        };
      })
    : [];

  io.to(rid).emit("room-members", { roomId: rid, members });
}

function emitPermissionsToUser(io, roomId, userId, role, canEdit, locked) {
  const rid = String(roomId);
  const roomPresence = presenceByRoom.get(rid);
  if (!roomPresence) return;

  const target = roomPresence.get(String(userId));
  if (!target) return;

  for (const sid of target.sockets || []) {
    const s = getSocketById(io, sid);
    if (s) {
      s.data.roomId = rid;
      s.data.role = role;
      s.data.canEdit = !!canEdit;
      s.data.locked = !!locked;

      s.emit("room-permissions", { roomId: rid, role, canEdit, locked });
    }
  }
}

function kickUserFromRoom(io, roomId, targetUserId, byUser) {
  const rid = String(roomId);
  const roomPresence = presenceByRoom.get(rid);
  if (!roomPresence) return false;

  const target = roomPresence.get(String(targetUserId));
  if (!target) return false;

  releaseAllLocksForUser(io, rid, String(targetUserId));

  for (const sid of target.sockets || []) {
    const s = getSocketById(io, sid);
    if (s) {
      s.emit("kicked", {
        roomId: rid,
        reason: "Removed by host",
        by: { id: byUser?.id, username: byUser?.username },
      });
      s.disconnect(true);
    }
  }

  roomPresence.delete(String(targetUserId));
  if (roomPresence.size === 0) presenceByRoom.delete(rid);

  emitRoomMembers(io, rid);
  return true;
}

export function registerWhiteboardHandlers(io, socket) {
  const getRoomId = () => String(socket.data?.roomId || "");
  const getUserId = () => String(socket.data?.userId || "");

  const emitPermissionDenied = (action, message = "No permission") => {
    const now = Date.now();
    const last = socket.data?.lastPermissionDeniedAt || 0;
    if (now - last < 1500) return;
    socket.data.lastPermissionDeniedAt = now;
    socket.emit("permission-denied", { action, message });
  };

  socket.on("join-room", async ({ roomId }) => {
    const rid = String(roomId || "");
    if (!rid) return;

    try {
      const board = await Board.findOne({ roomId: rid })
        .select("roomId title createdBy roles locked elements")
        .lean();

      if (!board) {
        socket.emit("board-not-found", { roomId: rid });
        return;
      }

      socket.join(rid);
      socket.data.roomId = rid;

      setBoardLocked(rid, !!board.locked);

      const uid = socket.user?.id ? String(socket.user.id) : null;
      if (uid) {
        socket.data.userId = uid;

        // role resolution
        let role = null;
        if (board.createdBy && String(board.createdBy) === uid) {
          role = Roles.OWNER;
        } else {
          role = board.roles?.[uid] || null;
        }
        if (!role) role = DEFAULT_ROLE_FOR_NEW_MEMBER;

        // persist membership + default role (single write)
        const update = {
          $addToSet: { members: uid },
          $set: { updatedAt: new Date() },
        };
        if (!board.roles?.[uid] && role !== Roles.OWNER) {
          update.$set[`roles.${uid}`] = role;
        }
        await Board.updateOne({ roomId: rid }, update);

        setRoleForUser(rid, uid, role);

        const locked = !!board.locked;
        const canEdit =
          role === Roles.OWNER || (role === Roles.EDITOR && !locked);

        socket.data.role = role;
        socket.data.canEdit = !!canEdit;
        socket.data.locked = locked;

        socket.emit("room-permissions", { roomId: rid, role, canEdit, locked });

        upsertPresence(rid, socket.user, socket.id);
        emitRoomMembers(io, rid);
      }

      socket.emit("whiteboard-state", {
        elements: board.elements || [],
        title: board.title || "Untitled Whiteboard",
        locks: getLocksSnapshot(rid),
      });

      socket.emit("timer:state", { roomId: rid, ...getTimerState(rid) });
    } catch (err) {
      console.error("[whiteboard] join-room:", err?.message || err);
      socket.emit("server-error", {
        roomId: rid,
        action: "join-room",
        message: "Something went wrong",
      });
    }
  });

  socket.on("element-update", async (data) => {
    const { element, isFinal } = data || {};
    const rid = getRoomId();

    if (!rid || !element) return;
    try {
      if (!socket.data?.canEdit) {
        emitPermissionDenied("element-update", "View-only mode");
        return;
      }

      const requesterId = getUserId();
      const roomLocks = locksByRoom.get(rid);
      const lockOwner = roomLocks?.get(String(element.id));
      if (lockOwner && String(lockOwner) !== requesterId) {
        emitPermissionDenied(
          "element-update",
          "Element is locked by another user",
        );
        return;
      }

      socket.to(rid).emit("element-update", { element });

      if (isFinal) {
        // If this update is a delete, also release any lock in server memory.
        if (element?.isDeleted) {
          const roomLocks2 = locksByRoom.get(rid);
          const owner = roomLocks2?.get(String(element.id));
          if (roomLocks2 && owner) {
            roomLocks2.delete(String(element.id));
            if (roomLocks2.size === 0) locksByRoom.delete(rid);

            io.to(rid).emit("element-lock", {
              elementId: String(element.id),
              userId: String(owner),
              locked: false,
            });
          }
        }
        await upsertElementInDb(rid, element);
      }
    } catch (err) {
      console.error("[whiteboard] element-update error:", err?.message || err);

      socket.emit("server-error", {
        roomId: rid,
        action: "element-update",
        message: "Something went wrong",
      });
    }
  });

  socket.on("whiteboard-clear", async ({ isFinal }) => {
    const rid = getRoomId();
    if (!rid) return;
    try {
      if (!socket.data?.canEdit) {
        emitPermissionDenied("whiteboard-clear", "View-only mode");
        return;
      }

      socket.to(rid).emit("whiteboard-clear");

      if (isFinal) {
        await clearBoardInDb(rid);
      }
    } catch (err) {
      console.error(
        "[whiteboard] whiteboard-clear error:",
        err?.message || err,
      );

      socket.emit("server-error", {
        roomId: rid,
        action: "whiteboard-clear",
        message: "Something went wrong",
      });
    }
  });

  socket.on("cursor-position", ({ x, y }) => {
    const rid = getRoomId();
    const uid = getUserId();
    if (!rid || !uid || typeof x !== "number" || typeof y !== "number") return;

    try {
      socket.to(rid).emit("cursor-position", {
        x,
        y,
        userId: uid,
      });
    } catch (err) {
      console.error("[whiteboard] cursor-position error:", err?.message || err);

      socket.emit("server-error", {
        roomId: rid,
        action: "cursor-position",
        message: "Something went wrong",
      });
    }
  });

  socket.on("element-lock", (payload, ack) => {
    const { elementId, locked } = payload || {};
    const rid = getRoomId();
    const uid = getUserId();

    try {
      if (!rid || !elementId || !uid) {
        if (typeof ack === "function")
          ack({ ok: false, reason: "bad-request" });
        return;
      }

      const perms = getPermissionsForUser(rid, uid);
      if (!perms.canEdit) {
        emitPermissionDenied("element-lock", "View-only mode");
        if (typeof ack === "function")
          ack({ ok: false, reason: "no-permission" });
        return;
      }

      const requesterId = uid;
      const roomLocks = getRoomLocks(rid);
      const currentOwner = roomLocks.get(String(elementId));

      if (locked) {
        if (currentOwner && String(currentOwner) !== requesterId) {
          socket.emit("element-lock", {
            elementId: String(elementId),
            userId: String(currentOwner),
            locked: true,
          });
          if (typeof ack === "function") {
            ack({ ok: false, reason: "locked", owner: String(currentOwner) });
          }
          return;
        }

        roomLocks.set(String(elementId), requesterId);
        io.to(rid).emit("element-lock", {
          elementId: String(elementId),
          userId: requesterId,
          locked: true,
        });
        if (typeof ack === "function") ack({ ok: true, owner: requesterId });
        return;
      }

      if (!currentOwner) {
        if (typeof ack === "function") ack({ ok: true, owner: null });
        return;
      }

      if (String(currentOwner) !== requesterId) {
        socket.emit("element-lock", {
          elementId: String(elementId),
          userId: String(currentOwner),
          locked: true,
        });
        if (typeof ack === "function") {
          ack({ ok: false, reason: "not-owner", owner: String(currentOwner) });
        }
        return;
      }

      roomLocks.delete(String(elementId));
      if (roomLocks.size === 0) locksByRoom.delete(rid);

      io.to(rid).emit("element-lock", {
        elementId: String(elementId),
        userId: requesterId,
        locked: false,
      });
      if (typeof ack === "function") ack({ ok: true, owner: null });
    } catch (err) {
      console.error("[whiteboard] element-lock error:", err?.message || err);

      socket.emit("server-error", {
        roomId: rid,
        action: "element-lock",
        message: "Something went wrong",
      });
    }
  });

  socket.on("moderation:kick", ({ targetUserId }) => {
    const rid = getRoomId();
    const uid = getUserId();

    if (!rid || !uid || !targetUserId) return;
    try {
      const perms = getPermissionsForUser(rid, uid);
      if (perms.role !== Roles.OWNER) {
        emitPermissionDenied("moderation:kick", "Only owner can kick");
        return;
      }

      const tid = String(targetUserId);
      if (tid === uid) {
        emitPermissionDenied("moderation:kick", "You cannot kick yourself");
        return;
      }

      const ok = kickUserFromRoom(io, rid, tid, socket.user);
      if (!ok)
        emitPermissionDenied("moderation:kick", "User not found in room");
    } catch (err) {
      console.error("[whiteboard] moderation:kick error:", err?.message || err);

      socket.emit("server-error", {
        roomId: rid,
        action: "moderation:kick",
        message: "Something went wrong",
      });
    }
  });

  socket.on("moderation:set-role", async ({ targetUserId, role }) => {
    const rid = getRoomId();
    const uid = getUserId();
    if (!rid || !uid || !targetUserId || !role) return;

    try {
      if (String(socket.data?.role || Roles.VIEWER) !== Roles.OWNER) {
        emitPermissionDenied(
          "moderation:set-role",
          "Only owner can change roles",
        );
        return;
      }

      const tid = String(targetUserId);
      if (tid === uid) {
        emitPermissionDenied(
          "moderation:set-role",
          "Cannot change your own role",
        );
        return;
      }

      if (role !== Roles.EDITOR && role !== Roles.VIEWER) {
        emitPermissionDenied("moderation:set-role", "Invalid role");
        return;
      }

      const board = await Board.findOne({ roomId: rid })
        .select("roomId createdBy members roles")
        .lean();
      if (!isBoardMember(board, tid)) {
        emitPermissionDenied(
          "moderation:set-role",
          "Target must already be a member",
        );
        return;
      }

      const updated = await Board.updateOne(
        { roomId: rid },
        {
          $addToSet: { members: tid },
          $set: { [`roles.${tid}`]: role, updatedAt: new Date() },
        },
      );

      if ((updated?.matchedCount || 0) === 0) {
        socket.emit("board-not-found", { roomId: rid });
        return;
      }

      setRoleForUser(rid, tid, role);
      emitRoomMembers(io, rid);

      const locked = getBoardLocked(rid);
      const canEdit =
        role === Roles.OWNER || (role === Roles.EDITOR && !locked);
      emitPermissionsToUser(io, rid, tid, role, canEdit, locked);
    } catch (err) {
      console.error(
        "[whiteboard] moderation:set-role error:",
        err?.message || err,
      );

      socket.emit("server-error", {
        roomId: rid,
        action: "moderation:set-role",
        message: "Something went wrong",
      });
    }
  });

  socket.on("timer:start", ({ durationMs }) => {
    const rid = getRoomId();
    const uid = getUserId();
    if (!rid || !uid) return;

    try {
      const ms = Number(durationMs);
      if (!Number.isFinite(ms) || ms < MIN_TIMER_MS || ms > MAX_TIMER_MS) {
        emitPermissionDenied("timer:start", "Invalid duration");
        return;
      }

      const perms = getPermissionsForUser(rid, uid);
      if (!perms || perms.role !== Roles.OWNER) {
        emitPermissionDenied("timer:start", "Only owner can start timer");
        return;
      }

      const current = getTimerState(rid);
      if (current.running) return;

      const endAt = Date.now() + ms;

      clearTimerTimeout(rid);
      timerStateByRoom.set(rid, {
        running: true,
        endAt,
        durationMs: ms,
        startedBy: uid,
      });

      broadcastTimerState(io, rid);
      io.to(rid).emit("timer:action", {
        roomId: rid,
        action: "start",
        actorUserId: uid,
        durationMs: ms,
      });

      const timeout = setTimeout(() => endSessionByTimer(io, rid), ms);
      timerTimeoutByRoom.set(rid, timeout);
    } catch (err) {
      console.error("[whiteboard] time:start error:", err?.message || err);

      socket.emit("server-error", {
        roomId: rid,
        action: "time:start",
        message: "Something went wrong",
      });
    }
  });

  socket.on("timer:stop", () => {
    const rid = getRoomId();
    const uid = getUserId();
    if (!rid || !uid) return;

    try {
      const perms = getPermissionsForUser(rid, uid);
      if (!perms || perms.role !== Roles.OWNER) {
        emitPermissionDenied("timer:stop", "Only owner can stop timer");
        return;
      }

      stopTimer(io, rid);
      io.to(rid).emit("timer:action", {
        roomId: rid,
        action: "stop",
        actorUserId: uid,
      });
    } catch (err) {
      console.error("[whiteboard] time:stop error:", err?.message || err);

      socket.emit("server-error", {
        roomId: rid,
        action: "time:stop",
        message: "Something went wrong",
      });
    }
  });

  socket.on("timer:reset", () => {
    const rid = getRoomId();
    const uid = getUserId();
    if (!rid || !uid) return;

    try {
      const perms = getPermissionsForUser(rid, uid);
      if (!perms || perms.role !== Roles.OWNER) {
        emitPermissionDenied("timer:reset", "Only owner can reset timer");
        return;
      }

      stopTimer(io, rid);
      io.to(rid).emit("timer:action", {
        roomId: rid,
        action: "reset",
        actorUserId: uid,
      });
    } catch (err) {
      console.error("[whiteboard] timer:reset error:", err?.message || err);

      socket.emit("server-error", {
        roomId: rid,
        action: "timer:reset",
        message: "Something went wrong",
      });
    }
  });

  socket.on("disconnect", () => {
    const rid = String(socket.data?.roomId || "");
    if (!rid) return;

    const userId = socket.data?.userId ?? socket.user?.id;
    if (userId) {
      releaseAllLocksForUser(io, rid, userId);
    }

    const presenceUserId = socket.data?.userId;
    if (presenceUserId) {
      removePresence(rid, presenceUserId, socket.id);
      emitRoomMembers(io, rid);
    }

    const roomPresence = presenceByRoom.get(rid);
    if (!roomPresence || roomPresence.size === 0) {
      stopTimer(io, rid);

      locksByRoom.delete(rid);
      rolesByRoom.delete(rid);
      boardLockedByRoom.delete(rid);
      timerStateByRoom.delete(rid);
      timerTimeoutByRoom.delete(rid);
    }

    io.to(rid).emit("user-disconnected", {
      userId: String(userId ?? socket.id),
      socketId: socket.id,
    });
  });
}
