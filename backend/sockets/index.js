import { Server } from "socket.io";
import { authSocketMiddleware } from "../middleware/authMiddleware.js";
import { registerWhiteboardHandlers } from "./whiteboardSocket.js";
import { registerVoiceHandlers } from "./voiceSocket.js";
import { registerChatHandlers } from "./chatSocket.js";

let whiteboardNs = null;
let voiceNs = null;
let chatNs = null;

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || true,
      credentials: true,
    },
  });

  whiteboardNs = io.of("/whiteboard");
  whiteboardNs.use(authSocketMiddleware);
  whiteboardNs.on("connection", (socket) => {
    registerWhiteboardHandlers(whiteboardNs, socket);
  });

  voiceNs = io.of("/voice");
  voiceNs.use(authSocketMiddleware);
  voiceNs.on("connection", (socket) => {
    registerVoiceHandlers(voiceNs, socket);
  });

  chatNs = io.of("/chat");
  chatNs.use(authSocketMiddleware);
  chatNs.on("connection", (socket) => {
    registerChatHandlers(chatNs, socket);
  });

  return io;
}

export function getWhiteboardNamespace() {
  return whiteboardNs;
}

export function getVoiceNameSpace() {
  return voiceNs;
}

export function getChatNamespace() {
  return chatNs;
}
