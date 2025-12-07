// src/sockets/index.js
import { Server } from "socket.io";
import { CLIENT_ORIGIN } from "../config/env.js";
import { registerChatHandlers } from "./chatSocket.js";
import { registerWhiteboardHandlers } from "./whiteboardSocket.js";
import { registerCallHandlers } from "./callSocket.js";

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: CLIENT_ORIGIN,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    // TODO: verifikasi JWT di sini kalau mau
    next();
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
  });

  const chatNamespace = io.of("/chat");
  chatNamespace.on("connection", (socket) => {
    registerChatHandlers(chatNamespace, socket);
  });

  const whiteboardNamespace = io.of("/whiteboard");
  whiteboardNamespace.on("connection", (socket) => {
    registerWhiteboardHandlers(whiteboardNamespace, socket);
  });

  const callNamespace = io.of("/call");
  callNamespace.on("connection", (socket) => {
    registerCallHandlers(callNamespace, socket);
  });
}
