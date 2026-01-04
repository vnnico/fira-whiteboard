import { ChatMessage } from "../models/chatMessageModel.js";
import { User } from "../models/userModel.js";

const DEFAULT_USERS = [
  {
    _id: "1",
    username: "admin",
    password: "admin",
  },
  { _id: "2", username: "anto", password: "anto" },
  { _id: "3", username: "nico", password: "nico" },
  {
    _id: "4",
    username: "hansen",
    password: "hansen",
  },
  {
    _id: "5",
    username: "wilson",
    password: "wilson",
  },
];

export async function initDb() {
  await User.syncIndexes();
  await ChatMessage.syncIndexes();

  const count = await User.countDocuments({});
  if (count === 0) {
    await User.insertMany(DEFAULT_USERS);
    console.log("[mongoose] seeded default users:", DEFAULT_USERS.length);
  }
}
