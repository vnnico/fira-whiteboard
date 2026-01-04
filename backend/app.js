import express from "express";
import cors from "cors";
import process from "process";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { CLIENT_ORIGIN } from "./config/env.js";

const app = express();

process.on("unhandledRejection", (err) => {
  console.error("[process] unhandledRejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException:", err);
});

app.set("trust proxy", 1);
const allowedOrigins = String(CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());

// API routes
app.use("/api", routes);

// health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// global error handler
app.use(errorHandler);

export default app;
