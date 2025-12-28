// src/sockets/index.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { CLIENT_ORIGIN, JWT_SECRET } from "../config/env.js";
import { registerChatHandlers } from "./chatSocket.js";
import { registerWhiteboardHandlers } from "./whiteboardSocket.js";
import { registerCallHandlers } from "./callSocket.js";
import { registerVoiceHandlers } from "./voiceSocket.js";

let whiteboardNamespaceRef = null;
let voiceNamespaceRef = null;

export function getWhiteboardNameSpace() {
  return whiteboardNamespaceRef;
}

export function getVoiceNameSpace() {
  return voiceNamespaceRef;
}

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
    },
  });

  const authMiddleware = (socket, next) => {
    const token = socket.handshake.auth.token;
    console.log("===========");
    console.log("Ini token dari FE: ", token);
    if (!token) return next(new Error("Authentication error"));

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = { id: payload.sub, username: payload.username };
      console.log("middleware: ", socket.user);
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  };
  // Socket middleware for authentication
  io.use(authMiddleware);

  const chatNamespace = io.of("/chat");
  chatNamespace.on("connection", (socket) => {
    registerChatHandlers(chatNamespace, socket);
  });

  const whiteboardNamespace = io.of("/whiteboard");
  whiteboardNamespace.use(authMiddleware);
  whiteboardNamespaceRef = whiteboardNamespace;
  whiteboardNamespace.on("connection", async (socket) => {
    const sockets = await io.fetchSockets();
    const wbSockets = await io.of("/whiteboard").fetchSockets();
    console.log(`Socket connected: ${socket.user.id}`);
    console.log("Currently online Whiteboard users: ", wbSockets.length);
    registerWhiteboardHandlers(whiteboardNamespace, socket);
  });

  const voiceNamespace = io.of("/voice");
  voiceNamespace.use(authMiddleware);
  voiceNamespaceRef = voiceNamespace;

  voiceNamespace.on("connection", (socket) => {
    registerVoiceHandlers(voiceNamespace, socket);
  });

  const callNamespace = io.of("/call");
  callNamespace.on("connection", (socket) => {
    registerCallHandlers(callNamespace, socket);
  });
}
