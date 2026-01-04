import { ChatMessage } from "../models/chatMessageModel.js";
import { User } from "../models/userModel.js";

export async function initDb() {
  await User.syncIndexes();
  await ChatMessage.syncIndexes();
}
