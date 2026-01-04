import api from "./apiClient";

export async function checkWhiteboardExists(roomId) {
  const { data } = await api.get(`/whiteboards/${roomId}/exists`, {
    params: { roomId },
  });
  return !!data?.exists;
}

export async function getWhiteboardMeta(roomId) {
  const { data } = await api.get(`/whiteboards/${roomId}/meta`);
  return data;
}

export async function getWhiteboards() {
  const { data } = await api.get("/whiteboards");
  return data; // { roomId, whiteboard: { ... } }
}

export async function createWhiteboard() {
  const { data } = await api.post("/whiteboards/create");
  console.log(data);
  return data; // { roomId, whiteboard: { ... } }
}

export async function updateBoardTitle(roomId, title) {
  const { data } = await api.patch(`/whiteboards/${roomId}/title`, { title });
  return data;
}

export async function deleteWhiteboard(roomId) {
  const { data } = await api.delete(`/whiteboards/${roomId}`);
  return data;
}
