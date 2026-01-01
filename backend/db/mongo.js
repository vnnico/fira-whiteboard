import mongoose from "mongoose";
import { MONGODB_URI, MONGODB_DBNAME } from "../config/env.js";

let isClosing = false;
let reconnectTimer = null;
let reconnectAttempt = 0;

function getConnectOptions() {
  return {
    dbName: MONGODB_DBNAME || undefined,

    // Membuat fail-fast lebih cepat saat jaringan putus,
    // sehingga request tidak menggantung terlalu lama.
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 20000,
  };
}

async function doConnect() {
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");

  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGODB_URI, getConnectOptions());
  console.log("[mongoose] connected:", mongoose.connection.name);
}

function scheduleReconnect() {
  if (isClosing) return;
  if (reconnectTimer) return;

  const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempt));
  reconnectAttempt += 1;

  console.warn(`[mongoose] disconnected. Reconnecting in ${delay}ms...`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await doConnect();
      reconnectAttempt = 0;
    } catch (err) {
      console.error("[mongoose] reconnect failed:", err?.message || err);
      scheduleReconnect();
    }
  }, delay);
}

export async function connectMongo() {
  await doConnect();

  // Listener koneksi untuk runtime drop
  mongoose.connection.on("disconnected", () => {
    scheduleReconnect();
  });

  mongoose.connection.on("error", (err) => {
    // error sering muncul saat jaringan drop / TLS reset
    console.error("[mongoose] connection error:", err?.message || err);

    scheduleReconnect();
  });
}

export function isMongoReady() {
  // 1 = connected
  return mongoose.connection.readyState === 1;
}

export async function closeMongo() {
  isClosing = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  await mongoose.disconnect();
}
