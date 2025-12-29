import http from "http";
import app from "./app.js";
import { PORT } from "./config/env.js";
import { initSocket } from "./sockets/index.js";

import { connectMongo } from "./db/mongo.js";
import { initDb } from "./db/index.js";
import { initWhiteboardStore } from "./models/whiteboardStore.js";

const server = http.createServer(app);

async function start() {
  await connectMongo();
  await initDb();
  await initWhiteboardStore();

  initSocket(server);

  server.listen(PORT, () => console.log(`App listening on port ${PORT}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
});
