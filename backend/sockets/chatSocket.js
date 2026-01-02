import { Board, Roles } from "../models/whiteboardModel.js";
import { ChatMessage } from "../models/chatMessageModel.js";

const MAX_HISTORY = 50;
const DEFAULT_ROLE_FOR_NEW_MEMBER = Roles.EDITOR;

const typingByRoom = new Map();

function getTypingMap(roomId) {
  const rid = String(roomId || "");
  if (!typingByRoom.has(rid)) typingByRoom.set(rid, new Map());
  return typingByRoom.get(rid);
}

function pruneTypingMap(roomId, maxIdleMs = 8000) {
  const rid = String(roomId || "");
  const m = typingByRoom.get(rid);
  if (!m || m.size === 0) return;

  const now = Date.now();
  for (const [uid, v] of m.entries()) {
    if (!v?.lastTs || now - v.lastTs > maxIdleMs) {
      m.delete(uid);
    }
  }

  if (m.size === 0) typingByRoom.delete(rid);
}

async function ensureBoardExistsAndMember(roomId, userId) {
  const rid = String(roomId || "");
  const uid = String(userId || "");
  if (!rid || !uid) return { ok: false, code: "bad-request" };

  const board = await Board.findOne({ roomId: rid })
    .select("roomId createdBy members roles")
    .lean();

  if (!board) return { ok: false, code: "board-not-found" };

  const update = {
    $addToSet: { members: uid },
    $set: { updatedAt: new Date() },
  };

  const isOwner = board.createdBy && String(board.createdBy) === uid;
  const hasRole = !!board.roles?.[uid];
  if (!isOwner && !hasRole) {
    update.$set[`roles.${uid}`] = DEFAULT_ROLE_FOR_NEW_MEMBER;
  }

  await Board.updateOne({ roomId: rid }, update);
  return { ok: true, board };
}

function mapMessage(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    roomId: String(doc.roomId),
    text: doc.text,
    sender: {
      id: String(doc.senderId),
      username: doc.senderUsername,
    },
    clientMessageId: doc.clientMessageId || null,
    createdAt: doc.createdAt,
  };
}

export function registerChatHandlers(io, socket) {
  const getRoomId = (roomId) => String(roomId ?? socket.data?.roomId ?? "");
  const userId = () => String(socket.user?.id ?? "");
  const username = () => String(socket.user?.username ?? "Unknown");

  socket.on("join-room", async ({ roomId }) => {
    const rid = String(roomId || "");
    if (!rid) return;

    try {
      const res = await ensureBoardExistsAndMember(rid, userId());
      if (!res.ok) {
        if (res.code === "board-not-found") {
          socket.emit("board-not-found", { roomId: rid });
        }
        return;
      }

      socket.join(rid);
      socket.data.roomId = rid;

      const docs = await ChatMessage.find({ roomId: rid })
        .sort({ createdAt: -1 })
        .limit(MAX_HISTORY)
        .lean();

      const messages = docs.reverse().map(mapMessage).filter(Boolean);

      socket.emit("chat:history", { roomId: rid, messages });
    } catch (err) {
      console.error("[chat] join-room:", err?.message || err);
      socket.emit("server-error", {
        roomId: rid,
        action: "join-room",
        message: "Something went wrong",
      });
    }
  });

  socket.on("chat:typing", ({ roomId, typing }) => {
    const rid = getRoomId(roomId);
    const uid = userId();
    if (!rid || !uid) return;

    try {
      const isTyping = !!typing;

      const m = getTypingMap(rid);
      if (isTyping) {
        m.set(uid, { username: username(), lastTs: Date.now() });
      } else {
        m.delete(uid);
      }

      pruneTypingMap(rid);

      socket.to(rid).emit("chat:typing", {
        roomId: rid,
        userId: uid,
        username: username(),
        typing: isTyping,
        ts: Date.now(),
      });
    } catch (err) {
      console.error("[chat] typing error:", err?.message || err);
    }
  });

  socket.on("chat:send", async (payload, ack) => {
    const rid = getRoomId(payload?.roomId);

    try {
      const uid = userId();
      if (!rid || !uid) {
        if (typeof ack === "function") ack({ ok: false, code: "bad-request" });
        return;
      }

      const text = String(payload?.text || "").trim();
      const clientMessageId = payload?.clientMessageId
        ? String(payload.clientMessageId)
        : null;

      if (!text) {
        if (typeof ack === "function") ack({ ok: false, code: "empty" });
        return;
      }

      if (text.length > 2000) {
        if (typeof ack === "function") ack({ ok: false, code: "too-long" });
        return;
      }

      const boardRes = await ensureBoardExistsAndMember(rid, uid);
      if (!boardRes.ok) {
        if (typeof ack === "function") ack({ ok: false, code: boardRes.code });

        if (boardRes.code === "board-not-found") {
          socket.emit("board-not-found", { roomId: rid });
        }
        return;
      }

      const doc = await ChatMessage.create({
        roomId: rid,
        senderId: uid,
        senderUsername: username(),
        clientMessageId,
        text,
      });

      const message = mapMessage(doc);

      // Stop typing for this sender
      const tMap = typingByRoom.get(rid);
      if (tMap) tMap.delete(uid);
      socket.to(rid).emit("chat:typing", {
        roomId: rid,
        userId: uid,
        username: username(),
        typing: false,
        ts: Date.now(),
      });

      io.to(rid).emit("chat:message", message);

      if (typeof ack === "function") ack({ ok: true, message });
    } catch (err) {
      console.error("[chat] chat:send error:", err?.message || err);

      if (typeof ack === "function") ack({ ok: false, code: "server-error" });

      socket.emit("server-error", {
        roomId: rid,
        action: "chat:send",
        message: "Something went wrong",
      });
    }
  });

  socket.on("disconnect", () => {
    const rid = String(socket.data?.roomId || "");
    const uid = String(socket.user?.id || "");

    if (rid && uid) {
      const m = typingByRoom.get(rid);
      if (m) {
        m.delete(uid);
        pruneTypingMap(rid);
      }

      // broadcast to clear stale typing
      socket.to(rid).emit("chat:typing", {
        roomId: rid,
        userId: uid,
        username: username(),
        typing: false,
        ts: Date.now(),
      });
    }

    console.log(`[chat] socket disconnected: ${socket.id}`);
  });
}
