import {
  getVoiceSnapshot,
  setVoiceState,
  upsertUserSocket,
  removeUserSocket,
} from "../models/voiceStateStore.js";

export function registerVoiceHandlers(io, socket) {
  const getRoomId = (roomId) => roomId ?? socket.data?.roomId;

  socket.on("join-room", ({ roomId }) => {
    const rid = String(roomId || "");
    if (!rid) return;

    console.log("test masuk ga");
    socket.join(rid);
    socket.data.roomId = rid;

    const uid = String(socket.user?.id || "");
    if (uid) {
      socket.data.userId = uid;
      upsertUserSocket(rid, uid, socket.id);
    }

    socket.emit("voice-state-snapshot", {
      roomId: rid,
      snapshot: getVoiceSnapshot(rid),
    });
  });

  socket.on("voice:state", ({ roomId, inVoice, deafened, micEnabled }) => {
    const rid = String(getRoomId(roomId) || "");
    const uid = String(socket.user?.id || socket.data?.userId || "");
    if (!rid || !uid) return;

    const next = setVoiceState(rid, uid, { inVoice, deafened, micEnabled });
    if (!next) return;

    console.log("ININEXT: ", next);
    io.to(rid).emit("voice:state", {
      roomId: rid,
      userId: uid,
      ...next,
      ts: Date.now(),
    });
  });

  socket.on("disconnect", () => {
    const rid = String(socket.data?.roomId || "");
    const uid = String(socket.data?.userId || socket.user?.id || "");
    if (!rid || !uid) return;

    const { changed, state, isFullyLeft } = removeUserSocket(
      rid,
      uid,
      socket.id
    );
    if (!changed || !state) return;

    // Broadcast hanya kalau socket terakhir user benar-benar hilang.
    if (isFullyLeft) {
      io.to(rid).emit("voice:state", {
        roomId: rid,
        userId: uid,
        ...state,
        ts: Date.now(),
      });
    }
  });
}
