import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },

    senderId: { type: String, required: true, index: true },
    senderUsername: { type: String, required: true },

    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false }
);

chatMessageSchema.index({ roomId: 1, createdAt: -1 });

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
