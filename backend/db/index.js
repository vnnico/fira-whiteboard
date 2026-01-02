import { ChatMessage } from "../models/chatMessageModel.js";
import { User } from "../models/userModel.js";

const DEFAULT_USERS = [
  {
    _id: "1",
    username: "admin",
    password: "admin",
    displayName: "User-000001",
  },
  { _id: "2", username: "anto", password: "anto", displayName: "User-000002" },
  { _id: "3", username: "nico", password: "nico", displayName: "User-000003" },
  {
    _id: "4",
    username: "hansen",
    password: "hansen",
    displayName: "User-000004",
  },
  {
    _id: "5",
    username: "wilson",
    password: "wilson",
    displayName: "User-000005",
  },
];

export async function initDb() {
  // Pastikan index dibuat
  await User.syncIndexes();
  await ChatMessage.syncIndexes();

  const count = await User.countDocuments({});
  if (count === 0) {
    await User.insertMany(DEFAULT_USERS);
    console.log("[mongoose] seeded default users:", DEFAULT_USERS.length);
  }
}
