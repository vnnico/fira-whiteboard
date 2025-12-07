import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT || 5000;
export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
export const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || "http://localhost:5173";
