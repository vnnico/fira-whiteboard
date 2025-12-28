const voiceStateByRoom = new Map();

function getRoom(roomId) {
  const rid = String(roomId || "");
  if (!rid) return null;
  if (!voiceStateByRoom.has(rid)) voiceStateByRoom.set(rid, new Map());
  return voiceStateByRoom.get(rid);
}

function getUserEntry(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return null;

  const uid = String(userId || "");
  if (!uid) return null;

  if (!room.has(uid)) {
    room.set(uid, {
      inVoice: false,
      deafened: false,
      micEnabled: false,
      sockets: new Set(),
      updatedAt: Date.now(),
    });
  }
  return room.get(uid);
}

function publicState(entry) {
  if (!entry) return { inVoice: false, deafened: false, micEnabled: false };
  return {
    inVoice: !!entry.inVoice,
    deafened: !!entry.deafened,
    micEnabled: !!entry.micEnabled,
  };
}

export function upsertUserSocket(roomId, userId, socketId) {
  const entry = getUserEntry(roomId, userId);
  if (!entry) return null;

  if (socketId) entry.sockets.add(String(socketId));
  entry.updatedAt = Date.now();
  return publicState(entry);
}

export function removeUserSocket(roomId, userId, socketId) {
  const rid = String(roomId || "");
  const uid = String(userId || "");
  if (!rid || !uid) return { changed: false, state: null };

  const room = voiceStateByRoom.get(rid);
  if (!room) return { changed: false, state: null };

  const entry = room.get(uid);
  if (!entry) return { changed: false, state: null };

  if (socketId) entry.sockets.delete(String(socketId));

  // Kalau socket terakhir hilang, tandai user tidak in voice (untuk UI).
  if (entry.sockets.size === 0) {
    entry.inVoice = false;
    entry.deafened = false;
    entry.micEnabled = false;
    entry.updatedAt = Date.now();
  }

  return {
    changed: true,
    state: publicState(entry),
    isFullyLeft: entry.sockets.size === 0,
  };
}

export function setVoiceState(roomId, userId, patch) {
  const entry = getUserEntry(roomId, userId);
  if (!entry) return null;

  if (patch && typeof patch === "object") {
    if (typeof patch.inVoice === "boolean") entry.inVoice = patch.inVoice;
    if (typeof patch.deafened === "boolean") entry.deafened = patch.deafened;
    if (typeof patch.micEnabled === "boolean")
      entry.micEnabled = patch.micEnabled;
  }

  // Kalau tidak in voice, deafened tidak relevan.
  if (!entry.inVoice) entry.deafened = false;
  // kalau deafened, mic harus off (sinkron & privacy)
  if (entry.deafened) entry.micEnabled = false;

  entry.updatedAt = Date.now();
  return publicState(entry);
}

export function getVoiceSnapshot(roomId) {
  const rid = String(roomId || "");
  const room = voiceStateByRoom.get(rid);
  if (!room) return {};

  const out = {};
  for (const [uid, entry] of room.entries()) {
    out[String(uid)] = publicState(entry);
  }
  return out;
}
