import {
  AccessToken,
  RoomServiceClient,
  trackSourceToString,
} from "livekit-server-sdk";
import {
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
} from "../config/env.js";
import {
  getBoardById,
  ensureRoleForUser,
  getPermissionsForUser,
} from "../models/whiteboardStore.js";
import { getVoiceNameSpace } from "../sockets/index.js";
import { setVoiceState } from "../models/voiceStateStore.js";

function toHttpHost(livekitUrl) {
  if (!livekitUrl) return "";
  // LIVEKIT_URL umumnya "wss://host"
  // RoomServiceClient butuh "https://host"
  return String(livekitUrl)
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://");
}

async function requireOwner(roomId, userId) {
  ensureRoleForUser(roomId, userId);

  const perms = getPermissionsForUser(roomId, userId);
  if (!perms || perms.role !== "OWNER") {
    const err = new Error("Only owner can moderate voice");
    err.status = 403;
    throw err;
  }
}

async function getMicrophoneTrackSid(roomName, identity) {
  if (!roomService) return null;

  const p = await roomService.getParticipant(roomName, identity);
  const tracks = Array.isArray(p?.tracks) ? p.tracks : [];

  const mic = tracks.find(
    (t) => trackSourceToString(t.source) === "microphone"
  );
  return mic?.sid || null;
}

async function getOtherTrackSids(roomName, targetIdentity) {
  if (!roomService) return [];
  const participants = await roomService.listParticipants(roomName);
  const out = [];

  for (const p of participants || []) {
    if (String(p.identity) === String(targetIdentity)) continue;
    for (const t of p.tracks || []) {
      if (t?.sid) out.push(t.sid);
    }
  }
  return out;
}

function emitVoiceModeration(roomId, payload) {
  const ns = getVoiceNameSpace();
  if (!ns) return;
  ns.to(String(roomId)).emit("voice-moderation", payload);
}

function emitVoiceState(roomId, userId, state, meta = {}) {
  const ns = getVoiceNameSpace();
  if (!ns || !state) return;
  ns.to(String(roomId)).emit("voice:state", {
    roomId: String(roomId),
    userId: String(userId),
    ...state,
    ts: Date.now(),
    ...meta,
  });
}

const LIVEKIT_HOST = toHttpHost(LIVEKIT_URL);

const roomService =
  LIVEKIT_HOST && LIVEKIT_API_KEY && LIVEKIT_API_SECRET
    ? new RoomServiceClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    : null;

export async function createToken(req, res, next) {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ message: "roomId is required" });
    }

    const board = await getBoardById(roomId);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const userId = String(req.user?.id);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const isOwner = board.createdBy && String(board.createdBy) === userId;

    const members = Array.isArray(board.members) ? board.members : [];
    const isMember = members.some((m) => String(m) === userId);

    if (!isOwner && !isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this room" });
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
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

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

export async function moderateMute(req, res, next) {
  try {
    const { roomId, targetUserId } = req.body;

    if (!roomId || !targetUserId) {
      return res
        .status(400)
        .json({ message: "roomId and targetUserId are required" });
    }

    const board = await getBoardById(roomId);
    if (!board) return res.status(404).json({ message: "Board not found" });

    const actorId = String(req.user?.id);
    if (!actorId) return res.status(401).json({ message: "Unauthorized" });

    await requireOwner(String(roomId), actorId);

    if (!roomService) {
      return res
        .status(500)
        .json({ message: "LiveKit RoomService is not configured" });
    }

    const roomName = String(roomId);
    const targetId = String(targetUserId);

    // privacy-safe: hanya mute, tidak ada unmute
    const micSid = await getMicrophoneTrackSid(roomName, targetId);
    if (!micSid) {
      return res.status(404).json({
        message: "Target has no microphone track (not in voice or no mic)",
      });
    }

    await roomService.mutePublishedTrack(roomName, targetId, micSid, true);

    const nextState = setVoiceState(String(roomId), targetId, {
      inVoice: true,
      micEnabled: false,
    });
    emitVoiceState(roomId, targetId, nextState, { source: "owner" });

    emitVoiceModeration(roomId, {
      action: "mute",
      roomId: String(roomId),
      targetUserId: targetId,
      actorUserId: actorId,
      ts: Date.now(),
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function moderateDeafen(req, res, next) {
  try {
    const { roomId, targetUserId, deafened } = req.body;

    if (!roomId || !targetUserId || typeof deafened !== "boolean") {
      return res.status(400).json({
        message: "roomId, targetUserId and deafened(boolean) are required",
      });
    }

    const board = await getBoardById(roomId);
    if (!board) return res.status(404).json({ message: "Board not found" });

    const actorId = String(req.user?.id);
    if (!actorId) return res.status(401).json({ message: "Unauthorized" });

    await requireOwner(String(roomId), actorId);

    if (!roomService) {
      return res
        .status(500)
        .json({ message: "LiveKit RoomService is not configured" });
    }

    const roomName = String(roomId);
    const targetId = String(targetUserId);

    const patch = { inVoice: true, deafened: !!deafened };
    if (deafened) patch.micEnabled = false; // deafen memaksa mic mati
    const nextState = setVoiceState(String(roomId), targetId, patch);
    emitVoiceState(roomId, targetId, nextState, { source: "owner" });

    emitVoiceModeration(roomId, {
      action: deafened ? "deafen" : "undeafen",
      roomId: String(roomId),
      targetUserId: targetId,
      actorUserId: actorId,
      ts: Date.now(),
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
