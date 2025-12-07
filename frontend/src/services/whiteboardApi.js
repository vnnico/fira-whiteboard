// services/whiteboardApi.js
import api from "./apiClient";

export async function getWhiteboards() {
  const { data } = await api.post("/whiteboards");
  return data; // { roomId, whiteboard: { ... } }
}

export async function createWhiteboard() {
  const { data } = await api.post("/whiteboards/create");
  return data; // { roomId, whiteboard: { ... } }
}
