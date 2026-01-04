import {
  getVoiceSnapshot,
  setVoiceState,
  upsertUserSocket,
  removeUserSocket,
} from "../models/voiceStateStore.js";
import { ensureBoardExistsAndUpsertMember } from "../utils/boardMembership.js";

export function registerVoiceHandlers(io, socket) {
  const getRoomId = () => String(socket.data?.roomId ?? "");
  const getUserId = () => String(socket.data?.userId ?? "");

  socket.on("join-room", async ({ roomId }) => {
    const rid = String(roomId || "").trim();
    const uid = String(socket.user?.id || "");

    if (!rid || !uid) return;

    try {
      const res = await ensureBoardExistsAndUpsertMember(rid, uid, {
        select: "roomId createdBy members roles",
      });
      if (!res.ok) {
        if (res.code === "board-not-found")
          socket.emit("board-not-found", { roomId: rid });
        return;
      }

      // const isOwner = board.createdBy && String(board.createdBy) === uid;
      // const hasRole = !!board.roles?.[uid];

      // const update = {
      //   $addToSet: { members: uid },
      //   $set: { updatedAt: new Date() },
      // };

      // if (!isOwner && !hasRole) {
      //   update.$set[`roles.${uid}`] = DEFAULT_ROLE_FOR_NEW_MEMBER;
      // }

      // await Board.updateOne({ roomId: rid }, update);

      socket.join(rid);
      socket.data.roomId = rid;
      socket.data.userId = uid;

      upsertUserSocket(rid, uid, socket.id);

      socket.emit("voice-state-snapshot", {
        roomId: rid,
        snapshot: getVoiceSnapshot(rid),
      });
    } catch (err) {
      console.error("[voice] join-room:", err?.message || err);
      socket.emit("server-error", {
        roomId: rid,
        action: "join-room",
        message: "Something went wrong",
      });
    }
  });

  socket.on("voice:state", ({ inVoice, deafened, micEnabled }) => {
    const rid = getRoomId();
    const uid = getUserId();
    if (!rid || !uid) return;

    try {
      const patch = {};
      if (typeof inVoice === "boolean") patch.inVoice = inVoice;
      if (typeof deafened === "boolean") patch.deafened = deafened;
      if (typeof micEnabled === "boolean") patch.micEnabled = micEnabled;

      const next = setVoiceState(rid, uid, patch);
      if (!next) return;

      io.to(rid).emit("voice:state", {
        roomId: rid,
        userId: uid,
        ...next,
        ts: Date.now(),
      });
    } catch (err) {
      console.error("[voice] voice:state error:", err?.message || err);
      socket.emit("server-error", {
        roomId: rid,
        action: "voice:state",
        message: "Something went wrong",
      });
    }
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
