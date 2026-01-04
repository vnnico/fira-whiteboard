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
import { Board } from "../models/whiteboardModel.js";
import { getVoiceNameSpace } from "../sockets/index.js";
import { setVoiceState, getVoiceRuntime } from "../models/voiceStateStore.js";
import {
  ensureBoardExistsAndUpsertMember,
  isBoardMember,
  isOwner,
} from "../utils/boardMembership.js";

function toHttpHost(livekitUrl) {
  if (!livekitUrl) return "";
  // LIVEKIT_URL umumnya "wss://host"
  // RoomServiceClient butuh "https://host"
  return String(livekitUrl)
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://");
}

function assertOwner(board, userId) {
  const uid = String(userId || "");
  if (!uid || !board) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }

  if (!isOwner(board, uid)) {
    const err = new Error("Only owner can moderate voice");
    err.status = 403;
    throw err;
  }
}

async function getMicrophoneTrackSid(roomName, identity) {
  if (!roomService) return null;

  try {
    const p = await roomService.getParticipant(roomName, identity);
    const tracks = Array.isArray(p?.tracks) ? p.tracks : [];
    const mic = tracks.find(
      (t) => trackSourceToString(t.source) === "microphone"
    );
    return mic?.sid || null;
  } catch {
    return null;
  }
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
    const roomId = String(req.body?.roomId || "").trim();
    if (!roomId) {
      return res.status(400).json({ message: "roomId is required" });
    }
    const userId = String(req.user?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const ensureResult = await ensureBoardExistsAndUpsertMember(
      roomId,
      userId,
      {
        select: "roomId title createdBy members roles locked",
      }
    );
    if (!ensureResult.ok) {
      if (ensureResult.code === "board-not-found")
        return res.status(404).json({ message: "Board not found" });
      return res.status(400).json({ message: "Bad request" });
    }

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({
        message:
          "LiveKit env is not configured (LIVEKIT_URL/API_KEY/API_SECRET)",
      });
    }

    const identity = String(req.user.id);
    const name = String(req.user.username || "");

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name,
      ttl: "5h",
    });

    // Minimal grant: boleh join room
    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return res.status(200).json({
      token,
      url: LIVEKIT_URL,
      roomName: roomId,
    });
  } catch (err) {
    next(err);
  }
}

export async function moderateMute(req, res, next) {
  try {
    const roomId = String(req.body?.roomId || "").trim();
    const targetUserId = String(req.body?.targetUserId || "").trim();

    if (!roomId || !targetUserId) {
      return res
        .status(400)
        .json({ message: "roomId and targetUserId are required" });
    }

    const actorId = String(req.user?.id || "");
    if (!actorId) return res.status(401).json({ message: "Unauthorized" });

    const board = await Board.findOne({ roomId })
      .select("roomId createdBy members roles")
      .lean();
    if (!board) return res.status(404).json({ message: "Board not found" });

    assertOwner(board, actorId);

    if (!isBoardMember(board, targetUserId)) {
      return res
        .status(400)
        .json({ message: "Target user is not a member of this room" });
    }

    const runtime = getVoiceRuntime(roomId, targetUserId);
    if (!runtime || runtime.socketsCount === 0 || !runtime.state?.inVoice) {
      return res.status(200).json({
        ok: true,
        warning: "Target is not connected to voice in this room",
      });
    }

    // Enforce local runtime state (UI sync)
    const nextState = setVoiceState(roomId, targetUserId, {
      micEnabled: false,
    });
    emitVoiceState(roomId, targetUserId, nextState, { source: "owner" });

    // Enforce server-side mute via LiveKit
    let serverMuted = false;
    if (roomService) {
      const micSid = await getMicrophoneTrackSid(roomId, targetUserId);
      if (micSid) {
        try {
          await roomService.mutePublishedTrack(
            roomId,
            targetUserId,
            micSid,
            true
          );
          serverMuted = true;
        } catch (e) {
          console.warn("[voice] server mute failed:", e?.message || e);
        }
      }
    }

    emitVoiceModeration(roomId, {
      action: "mute",
      roomId,
      targetUserId,
      actorUserId: actorId,
      serverMuted,
      ts: Date.now(),
    });

    return res.status(200).json({ ok: true, serverMuted });
  } catch (err) {
    next(err);
  }
}

export async function moderateDeafen(req, res, next) {
  try {
    const roomId = String(req.body?.roomId || "").trim();
    const targetUserId = String(req.body?.targetUserId || "").trim();
    const deafened = req.body?.deafened;

    if (!roomId || !targetUserId || typeof deafened !== "boolean") {
      return res.status(400).json({
        message: "roomId, targetUserId and deafened(boolean) are required",
      });
    }

    const actorId = String(req.user?.id || "");
    if (!actorId) return res.status(401).json({ message: "Unauthorized" });

    const board = await Board.findOne({ roomId })
      .select("roomId createdBy members roles")
      .lean();
    if (!board) return res.status(404).json({ message: "Board not found" });

    assertOwner(board, actorId);

    if (!isBoardMember(board, targetUserId)) {
      return res
        .status(400)
        .json({ message: "Target user is not a member of this room" });
    }

    const runtime = getVoiceRuntime(roomId, targetUserId);
    if (!runtime || runtime.socketsCount === 0 || !runtime.state?.inVoice) {
      return res.status(200).json({
        ok: true,
        warning: "Target is not connected to voice in this room",
      });
    }

    const nextState = setVoiceState(roomId, targetUserId, {
      deafened: !!deafened,
    });

    emitVoiceState(roomId, targetUserId, nextState, { source: "owner" });

    // Kalau deafened is true, enforce mic server mute juga (selaras dengan “deafen biasanya mute”)
    if (deafened && roomService) {
      const micSid = await getMicrophoneTrackSid(roomId, targetUserId);
      if (micSid) {
        try {
          await roomService.mutePublishedTrack(
            roomId,
            targetUserId,
            micSid,
            true
          );
        } catch (e) {
          console.warn(
            "[voice] server mute on deafen failed:",
            e?.message || e
          );
        }
      }
    }

    emitVoiceModeration(roomId, {
      action: deafened ? "deafen" : "undeafen",
      roomId,
      targetUserId,
      actorUserId: actorId,
      ts: Date.now(),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}
