import express from "express";
import cors from "cors";
import process from "process";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

process.on("unhandledRejection", (err) => {
  console.error("[process] unhandledRejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException:", err);
});

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

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
