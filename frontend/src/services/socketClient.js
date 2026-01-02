import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3001";

export function createChatSocket(token) {
  return io(`${SERVER_URL}/chat`, {
    auth: { token },
    transports: ["websocket"],
  });
}

export function createWhiteboardSocket(token) {
  return io(`${SERVER_URL}/whiteboard`, {
    auth: { token },
    transports: ["websocket"],
  });
}

export function createVoiceSocket(token) {
  return io(`${SERVER_URL}/voice`, {
    auth: { token },
    transports: ["websocket"],
  });
}
