import { Server } from "socket.io";
import { authSocketMiddleware } from "../middleware/authMiddleware.js";
import { registerWhiteboardHandlers } from "./whiteboardSocket.js";
import { registerVoiceHandlers } from "./voiceSocket.js";

let whiteboardNs = null;
let voiceNs = null;

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || true,
      credentials: true,
    },
  });

  // Namespace: whiteboard
  whiteboardNs = io.of("/whiteboard");
  whiteboardNs.use(authSocketMiddleware);

  whiteboardNs.on("connection", (socket) => {
    registerWhiteboardHandlers(whiteboardNs, socket);
  });

  // Namespace: voice (kalau Anda punya)
  voiceNs = io.of("/voice");
  voiceNs.use(authSocketMiddleware);

  voiceNs.on("connection", (socket) => {
    registerVoiceHandlers(voiceNs, socket);
  });

  return io;
}

export function getWhiteboardNamespace() {
  return whiteboardNs;
}

export function getVoiceNameSpace() {
  return voiceNs;
}
