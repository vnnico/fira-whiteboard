import http from "http";
import app from "./app.js";
import { PORT } from "./config/env.js";
import { initSocket } from "./sockets/index.js";

const server = http.createServer(app);

// init all socket
initSocket(server);

server.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
