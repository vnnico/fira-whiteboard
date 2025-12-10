import {
  getAllBoards,
  upsertElement,
  clearBoard,
  getBoardById,
  addMember,
} from "../models/whiteboardStore.js";

export function registerWhiteboardHandlers(io, socket) {
  // Helper: dapatkan roomId dari payload atau dari socket.data
  const getRoomId = (roomId) => roomId ?? socket.data?.roomId;

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

    // LOGIC BARU: Auto-add Member
    if (socket.user && socket.user.id) {
      addMember(roomId, socket.user.id);
    }

    const board = getBoardById(roomId);

    // Kirim elements DAN title
    socket.emit("whiteboard-state", {
      elements: board?.elements || [],
      title: board?.title || "Untitled Whiteboard", // Kirim title ke frontend
    });
  });

  // Listener baru: Broadcast perubahan title (real-time)
  socket.on("title-update", ({ roomId, title }) => {
    socket.to(roomId).emit("title-update", { title });
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
    const roomId = getRoomId();
    if (!roomId) return;

    io.to(roomId).emit("user-disconnected", { userId: socket.id });
  });
}
