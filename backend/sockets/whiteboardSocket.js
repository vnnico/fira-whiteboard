// src/sockets/whiteboardSocket.js
import {
  getBoard,
  upsertElement,
  clearBoard,
} from "../models/whiteboardStore.js";

export function registerWhiteboardHandlers(io, socket) {
  // Helper: dapatkan roomId dari payload atau dari socket.data
  const getRoomId = (roomId) => roomId || socket.data?.roomId;

  // Handshake: user join ke room tertentu
  socket.on("join-room", ({ roomId }) => {
    if (!roomId) return;

    socket.join(roomId);
    socket.data.roomId = roomId;

    const board = getBoard(roomId);
    const elements = board?.elements || [];

    // Kirim snapshot hanya ke user ini
    socket.emit("whiteboard-state", { elements });
  });

  // Update elemen (draft & final)
  socket.on("element-update", (data) => {
    const { roomId, element, isFinal } = data || {};
    const resolvedRoomId = getRoomId(roomId);
    if (!resolvedRoomId || !element) return;

    // 1. Broadcast selalu (real-time)
    socket.to(resolvedRoomId).emit("element-update", { element });

    // 2. Persistence hanya jika final
    if (isFinal) {
      upsertElement(resolvedRoomId, element);
    }
  });

  // Clear board
  socket.on("whiteboard-clear", ({ roomId, isFinal }) => {
    const resolvedRoomId = getRoomId(roomId);
    if (!resolvedRoomId) return;

    // Broadcast clear
    socket.to(resolvedRoomId).emit("whiteboard-clear");

    if (isFinal) {
      clearBoard(resolvedRoomId);
    }
  });

  // Cursor position
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

  // Element lock (visual locking)
  socket.on("element-lock", ({ roomId, elementId, userId, locked }) => {
    const resolvedRoomId = getRoomId(roomId);
    if (!resolvedRoomId || !elementId) return;

    socket.to(resolvedRoomId).emit("element-lock", {
      elementId,
      userId,
      locked: !!locked,
    });
  });

  // Saat disconnect, beritahu room untuk remove cursor + lock user ini
  socket.on("disconnect", () => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;

    io.to(roomId).emit("user-disconnected", { userId: socket.id });
  });
}
