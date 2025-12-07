export function registerCallHandlers(io, socket) {
  // signaling sederhana untuk WebRTC
  socket.on("call:offer", (payload) => {
    socket.to(payload.to).emit("call:offer", payload);
  });

  socket.on("call:answer", (payload) => {
    socket.to(payload.to).emit("call:answer", payload);
  });

  socket.on("call:candidate", (payload) => {
    socket.to(payload.to).emit("call:candidate", payload);
  });
}
