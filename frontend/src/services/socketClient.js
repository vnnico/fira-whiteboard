import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:5000";

export function createChatSocket(token) {
  return io(`${SERVER_URL}/chat`, {
    auth: { token },
  });
}

export function createWhiteboardSocket(token) {
  return io(`${SERVER_URL}/whiteboard`, {
    auth: { token },
  });
}

export function createCallSocket(token) {
  return io(`${SERVER_URL}/call`, {
    auth: { token },
  });
}
