import api from "./apiClient";

export async function createToken(roomId) {
  const { data } = await api.post("/voice/token", { roomId });
  return data; // { token, url, roomName }
}

export async function moderateMute(roomId, targetUserId) {
  const { data } = await api.post("/voice/moderate/mute", {
    roomId,
    targetUserId,
  });
  return data; // { ok: true }
}

export async function moderateDeafen(roomId, targetUserId, deafened) {
  const { data } = await api.post("/voice/moderate/deafen", {
    roomId,
    targetUserId,
    deafened,
  });
  return data; // { ok: true }
}
