import express from "express";
import cors from "cors";
import { CLIENT_ORIGIN } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// API routes
app.use("/api", routes);

// health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// global error handler
app.use(errorHandler);

export default app;
