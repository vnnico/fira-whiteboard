import { AccessToken } from "livekit-server-sdk";
import {
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
} from "../config/env.js";

export async function createToken(req, res, next) {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ message: "roomId is required" });
    }
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({
        message:
          "LiveKit env is not configured (LIVEKIT_URL/API_KEY/API_SECRET)",
      });
    }

    const roomName = String(roomId);
    const identity = String(req.user.id);
    const name = req.user.username;

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name,
      ttl: "5h",
    });

    // Minimal grant: boleh join room
    at.addGrant({ roomJoin: true, room: roomName });

    const token = await at.toJwt();

    return res.json({
      token,
      url: LIVEKIT_URL,
      roomName,
    });
  } catch (err) {
    next(err);
  }
}
