// services/whiteboardApi.js
import api from "./apiClient";

export async function getWhiteboard(roomId) {
  const { data } = await api.get(`/whiteboards/${roomId}`);
  return data;
}

export async function getWhiteboards() {
  const { data } = await api.post("/whiteboards");
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
