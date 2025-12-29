// backend/db/mongoose.js
import mongoose from "mongoose";
import { MONGODB_URI, MONGODB_DBNAME } from "../config/env.js";

export async function connectMongo() {
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");

  mongoose.set("strictQuery", true);

  await mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DBNAME || undefined,
  });

  console.log("[mongoose] connected:", mongoose.connection.name);
}

export async function closeMongo() {
  await mongoose.disconnect();
}
