import { io } from "socket.io-client";

const SERVER_URL = "http://192.168.1.101:3001";

export function createChatSocket(token) {
  return io(`${SERVER_URL}/chat`, {
    auth: { token },
  });
}

export function createWhiteboardSocket(token) {
  console.log(token);
  return io(`${SERVER_URL}/whiteboard`, {
    auth: { token },
    transports: ["websocket"],
  });
}

export function createCallSocket(token) {
  return io(`${SERVER_URL}/call`, {
    auth: { token },
  });
}

export function createVoiceSocket(token) {
  return io(`${SERVER_URL}/voice`, {
    auth: { token },
    transports: ["websocket"],
  });
}
