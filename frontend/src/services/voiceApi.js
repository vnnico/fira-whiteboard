import api from "./apiClient";

export async function createToken(roomId) {
  const { data } = await api.post("/voice/token", { roomId });
  return data; // { token, url, roomName }
}
