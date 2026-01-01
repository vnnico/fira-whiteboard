import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  createToken,
  moderateDeafen,
  moderateMute,
} from "../services/voiceApi";
import { createVoiceSocket } from "../services/socketClient";
import { useAuth } from "./useAuth";

function buildParticipantUI(room) {
  const localIdentity = room.localParticipant.identity;

  const participants = [
    room.localParticipant,
    ...Array.from(room.remoteParticipants.values()),
  ];

  return participants.map((p) => {
    const micPub = p.getTrackPublication?.(Track.Source.Microphone);
    const isMuted = micPub ? micPub.isMuted : true;

    return {
      id: p.identity,
      name: p.name || p.identity,
      isMe: p.identity === localIdentity,
      isMuted,
      isSpeaking: !!p.isSpeaking,
    };
  });
}

export function useVoiceState({ roomId }) {
  const [connectionState, setConnectionState] = useState("disconnected"); // disconnected|connecting|connected
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isInVoice, setIsInVoice] = useState(false);

  const [participants, setParticipants] = useState([]);

  const [lastError, setLastError] = useState(null);
  const [disconnectReason, setDisconnectReason] = useState(null);

  const { token } = useAuth();
  // autoplay unblock indicator
  const [needsAudioStart, setNeedsAudioStart] = useState(false);

  // voice moderation

  const roomRef = useRef(null);

  // /voice socket + remote states
  const voiceSocketRef = useRef(null);
  const [remoteVoiceStates, setRemoteVoiceStates] = useState({});

  const isDeafenedRef = useRef(false);
  useEffect(() => {
    isDeafenedRef.current = isDeafened;
  }, [isDeafened]);

  const isInVoiceRef = useRef(false);
  useEffect(() => {
    isInVoiceRef.current = isInVoice;
  }, [isInVoice]);

  // Track audio elements yang di-attach supaya bisa dimute saat deafen
  const remoteAudioElsRef = useRef(new Map());

  const joinInFlightRef = useRef(false);

  const lastLocalMicMutedRef = useRef(null);
  const isMicEnabledRef = useRef(false);
  useEffect(() => {
    isMicEnabledRef.current = isMicEnabled;
  }, [isMicEnabled]);

  // user-gesture call to allow audio playback
  const startAudioPlayback = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    await room.startAudio();
    setNeedsAudioStart(!room.canPlaybackAudio);
  }, []);

  // Devices
  const [audioInputs, setAudioInputs] = useState([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState(() => {
    return localStorage.getItem("voice.audioInputId") || "";
  });

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === "audioinput");
    setAudioInputs(inputs);
    return inputs;
  }, []);

  const selectAudioInput = useCallback(
    async (deviceId) => {
      const room = roomRef.current;

      setSelectedAudioInputId(deviceId || "");

      if (!room) {
        if (!deviceId || deviceId === "default") {
          localStorage.removeItem("voice.audioInputId");
        } else {
          localStorage.setItem("voice.audioInputId", deviceId);
        }
        return;
      }

      const pickFallback = async () => {
        const inputs = (await refreshDevices()) || [];
        return inputs.find(
          (d) =>
            d.deviceId &&
            d.deviceId !== "default" &&
            d.deviceId !== "communications"
        );
      };

      try {
        if (!deviceId || deviceId === "default") {
          localStorage.removeItem("voice.audioInputId");

          try {
            await room.switchActiveDevice("audioinput", "default");
            setSelectedAudioInputId("default");
            return;
          } catch {}

          const fallback = await pickFallback();
          if (fallback?.deviceId) {
            await room.switchActiveDevice("audioinput", fallback.deviceId);
            setSelectedAudioInputId(fallback.deviceId);
            localStorage.setItem("voice.audioInputId", fallback.deviceId);
          } else {
            setSelectedAudioInputId("default");
          }
          return;
        }

        await room.switchActiveDevice("audioinput", deviceId);
        localStorage.setItem("voice.audioInputId", deviceId);
      } catch (e) {
        console.error("switchActiveDevice(audioinput) failed:", e);

        try {
          const fallback = await pickFallback();
          if (fallback?.deviceId) {
            await room.switchActiveDevice("audioinput", fallback.deviceId);
            setSelectedAudioInputId(fallback.deviceId);
            localStorage.setItem("voice.audioInputId", fallback.deviceId);
          } else {
            setSelectedAudioInputId("default");
            localStorage.removeItem("voice.audioInputId");
          }
        } catch (e2) {
          console.error("fallback switch input failed:", e2);
          setSelectedAudioInputId("default");
          localStorage.removeItem("voice.audioInputId");
        }
      }
    },
    [refreshDevices]
  );

  useEffect(() => {
    const handler = () => {
      void refreshDevices();
    };

    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () =>
      navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, [refreshDevices]);

  const cleanupRemoteAudioEls = useCallback(() => {
    const map = remoteAudioElsRef.current;
    map.forEach((el) => {
      try {
        el.remove();
      } catch {}
    });
    map.clear();
  }, []);

  const setAllRemoteAudioMuted = useCallback((muted) => {
    for (const el of remoteAudioElsRef.current.values()) {
      el.muted = muted;
    }
  }, []);

  const getTrackKey = useCallback((track, publication) => {
    return String(
      publication?.trackSid ||
        publication?.sid ||
        track?.sid ||
        `${publication?.kind || track?.kind}-${Date.now()}`
    );
  }, []);

  // Emit local UI voice state to /voice socket
  const emitLocalVoiceState = useCallback(
    (patch = {}) => {
      const s = voiceSocketRef.current;
      if (!s || !roomId) return;

      s.emit("voice:state", {
        roomId: String(roomId),
        inVoice:
          typeof patch.inVoice === "boolean"
            ? patch.inVoice
            : isInVoiceRef.current,
        micEnabled:
          typeof patch.micEnabled === "boolean"
            ? patch.micEnabled
            : isMicEnabledRef.current,
        deafened:
          typeof patch.deafened === "boolean"
            ? patch.deafened
            : isDeafenedRef.current,
      });
    },
    [roomId]
  );

  // Connect /voice socket once per roomId
  useEffect(() => {
    if (!roomId) return;

    const s = createVoiceSocket(token);
    voiceSocketRef.current = s;

    s.on("connect", () => {
      s.emit("join-room", { roomId: String(roomId) });

      emitLocalVoiceState();
    });

    s.on("voice-state-snapshot", ({ snapshot }) => {
      if (!snapshot || typeof snapshot !== "object") return;
      setRemoteVoiceStates(snapshot);
    });

    s.on("voice:state", ({ userId, inVoice, micEnabled, deafened }) => {
      if (!userId) return;
      setRemoteVoiceStates((prev) => ({
        ...prev,
        [String(userId)]: {
          inVoice: !!inVoice,
          micEnabled: !!micEnabled,
          deafened: !!deafened,
        },
      }));
    });

    // Apply moderation to LIVEKIT locally (privacy rule enforced)
    s.on("voice-moderation", async (payload) => {
      if (!payload) return;

      const room = roomRef.current;
      const myId = String(room?.localParticipant?.identity || "");
      if (!room || !myId) return;

      const action = String(payload.action || "");
      const targetId = String(payload.targetUserId || "");
      if (!targetId || targetId !== myId) return;

      if (action === "mute") {
        try {
          await room.localParticipant.setMicrophoneEnabled(false);
        } catch {}
        setIsMicEnabled(false);
        emitLocalVoiceState({ micEnabled: false });
        return;
      }

      if (action === "deafen") {
        isDeafenedRef.current = true;
        setIsDeafened(true);
        setAllRemoteAudioMuted(true);

        try {
          await room.localParticipant.setMicrophoneEnabled(false);
        } catch {}
        setIsMicEnabled(false);

        emitLocalVoiceState({ deafened: true, micEnabled: false });
        return;
      }

      if (action === "undeafen") {
        isDeafenedRef.current = false;
        setIsDeafened(false);
        setAllRemoteAudioMuted(false);

        try {
          await room.localParticipant.setMicrophoneEnabled(false);
        } catch {}
        setIsMicEnabled(false);

        emitLocalVoiceState({ deafened: false, micEnabled: false });
        return;
      }
    });

    return () => {
      try {
        s.disconnect();
      } catch {}
      voiceSocketRef.current = null;
      setRemoteVoiceStates({});
    };
  }, [roomId, token, emitLocalVoiceState, setAllRemoteAudioMuted]);

  const syncParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setParticipants([]);
      return;
    }

    setParticipants(buildParticipantUI(room));

    // reconcile local mic state from LiveKit publication (prevents drift)
    const micPub = room.localParticipant.getTrackPublication?.(
      Track.Source.Microphone
    );
    const isMuted = micPub ? micPub.isMuted : true;

    if (lastLocalMicMutedRef.current !== isMuted) {
      lastLocalMicMutedRef.current = isMuted;
      const nextMicEnabled = !isMuted;
      setIsMicEnabled(nextMicEnabled);

      // keep UI sync to others if we're in voice
      if (isInVoiceRef.current) {
        emitLocalVoiceState({ inVoice: true, micEnabled: nextMicEnabled });
      }
    }
  }, [emitLocalVoiceState]);

  const leaveVoice = useCallback(async () => {
    try {
      joinInFlightRef.current = false;

      const room = roomRef.current;
      roomRef.current = null;

      setConnectionState("disconnected");
      setNeedsAudioStart(false);
      setDisconnectReason(null);

      setIsInVoice(false);
      isInVoiceRef.current = false;

      setIsDeafened(false);
      isDeafenedRef.current = false;

      setIsMicEnabled(false);

      if (room) {
        try {
          await room.localParticipant.setMicrophoneEnabled(false);
        } catch {}

        try {
          room.disconnect();
        } catch {}
      }
    } finally {
      emitLocalVoiceState({
        inVoice: false,
        micEnabled: false,
        deafened: false,
      });
      cleanupRemoteAudioEls();
      setParticipants([]);
    }
  }, [cleanupRemoteAudioEls, emitLocalVoiceState]);

  const joinVoice = useCallback(async () => {
    if (!roomId) return;
    if (connectionState !== "disconnected") return;

    if (joinInFlightRef.current) return;
    joinInFlightRef.current = true;

    setLastError(null);
    setDisconnectReason(null);
    setConnectionState("connecting");

    cleanupRemoteAudioEls();

    let room = null;

    try {
      const { token, url } = await createToken(roomId);

      room = new Room({});

      room.on(RoomEvent.ParticipantConnected, syncParticipants);
      room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
      room.on(RoomEvent.TrackMuted, syncParticipants);
      room.on(RoomEvent.TrackUnmuted, syncParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, syncParticipants);

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        try {
          if (!track || track.kind !== "audio") return;

          const key = getTrackKey(track, publication);
          const map = remoteAudioElsRef.current;

          if (map.has(key)) return;

          const el = track.attach();
          el.autoplay = true;
          el.playsInline = true;
          el.muted = isDeafenedRef.current;
          el.style.display = "none";
          el.dataset.lkTrackKey = key;
          el.dataset.lkParticipant = String(participant?.identity || "");

          document.body.appendChild(el);
          map.set(key, el);
        } catch (e) {
          setLastError("Failed to attach remote audio track.");
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
        try {
          if (!track || track.kind !== "audio") return;

          const key = getTrackKey(track, publication);
          const map = remoteAudioElsRef.current;

          const el = map.get(key);
          if (el) {
            try {
              track.detach(el);
            } catch {}
            el.remove();
            map.delete(key);
            return;
          }

          const detached = track.detach();
          detached.forEach((node) => {
            try {
              node.remove();
            } catch {}
          });
        } catch {}
      });

      room.on(RoomEvent.Reconnecting, () => {
        setConnectionState("connecting");
      });

      room.on(RoomEvent.Reconnected, () => {
        setConnectionState("connected");
        syncParticipants();
      });

      room.on(RoomEvent.Disconnected, (reason) => {
        setConnectionState("disconnected");
        setNeedsAudioStart(false);
        setDisconnectReason(String(reason || "unknown"));

        roomRef.current = null;
        cleanupRemoteAudioEls();

        setIsInVoice(false);
        isInVoiceRef.current = false;

        setIsDeafened(false);
        isDeafenedRef.current = false;

        setIsMicEnabled(false);

        emitLocalVoiceState({
          inVoice: false,
          micEnabled: false,
          deafened: false,
        });

        if (
          String(reason || "")
            .toLowerCase()
            .includes("auth") ||
          String(reason || "")
            .toLowerCase()
            .includes("token")
        ) {
          setLastError("Voice session ended (auth/token). Please re-join.");
        }
      });

      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setNeedsAudioStart(!room.canPlaybackAudio);
      });

      await room.connect(url, token);
      roomRef.current = room;

      setConnectionState("connected");
      setNeedsAudioStart(!room.canPlaybackAudio);

      // Default: masuk keadaan mic OFF, deafen OFF
      setIsMicEnabled(false);

      setIsDeafened(false);
      isDeafenedRef.current = false;
      setAllRemoteAudioMuted(false);

      setIsInVoice(true);
      isInVoiceRef.current = true;

      emitLocalVoiceState({
        inVoice: true,
        micEnabled: false,
        deafened: false,
      });

      syncParticipants();

      try {
        const inputs = await refreshDevices();
        const exists = inputs?.some((d) => d.deviceId === selectedAudioInputId);

        if (
          selectedAudioInputId &&
          exists &&
          selectedAudioInputId !== "default"
        ) {
          await room.switchActiveDevice("audioinput", selectedAudioInputId);
        } else {
          setSelectedAudioInputId("");
          localStorage.removeItem("voice.audioInputId");
        }
      } catch {}
    } catch (err) {
      console.error(err);
      try {
        room?.disconnect();
      } catch {}

      roomRef.current = null;
      cleanupRemoteAudioEls();

      setConnectionState("disconnected");
      setNeedsAudioStart(false);
      setDisconnectReason("failed-to-join");
      setLastError("Failed to join voice. Please try again.");

      setIsInVoice(false);
      isInVoiceRef.current = false;
      emitLocalVoiceState({
        inVoice: false,
        micEnabled: false,
        deafened: false,
      });
    } finally {
      joinInFlightRef.current = false;
    }
  }, [
    roomId,
    connectionState,
    syncParticipants,
    refreshDevices,
    selectedAudioInputId,
    cleanupRemoteAudioEls,
    getTrackKey,
    emitLocalVoiceState,
    setAllRemoteAudioMuted,
  ]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    // Kalau user menyalakan mic saat deafened, auto-undeafen
    if (isDeafenedRef.current) {
      isDeafenedRef.current = false;
      setIsDeafened(false);
      setAllRemoteAudioMuted(false);
    }

    const next = !isMicEnabled;

    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setIsMicEnabled(next);
      emitLocalVoiceState({
        inVoice: true,
        micEnabled: next,
        deafened: isDeafenedRef.current,
      });
      syncParticipants();
    } catch (err) {
      console.error("toggleMic failed:", err);

      const name = err?.name || "";
      if (
        next === true &&
        (name === "OverconstrainedError" ||
          name === "NotFoundError" ||
          name === "NotReadableError")
      ) {
        try {
          setSelectedAudioInputId("");
          localStorage.removeItem("voice.audioInputId");

          const inputs = await refreshDevices();
          const fallback = inputs?.find(
            (d) =>
              d.deviceId &&
              d.deviceId !== "default" &&
              d.deviceId !== "communications"
          );

          if (fallback?.deviceId) {
            await room.switchActiveDevice("audioinput", fallback.deviceId);
            setSelectedAudioInputId(fallback.deviceId);
            localStorage.setItem("voice.audioInputId", fallback.deviceId);
          }

          await room.localParticipant.setMicrophoneEnabled(true);
          setIsMicEnabled(true);
          emitLocalVoiceState({
            inVoice: true,
            micEnabled: true,
            deafened: isDeafenedRef.current,
          });
          syncParticipants();
          return;
        } catch (e2) {
          console.error("toggleMic fallback failed:", e2);
        }
      }
    }
  }, [
    isMicEnabled,
    refreshDevices,
    setAllRemoteAudioMuted,
    syncParticipants,
    emitLocalVoiceState,
  ]);

  const toggleDeafen = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const next = !isDeafened;

    isDeafenedRef.current = next;
    setIsDeafened(next);
    setAllRemoteAudioMuted(next);

    if (next && isMicEnabled) {
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch {}
      setIsMicEnabled(false);
      emitLocalVoiceState({ inVoice: true, deafened: true, micEnabled: false });
    } else {
      emitLocalVoiceState({ inVoice: true, deafened: next });
    }

    syncParticipants();
  }, [
    isDeafened,
    isMicEnabled,
    setAllRemoteAudioMuted,
    syncParticipants,
    emitLocalVoiceState,
  ]);

  const ownerMuteParticipant = useCallback(
    async (targetUserId) => {
      if (!roomId || !targetUserId) return;
      await moderateMute(String(roomId), String(targetUserId));
    },
    [roomId]
  );

  const ownerSetDeafenParticipant = useCallback(
    async (targetUserId, deafened) => {
      if (!roomId || !targetUserId) return;
      await moderateDeafen(String(roomId), String(targetUserId), !!deafened);
    },
    [roomId]
  );

  // Cleanup kalau komponen unmount
  useEffect(() => {
    return () => {
      void leaveVoice();
    };
  }, [leaveVoice]);

  return useMemo(
    () => ({
      connectionState,
      isInVoice,
      isMicEnabled,
      isDeafened,

      joinVoice,
      leaveVoice,
      toggleMic,
      toggleDeafen,
      needsAudioStart,
      startAudioPlayback,
      participants,
      audioInputs,
      selectedAudioInputId,
      selectAudioInput,
      refreshDevices,
      lastError,
      disconnectReason,
      ownerMuteParticipant,
      ownerSetDeafenParticipant,
      remoteVoiceStates,
    }),
    [
      connectionState,
      isInVoice,
      isMicEnabled,
      isDeafened,
      joinVoice,
      leaveVoice,
      toggleMic,
      toggleDeafen,
      needsAudioStart,
      startAudioPlayback,
      participants,
      audioInputs,
      selectedAudioInputId,
      selectAudioInput,
      refreshDevices,
      lastError,
      disconnectReason,
      ownerMuteParticipant,
      ownerSetDeafenParticipant,
      remoteVoiceStates,
    ]
  );
}
