import { useState, useCallback } from "react";

const SIMULATED_DELAY = 1500;

export function useMockVoiceState() {
  // state: 'disconnected' | 'connecting' | 'connected'
  const [connectionState, setConnectionState] = useState("disconnected");
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const joinVoice = useCallback(() => {
    setConnectionState("connecting");
    setTimeout(() => {
      setConnectionState("connected");
      // Default: Masuk room dalam keadaan mute & undeafen
      setIsMicEnabled(false);
      setIsDeafened(false);
    }, SIMULATED_DELAY);
  }, []);

  const leaveVoice = useCallback(() => {
    setConnectionState("disconnected");
    setIsMicEnabled(false);
    setIsDeafened(false);
  }, []);

  const toggleMic = () => {
    if (isDeafened) return; // Tidak bisa unmute kalau lagi deafen
    setIsMicEnabled((prev) => !prev);
  };

  const toggleDeafen = () => {
    setIsDeafened((prev) => {
      const nextState = !prev;
      if (nextState) setIsMicEnabled(false); // Auto mute kalau deafen
      return nextState;
    });
  };

  return {
    connectionState,
    isMicEnabled,
    isDeafened,
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleDeafen,
  };
}
