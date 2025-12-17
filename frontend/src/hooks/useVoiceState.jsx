import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { createToken } from "../services/voiceApi";

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
  const [participants, setParticipants] = useState([]);

  const [lastError, setLastError] = useState(null); // string | null
  const [disconnectReason, setDisconnectReason] = useState(null); // string | null

  const tokenRefreshTimerRef = useRef(null);
  const lastTokenRef = useRef(null);
  const lastUrlRef = useRef(null);

  // autoplay unblock indicator
  const [needsAudioStart, setNeedsAudioStart] = useState(false);

  // user-gesture call to allow audio playback
  const startAudioPlayback = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    await room.startAudio();
    setNeedsAudioStart(!room.canPlaybackAudio);
  }, []);

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

  const clearTokenRefreshTimer = useCallback(() => {
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }
  }, []);

  const getJwtExpMs = useCallback((jwt) => {
    try {
      const parts = jwt.split(".");
      if (parts.length < 2) return null;

      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(b64));

      if (!payload?.exp) return null;
      return payload.exp * 1000;
    } catch {
      return null;
    }
  }, []);

  const refreshTokenNow = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (room.state !== "connected") return;

    try {
      const { token: newToken, url: newUrl } = await createToken(roomId);

      lastTokenRef.current = newToken;
      lastUrlRef.current = newUrl;

      if (typeof room.refreshToken === "function") {
        await room.refreshToken(newToken);
        setLastError(null);
        setDisconnectReason(null);
        return newToken;
      }

      setLastError("SDK does not support refreshToken().");
      return null;
    } catch (e) {
      console.error("Token refresh failed:", e);
      setLastError(
        "Token refresh failed. Please re-join voice if disconnected."
      );
      return null;
    }
  }, [roomId]);

  const scheduleTokenRefresh = useCallback(
    (token) => {
      clearTokenRefreshTimer();

      const expMs = getJwtExpMs(token);
      if (!expMs) return;

      const now = Date.now();
      const refreshBeforeMs = 60_000;
      const delay = expMs - now - refreshBeforeMs;

      const safeDelay = Math.max(5_000, delay);

      tokenRefreshTimerRef.current = setTimeout(async () => {
        const newToken = await refreshTokenNow();
        if (newToken) scheduleTokenRefresh(newToken);
      }, safeDelay);
    },
    [clearTokenRefreshTimer, getJwtExpMs, refreshTokenNow]
  );
  const selectAudioInput = useCallback(
    async (deviceId) => {
      setSelectedAudioInputId(deviceId || "");
      localStorage.setItem("voice.audioInputId", deviceId || "");

      const room = roomRef.current;
      if (!room) return;

      try {
        if (!deviceId || deviceId === "default") {
          const inputs = await refreshDevices();
          const fallback = inputs.find(
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
          return;
        }

        await room.switchActiveDevice("audioinput", deviceId);
      } catch (e) {
        console.error("switchActiveDevice(audioinput) failed:", e);

        try {
          const inputs = await refreshDevices();
          const fallback = inputs.find(
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
        } catch (e2) {
          console.error("fallback switch input failed:", e2);
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

  const roomRef = useRef(null);

  // Track audio elements yang di-attach supaya bisa dimute saat deafen
  const audioElsRef = useRef(new Map()); // trackSid -> HTMLMediaElement

  const syncParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setParticipants([]);
      return;
    }
    setParticipants(buildParticipantUI(room));
  }, []);

  const setAllRemoteAudioMuted = useCallback((muted) => {
    for (const el of audioElsRef.current.values()) {
      el.muted = muted;
    }
  }, []);

  const leaveVoice = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;

    try {
      if (room) {
        room.disconnect();
      }
    } finally {
      // cleanup audio elements
      clearTokenRefreshTimer();
      for (const el of audioElsRef.current.values()) {
        try {
          el.remove();
        } catch {
          // ignore
        }
      }
      audioElsRef.current.clear();

      setConnectionState("disconnected");
      setIsMicEnabled(false);
      setIsDeafened(false);
      setParticipants([]);
      setNeedsAudioStart(false);
    }
  }, [clearTokenRefreshTimer]);

  const joinVoice = useCallback(async () => {
    if (!roomId) return;
    if (connectionState !== "disconnected") return;

    setConnectionState("connecting");

    try {
      const { token, url } = await createToken(roomId);
      lastTokenRef.current = token;
      lastUrlRef.current = url;
      setLastError(null);
      setDisconnectReason(null);

      const room = new Room({
        // default autoSubscribe true
      });

      // events
      room.on(RoomEvent.ParticipantConnected, syncParticipants);
      room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
      room.on(RoomEvent.TrackMuted, syncParticipants);
      room.on(RoomEvent.TrackUnmuted, syncParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, syncParticipants);

      room.on(RoomEvent.TrackSubscribed, (track) => {
        // Attach audio tracks so we can hear others
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach(); // LiveKit recommended attach flow :contentReference[oaicite:2]{index=2}
          el.autoplay = true;
          el.muted = isDeafened; // apply deafen state
          el.style.display = "none";
          document.body.appendChild(el);

          audioElsRef.current.set(track.sid, el);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = audioElsRef.current.get(track.sid);
          if (el) {
            audioElsRef.current.delete(track.sid);
            el.remove();
          }
          track.detach();
        }
      });

      // Show "connecting" during LiveKit reconnect
      room.on(RoomEvent.Reconnecting, () => {
        setConnectionState("connecting");
      });

      // Back to connected after reconnect
      room.on(RoomEvent.Reconnected, () => {
        setConnectionState("connected");
        syncParticipants();
      });

      // If disconnected, reflect it in UI (we do NOT auto-join)
      room.on(RoomEvent.Disconnected, (reason) => {
        setConnectionState("disconnected");
        setNeedsAudioStart(false);
        clearTokenRefreshTimer();
        setDisconnectReason(String(reason || "unknown"));

        // bersihkan roomRef supaya UI tidak pegang room yang sudah mati
        roomRef.current = null;

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

      // Autoplay policy handling
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setNeedsAudioStart(!room.canPlaybackAudio);
      });

      await room.connect(url, token);
      roomRef.current = room;

      // Default: masuk dalam keadaan mute (mic belum publish)
      setConnectionState("connected");

      scheduleTokenRefresh(token);

      // initial autoplay state
      setNeedsAudioStart(!room.canPlaybackAudio);

      setIsMicEnabled(false);
      setIsDeafened(false);

      syncParticipants();
      // Refresh device list (labels muncul setelah permission mic diberikan)
      try {
        const inputs = await refreshDevices();
        const exists = inputs.some((d) => d.deviceId === selectedAudioInputId);

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
      } catch (e) {
        // ignore untuk demo; device list bisa gagal di beberapa browser tanpa permission
      }
    } catch (err) {
      console.error(err);
      await leaveVoice();
    }
  }, [
    roomId,
    connectionState,
    isDeafened,
    syncParticipants,
    leaveVoice,
    refreshDevices,
    selectedAudioInputId,
    scheduleTokenRefresh,
    clearTokenRefreshTimer,
  ]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    // Jika user menyalakan mic saat deafened, kita auto-undeafen (sesuai pola mock Anda)
    if (isDeafened) {
      setIsDeafened(false);
      setAllRemoteAudioMuted(false);
    }

    const next = !isMicEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setIsMicEnabled(next);
      syncParticipants();
    } catch (err) {
      console.error("toggleMic failed:", err);

      // Fallback khusus OverconstrainedError / NotFoundError (device invalid)
      const name = err?.name || "";
      if (
        next === true &&
        (name === "OverconstrainedError" ||
          name === "NotFoundError" ||
          name === "NotReadableError")
      ) {
        try {
          // reset to default device
          setSelectedAudioInputId("");
          localStorage.removeItem("voice.audioInputId");

          // LiveKit: switch to default by omitting deviceId
          // Cara paling aman: pilih device pertama yang tersedia, atau biarkan default
          await refreshDevices();
          const inputs = await refreshDevices();
          const fallback = inputs.find(
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

          // retry publish mic
          await room.localParticipant.setMicrophoneEnabled(true);
          setIsMicEnabled(true);
          syncParticipants();
          return;
        } catch (e2) {
          console.error("toggleMic fallback failed:", e2);
        }
      }

      // kalau tetap gagal, jangan ubah state isMicEnabled
    }
  }, [
    isMicEnabled,
    isDeafened,
    setAllRemoteAudioMuted,
    syncParticipants,
    refreshDevices,
    audioInputs,
  ]);

  const toggleDeafen = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const next = !isDeafened;

    setIsDeafened(next);
    setAllRemoteAudioMuted(next);

    // Deafen => mic off (meniru mock state Anda)
    if (next && isMicEnabled) {
      await room.localParticipant.setMicrophoneEnabled(false);
      setIsMicEnabled(false);
    }

    syncParticipants();
  }, [isDeafened, isMicEnabled, setAllRemoteAudioMuted, syncParticipants]);

  // Cleanup kalau komponen unmount
  useEffect(() => {
    return () => {
      void leaveVoice();
    };
  }, [leaveVoice]);

  return useMemo(
    () => ({
      connectionState,
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
    }),
    [
      connectionState,
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
    ]
  );
}
