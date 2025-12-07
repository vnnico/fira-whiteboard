export function registerChatHandlers(io, socket) {
  // contoh event minimum
  socket.on("chat:send", (message) => {
    // TODO: bisa tambah room/roomId
    io.emit("chat:message", {
      id: Date.now().toString(),
      text: message.text,
      from: message.from,
    });
  });

  socket.on("disconnect", () => {
    console.log(`Chat socket disconnected: ${socket.id}`);
  });
}
